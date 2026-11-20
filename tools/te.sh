#!/usr/bin/env bash
set -euo pipefail

# Persistent wrapper & auto-bootstrapper for microsoft/TokenEconomizer
# (https://github.com/microsoft/TokenEconomizer)
#
# Installs the official self-contained Python stdlib-only plugin bundle into
# $TOKENECONOMIZER_HOME (default: ~/.tokeneconomizer):
#   - ~/.tokeneconomizer/plugin/          (self-contained bundle built via scripts/build_plugin.py)
#   - ~/.tokeneconomizer/bin/{te,te-hook} (stable launchers referenced by hooks & slash commands)
#   - /usr/local/bin/{te,te-hook}         (global PATH symlinks when writable)
#   - Python user site-packages .pth      (so `import tokeneconomizer` works globally with zero pip deps)
#
# Coexists cleanly with rtk (mode Lite) and codebase-memory-mcp.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TE_REPO_URL="${TE_REPO_URL:-https://github.com/microsoft/TokenEconomizer.git}"
TE_HOME="${TOKENECONOMIZER_HOME:-$HOME/.tokeneconomizer}"
TE_PLUGIN_DIR="$TE_HOME/plugin"
TE_BIN="$TE_HOME/bin/te"
TE_HOOK_BIN="$TE_HOME/bin/te-hook"

has_python310() {
  python3 -E -S -c 'import sys; sys.exit(sys.version_info < (3, 10))' >/dev/null 2>&1
}

ensure_launchers_and_pth() {
  mkdir -p "$TE_HOME/bin"
  chmod 700 "$TE_HOME" 2>/dev/null || true

  cat > "$TE_BIN" << EOF
#!/bin/sh
exec "$TE_PLUGIN_DIR/scripts/te" "\$@"
EOF
  cat > "$TE_HOOK_BIN" << EOF
#!/bin/sh
exec "$TE_PLUGIN_DIR/scripts/te-hook" "\$@"
EOF
  chmod +x "$TE_BIN" "$TE_HOOK_BIN" "$TE_PLUGIN_DIR/scripts/te" "$TE_PLUGIN_DIR/scripts/te-hook"

  mkdir -p "$HOME/.local/bin" 2>/dev/null || true
  ln -sf "$TE_BIN" "$HOME/.local/bin/te" 2>/dev/null || true
  ln -sf "$TE_HOOK_BIN" "$HOME/.local/bin/te-hook" 2>/dev/null || true
  ln -sf "$TE_BIN" /usr/local/bin/te 2>/dev/null || true
  ln -sf "$TE_HOOK_BIN" /usr/local/bin/te-hook 2>/dev/null || true

  # Register lib/ in Python user site-packages so `import tokeneconomizer` works globally
  python3 - "$TE_PLUGIN_DIR/lib" << 'PY' 2>/dev/null || true
import os, site, sys
lib_dir = os.path.abspath(sys.argv[1])
user_site = site.getusersitepackages()
if user_site:
    os.makedirs(user_site, exist_ok=True)
    pth_path = os.path.join(user_site, "tokeneconomizer.pth")
    with open(pth_path, "w", encoding="utf-8") as fh:
        fh.write(lib_dir + "\n")
PY
}

install_from_upstream() {
  local source_dir="${1:-}"
  local tmp_dir=""
  tmp_dir="$(mktemp -d)"

  if [ -z "$source_dir" ] || [ ! -f "$source_dir/scripts/build_plugin.py" ]; then
    echo "[te] Cloning microsoft/TokenEconomizer..." >&2
    git clone --depth 1 --quiet "$TE_REPO_URL" "$tmp_dir/src"
    source_dir="$tmp_dir/src"
  fi

  echo "[te] Building self-contained stdlib plugin bundle..." >&2
  python3 "$source_dir/scripts/build_plugin.py" --out "$tmp_dir/dist" >/dev/null

  mkdir -p "$TE_HOME"
  chmod 700 "$TE_HOME" 2>/dev/null || true
  rm -rf "$TE_PLUGIN_DIR"
  mv "$tmp_dir/dist/tokeneconomizer" "$TE_PLUGIN_DIR"
  rm -rf "$tmp_dir"

  ensure_launchers_and_pth
}

configure_defaults() {
  # Configure zero-cost LLM-free micro-skills (compatible with Antigravity & rtk),
  # safe reviewable tool pruning proposals, and default loop guard.
  "$TE_BIN" --cwd "$ROOT_DIR" config set microskills=envfacts toolprune=propose loopguard=nudge >/dev/null 2>&1 || true

  # Register Antigravity CLI plugin automatically if `agy` is available on PATH.
  if command -v agy >/dev/null 2>&1; then
    agy plugin install "$TE_PLUGIN_DIR" >/dev/null 2>&1 || true
  fi
}

is_te_installed() {
  [ -f "$TE_PLUGIN_DIR/lib/tokeneconomizer/plugin/hook.py" ] \
    && [ -x "$TE_PLUGIN_DIR/scripts/te" ] \
    && [ -x "$TE_PLUGIN_DIR/scripts/te-hook" ] \
    && [ -x "$TE_BIN" ] \
    && [ -x "$TE_HOOK_BIN" ]
}

ensure_te_installed() {
  if ! has_python310; then
    echo "[te] Error: Python >= 3.10 is required for TokenEconomizer." >&2
    exit 1
  fi

  if is_te_installed; then
    if [ ! -e /usr/local/bin/te ] || [ ! -e /usr/local/bin/te-hook ]; then
      ensure_launchers_and_pth
    fi
    return 0
  fi

  install_from_upstream "${TE_LOCAL_SOURCE:-}"
  configure_defaults
}

CMD="${1:-}"

if [ "$CMD" = "update" ]; then
  shift || true
  if ! has_python310; then
    echo "[te] Error: Python >= 3.10 is required for TokenEconomizer." >&2
    exit 1
  fi
  install_from_upstream "${TE_LOCAL_SOURCE:-}"
  configure_defaults
  exec "$TE_BIN" --cwd "$ROOT_DIR" doctor "$@"
fi

ensure_te_installed

if [ "$#" -eq 0 ]; then
  exec "$TE_BIN" --cwd "$ROOT_DIR" status
elif [ "$CMD" = "setup" ]; then
  shift || true
  ensure_launchers_and_pth
  configure_defaults
  exec "$TE_BIN" --cwd "$ROOT_DIR" doctor "$@"
elif [ "$CMD" = "hook" ]; then
  shift || true
  exec "$TE_HOOK_BIN" "$@"
else
  exec "$TE_BIN" --cwd "$ROOT_DIR" "$@"
fi
