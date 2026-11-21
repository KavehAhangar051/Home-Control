#!/usr/bin/env bash
set -euo pipefail

# Persistent wrapper & auto-bootstrapper for C/C++ Format, Lint, Typecheck & Static Analysis tools:
#   - clang-format (formatting)
#   - clang-tidy   (C/C++ linter & static analyzer)
#   - clangd       (C/C++ semantic typecheck & LSP)
#   - cppcheck     (deep C/C++ static analysis, via PlatformIO tool-cppcheck)
#   - cpplint      (style linter)
#   - cmake, ninja (build helpers)
#
# Everything lives in <repo>/.agent-state/cpp-tools and <repo>/.agent-state/platformio
# so container resets restore in milliseconds and fresh GitHub imports auto-bootstrap.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CPP_STATE_ROOT="$ROOT_DIR/.agent-state/cpp-tools"
CPP_VENV_DIR="$CPP_STATE_ROOT/venv"
CLANGD_DIR="$CPP_STATE_ROOT/clangd"
CLANGD_VERSION="${CLANGD_VERSION:-23.1.0}"
CPP_CONTAINER_MARKER="/tmp/.cpp_tools_initialized"

PIO_STATE_ROOT="$ROOT_DIR/.agent-state/platformio"
PIO_BIN="$PIO_STATE_ROOT/penv/bin/pio"
CPPCHECK_PKG_BIN="$PIO_STATE_ROOT/packages/tool-cppcheck/cppcheck"

export PLATFORMIO_CORE_DIR="$PIO_STATE_ROOT"

find_clangd_bin() {
  find "$CLANGD_DIR" -maxdepth 3 -type f -name clangd 2>/dev/null | head -n 1 || true
}

link_cpp_tools() {
  mkdir -p "$HOME/.local/bin"
  for tool in clang-format clang-tidy cpplint cmake ninja; do
    if [ -x "$CPP_VENV_DIR/bin/$tool" ]; then
      ln -sf "$CPP_VENV_DIR/bin/$tool" "$HOME/.local/bin/$tool" 2>/dev/null || true
      ln -sf "$CPP_VENV_DIR/bin/$tool" "/usr/local/bin/$tool" 2>/dev/null || true
    fi
  done

  local clangd_bin
  clangd_bin="$(find_clangd_bin)"
  if [ -n "$clangd_bin" ] && [ -x "$clangd_bin" ]; then
    ln -sf "$clangd_bin" "$HOME/.local/bin/clangd" 2>/dev/null || true
    ln -sf "$clangd_bin" /usr/local/bin/clangd 2>/dev/null || true
  fi

  if [ -x "$CPPCHECK_PKG_BIN" ]; then
    ln -sf "$CPPCHECK_PKG_BIN" "$HOME/.local/bin/cppcheck" 2>/dev/null || true
    ln -sf "$CPPCHECK_PKG_BIN" /usr/local/bin/cppcheck 2>/dev/null || true
  fi
}

install_cpp_venv() {
  echo "[cpp-tools] Installing clang-format, clang-tidy, cpplint, cmake, ninja..." >&2
  rm -rf "$CPP_VENV_DIR"
  python3 -m venv --without-pip "$CPP_VENV_DIR"
  local tmp_get_pip
  tmp_get_pip="$(mktemp /tmp/get-pip-cpp-XXXXXX.py)"
  curl -fsSL "https://bootstrap.pypa.io/get-pip.py" -o "$tmp_get_pip"
  "$CPP_VENV_DIR/bin/python" "$tmp_get_pip" --quiet
  rm -f "$tmp_get_pip"
  "$CPP_VENV_DIR/bin/pip" install --quiet -U clang-format clang-tidy cpplint cmake ninja
}

install_clangd() {
  echo "[cpp-tools] Installing clangd ${CLANGD_VERSION}..." >&2
  local tmp_dir
  tmp_dir="$(mktemp -d)"
  local zip_path="$tmp_dir/clangd.zip"
  curl -fsSL "https://github.com/clangd/clangd/releases/download/${CLANGD_VERSION}/clangd-linux-${CLANGD_VERSION}.zip" -o "$zip_path"
  rm -rf "$CLANGD_DIR"
  mkdir -p "$CLANGD_DIR"
  unzip -q "$zip_path" -d "$CLANGD_DIR"
  rm -rf "$tmp_dir"
  local clangd_bin
  clangd_bin="$(find_clangd_bin)"
  if [ -n "$clangd_bin" ]; then
    chmod +x "$clangd_bin"
  fi
}

