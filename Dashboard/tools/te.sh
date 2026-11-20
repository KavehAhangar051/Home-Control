#!/usr/bin/env bash
set -euo pipefail

# Persistent wrapper & offline-resilient auto-bootstrapper for microsoft/TokenEconomizer
# Stores the built stdlib bundle, bin launchers, learned micro-skills, toolprune state,
# and session ledger in <repo>/.agent-state/tokeneconomizer so container resets never wipe memory.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TE_REPO_URL="${TE_REPO_URL:-https://github.com/microsoft/TokenEconomizer.git}"
TE_VAULT="$ROOT_DIR/.agent-state/tokeneconomizer"
export TOKENECONOMIZER_HOME="$TE_VAULT"
TE_PLUGIN_DIR="$TE_VAULT/plugin"
TE_BIN="$TE_VAULT/bin/te"
TE_HOOK_BIN="$TE_VAULT/bin/te-hook"

has_python310() {
  python3 -E -S -c 'import sys; sys.exit(sys.version_info < (3, 10))' >/dev/null 2>&1
}

link_home_and_path() {
  mkdir -p "$TE_VAULT/bin" "$HOME/.local/bin"
  chmod 700 "$TE_VAULT" 2>/dev/null || true

  # Migrate any volatile ~/.tokeneconomizer state into persistent workspace vault once
  if [ -d "$HOME/.tokeneconomizer" ] && [ ! -L "$HOME/.tokeneconomizer" ]; then
    if [ ! -f "$TE_PLUGIN_DIR/lib/tokeneconomizer/plugin/hook.py" ] && [ -d "$HOME/.tokeneconomizer/plugin" ]; then
      cp -a "$HOME/.tokeneconomizer/." "$TE_VAULT/" 2>/dev/null || true
    fi
    rm -rf "$HOME/.tokeneconomizer"
  fi

  ln -sfn "$TE_VAULT" "$HOME/.tokeneconomizer"

  cat > "$TE_BIN" << EOF
#!/bin/sh
export TOKENECONOMIZER_HOME="$TE_VAULT"
exec "$TE_PLUGIN_DIR/scripts/te" "\$@"
EOF
  cat > "$TE_HOOK_BIN" << EOF
#!/bin/sh
export TOKENECONOMIZER_HOME="$TE_VAULT"
exec "$TE_PLUGIN_DIR/scripts/te-hook" "\$@"
EOF
  chmod +x "$TE_BIN" "$TE_HOOK_BIN"
  [ -f "$TE_PLUGIN_DIR/scripts/te" ] && chmod +x "$TE_PLUGIN_DIR/scripts/te" "$TE_PLUGIN_DIR/scripts/te-hook"

  ln -sf "$TE_BIN" "$HOME/.local/bin/te" 2>/dev/null || true
  ln -sf "$TE_HOOK_BIN" "$HOME/.local/bin/te-hook" 2>/dev/null || true
  ln -sf "$TE_BIN" /usr/local/bin/te 2>/dev/null || true
  ln -sf "$TE_HOOK_BIN" /usr/local/bin/te-hook 2>/dev/null || true

  python3 - "$TE_PLUGIN_DIR/lib" << 'PY' 2>/dev/null || true
import os, site, sys
lib_dir = os.path.abspath(sys.argv[1])
user_site = site.getusersitepackages()
if user_site and os.path.isdir(lib_dir):
    os.makedirs(user_site, exist_ok=True)
    pth_path = os.path.join(user_site, "tokeneconomizer.pth")
    if not os.path.exists(pth_path) or open(pth_path, encoding="utf-8").read().strip() != lib_dir:
        with open(pth_path, "w", encoding="utf-8") as fh:
            fh.write(lib_dir + "\n")
PY
}

install_from_upstream() {
  local source_dir="${1:-}"
  local tmp_dir=""
  tmp_dir="$(mktemp -d)"

  if [ -z "$source_dir" ] || [ ! -f "$source_dir/scripts/build_plugin.py" ]; then
    local te_ref="${TE_REF:-main}"
    echo "[te] Cloning microsoft/TokenEconomizer (${te_ref})..." >&2
    git clone --depth 1 --branch "$te_ref" --quiet "$TE_REPO_URL" "$tmp_dir/src"
    source_dir="$tmp_dir/src"
  fi

  echo "[te] Building self-contained stdlib plugin bundle..." >&2
  python3 "$source_dir/scripts/build_plugin.py" --out "$tmp_dir/dist" >/dev/null

  mkdir -p "$TE_VAULT"
  chmod 700 "$TE_VAULT" 2>/dev/null || true
  rm -rf "$TE_PLUGIN_DIR"
  mv "$tmp_dir/dist/tokeneconomizer" "$TE_PLUGIN_DIR"
  rm -rf "$tmp_dir"

  link_home_and_path
}

configure_defaults() {
  "$TE_BIN" --cwd "$ROOT_DIR" config set microskills=envfacts toolprune=propose loopguard=nudge >/dev/null 2>&1 || true

  if command -v agy >/dev/null 2>&1; then
    agy plugin install "$TE_PLUGIN_DIR" >/dev/null 2>&1 || true
  fi
}

is_te_installed() {
  [ -f "$TE_PLUGIN_DIR/lib/tokeneconomizer/plugin/hook.py" ] \
    && [ -x "$TE_PLUGIN_DIR/scripts/te" ] \
    && [ -x "$TE_PLUGIN_DIR/scripts/te-hook" ]
}

ensure_te_installed() {
  if ! has_python310; then
    echo "[te] Error: Python >= 3.10 is required for TokenEconomizer." >&2
    exit 1
  fi

  if is_te_installed; then
    if [ ! -L "$HOME/.tokeneconomizer" ] || [ ! -x /usr/local/bin/te ] || [ ! -x /usr/local/bin/te-hook ]; then
      link_home_and_path
    fi
    return 0
  fi

  # Also try migrating from ~/.tokeneconomizer before hitting network
  link_home_and_path
  if ! is_te_installed; then
    install_from_upstream "${TE_LOCAL_SOURCE:-}"
  fi
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
elif [ "$CMD" = "ensure" ]; then
  exit 0
elif [ "$CMD" = "setup" ]; then
  shift || true
  link_home_and_path
  configure_defaults
  exec "$TE_BIN" --cwd "$ROOT_DIR" doctor "$@"
elif [ "$CMD" = "hook" ]; then
  shift || true
  exec "$TE_HOOK_BIN" "$@"
else
  exec "$TE_BIN" --cwd "$ROOT_DIR" "$@"
fi