install_cppcheck() {
  if [ ! -x "$CPPCHECK_PKG_BIN" ]; then
    if [ ! -x "$PIO_BIN" ]; then
      bash "$ROOT_DIR/tools/pio.sh" ensure
    fi
    echo "[cpp-tools] Installing platformio/tool-cppcheck..." >&2
    "$PIO_BIN" pkg install -g -t platformio/tool-cppcheck >/dev/null
  fi
}

ensure_cpp_tools_installed() {
  mkdir -p "$CPP_STATE_ROOT"
  if [ ! -x "$CPP_VENV_DIR/bin/clang-format" ] || [ ! -x "$CPP_VENV_DIR/bin/clang-tidy" ] || ! "$CPP_VENV_DIR/bin/clang-format" --version >/dev/null 2>&1; then
    install_cpp_venv
  fi
  local clangd_bin
  clangd_bin="$(find_clangd_bin)"
  if [ -z "$clangd_bin" ] || [ ! -x "$clangd_bin" ]; then
    install_clangd
  fi
  if [ ! -x "$CPPCHECK_PKG_BIN" ]; then
    install_cppcheck
  fi
  link_cpp_tools
}

cpp_source_files() {
  find "$ROOT_DIR/firmware" "$ROOT_DIR/include" "$ROOT_DIR/lib" "$ROOT_DIR/test" \
    -type f \( -name '*.c' -o -name '*.cc' -o -name '*.cpp' -o -name '*.h' -o -name '*.hpp' \) \
    ! -path '*/test/mocks/*' 2>/dev/null | sort
}

generate_compiledb() {
  local env_name="${1:-esp32dev}"
  if [ ! -x "$PIO_BIN" ]; then
    bash "$ROOT_DIR/tools/pio.sh" ensure
  fi
  "$PIO_BIN" run -e "$env_name" -t compiledb
  python3 - "$ROOT_DIR/compile_commands.json" "$PIO_STATE_ROOT" <<'PY'
import json
import os
import shlex
import shutil
import subprocess
import sys
from pathlib import Path

db_path = Path(sys.argv[1])
pio_root = Path(sys.argv[2])
if not db_path.is_file():
    sys.exit(0)

BAD_FLAGS = {
    "-mlongcalls",
    "-fstrict-volatile-bitfields",
    "-fno-tree-switch-conversion",
    "-mtext-section-literals",
    "-mdisable-hardware-atomics",
    "-freorder-blocks",
}

entries = json.loads(db_path.read_text(encoding="utf-8"))
sys_includes_cache = {}
compiler_path_cache = {}

def resolve_compiler(compiler: str) -> str:
    if compiler in compiler_path_cache:
        return compiler_path_cache[compiler]
    resolved = shutil.which(compiler)
    if not resolved:
        matches = sorted((pio_root / "packages").glob(f"*/bin/{Path(compiler).name}"))
        if matches:
            resolved = str(matches[0])
    compiler_path_cache[compiler] = resolved or compiler
    return compiler_path_cache[compiler]

def get_sys_includes(compiler: str) -> list[str]:
    if compiler in sys_includes_cache:
        return sys_includes_cache[compiler]
    inc_dirs = []
    if "xtensa" in compiler or "riscv" in compiler or "esp" in compiler:
        exe = resolve_compiler(compiler)
        if exe and Path(exe).exists():
            proc = subprocess.run(
                [exe, "-E", "-Wp,-v", "-x", "c++", "/dev/null"],
                capture_output=True,
                text=True,
            )
            collecting = False
            for line in proc.stderr.splitlines():
                if line.strip().startswith("#include <...> search starts here:"):
                    collecting = True
                    continue
                if collecting:
                    if line.strip().startswith("End of search list."):
                        break
                    p = line.strip()
                    if p:
                        inc_dirs.append(os.path.abspath(p))
    sys_includes_cache[compiler] = inc_dirs
    return inc_dirs

changed = False
for entry in entries:
    cmd = entry.get("command")
    if not cmd:
        continue
    tokens = shlex.split(cmd)
    if not tokens:
        continue
    compiler = tokens[0]
    filtered = [t for t in tokens if t not in BAD_FLAGS]
    if "xtensa" in compiler or "riscv" in compiler or "esp" in compiler:
        sys_incs = get_sys_includes(compiler)
        extra = []
        for inc in sys_incs:
            extra.extend(["-isystem", inc])
        if "-Wno-unknown-warning-option" not in filtered:
            extra.append("-Wno-unknown-warning-option")
        filtered = [resolve_compiler(compiler), *extra, *filtered[1:]]
        changed = True
    elif len(filtered) != len(tokens):
        changed = True
    if changed:
        entry["command"] = " ".join(shlex.quote(t) for t in filtered)

if changed:
    db_path.write_text(json.dumps(entries, indent=2) + "\n", encoding="utf-8")
PY
}

ensure_cpp_tools_installed

CMD="${1:-}"
case "$CMD" in
  ensure)
    if [ ! -f "$CPP_CONTAINER_MARKER" ]; then
      link_cpp_tools
      touch "$CPP_CONTAINER_MARKER"
    fi
    exit 0
    ;;
  setup)
    link_cpp_tools
    generate_compiledb "${2:-esp32dev}" >/dev/null 2>&1 || true
    touch "$CPP_CONTAINER_MARKER"
    clangd_bin="$(find_clangd_bin)"
    echo "[cpp-tools] clang-format: $("$CPP_VENV_DIR/bin/clang-format" --version)"
    echo "[cpp-tools] clang-tidy:   $("$CPP_VENV_DIR/bin/clang-tidy" --version | grep -m1 'version' | xargs)"
    echo "[cpp-tools] clangd:       $("$clangd_bin" --version | head -n 1)"
    echo "[cpp-tools] cppcheck:     $("$CPPCHECK_PKG_BIN" --version)"
    echo "[cpp-tools] cpplint:      $("$CPP_VENV_DIR/bin/cpplint" --version | grep -m1 'cpplint' | xargs)"
    ;;
  compiledb)
    shift || true
    generate_compiledb "${1:-esp32dev}"
    ;;
  format)
    shift || true
    if [ "$#" -gt 0 ]; then
      exec "$CPP_VENV_DIR/bin/clang-format" -i "$@"
    fi
    cpp_source_files | xargs -r "$CPP_VENV_DIR/bin/clang-format" -i
    ;;
  format:check)
    shift || true
    if [ "$#" -gt 0 ]; then
      exec "$CPP_VENV_DIR/bin/clang-format" --dry-run --Werror "$@"
    fi
    cpp_source_files | xargs -r "$CPP_VENV_DIR/bin/clang-format" --dry-run --Werror
    ;;
  lint)
    shift || true
    if [ "$#" -gt 0 ]; then
      exec "$CPPCHECK_PKG_BIN" --enable=warning,performance,portability --std=c++14 --inline-suppr --suppress=missingIncludeSystem "$@"
    fi
    exec "$PIO_BIN" check -e native --skip-packages
    ;;
  tidy)
    shift || true
    if [ ! -f "$ROOT_DIR/compile_commands.json" ]; then
      generate_compiledb esp32dev >/dev/null
    fi
    if [ "$#" -gt 0 ]; then
      exec "$CPP_VENV_DIR/bin/clang-tidy" -p "$ROOT_DIR" "$@"
    fi
    find "$ROOT_DIR/firmware" "$ROOT_DIR/lib" -type f \( -name '*.cpp' -o -name '*.c' \) | sort | xargs -r "$CPP_VENV_DIR/bin/clang-tidy" -p "$ROOT_DIR"
    ;;
  typecheck)
    shift || true
    if [ ! -f "$ROOT_DIR/compile_commands.json" ]; then
      generate_compiledb esp32dev >/dev/null
    fi
    clangd_bin="$(find_clangd_bin)"
    local_target="${1:-$ROOT_DIR/firmware/src/main.cpp}"
    exec "$clangd_bin" \
      --query-driver="/usr/bin/g++,/usr/bin/gcc,$PIO_STATE_ROOT/packages/**/bin/*g++*,$PIO_STATE_ROOT/packages/**/bin/*gcc*" \
      --check="$local_target"
    ;;
  *)
    echo "Usage: tools/cpp.sh <ensure|setup|compiledb|format|format:check|lint|tidy|typecheck> [args...]" >&2
    exit 2
    ;;
esac
