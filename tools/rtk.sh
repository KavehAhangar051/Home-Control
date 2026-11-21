#!/usr/bin/env bash
set -euo pipefail

# Persistent wrapper & auto-bootstrapper for rtk (Rust Token Killer)
# Stores binary, Lite Mode config, and SQLite savings/recall DB inside
# <repo>/.agent-state/rtk so container resets and GitHub re-imports never lose rtk or `rtk gain` history.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RTK_STATE_ROOT="$ROOT_DIR/.agent-state/rtk"
RTK_CACHE_BIN="$RTK_STATE_ROOT/bin/rtk"
RTK_CFG_DIR="$RTK_STATE_ROOT/config"
RTK_DATA_DIR="$RTK_STATE_ROOT/data"
RTK_BIN=""

write_lite_config() {
  mkdir -p "$RTK_CFG_DIR" "$RTK_DATA_DIR"
  cat > "$RTK_CFG_DIR/config.toml" << 'EOF'
[tracking]
enabled = true
history_days = 365

[display]
colors = false
emoji = false
max_width = 120
pro_hint = false

[filters]
ignore_dirs = [
    ".git",
    "node_modules",
    ".pio",
    ".agent-state",
    "dist",
    "build",
    "target",
    "__pycache__",
    ".venv",
    "vendor",
]
ignore_files = [
    "*.lock",
    "*.min.js",
    "*.min.css",
    "*.tsbuildinfo",
    "*.bin",
]

[retriever]
mode = "sqlite"
max_entry_bytes = 10485760
max_entries = 500
retention_days = 90
compression = true
tee_max_files = 20
tee_max_file_size = 1048576
tee_on_success = false

[telemetry]
enabled = false

[hooks]
exclude_commands = []
transparent_prefixes = []
suppress_hook_warning = true
wrap_fish_scripts = false

[limits]
grep_max_results = 150
grep_max_per_file = 20
status_max_files = 15
status_max_untracked = 10
passthrough_max_chars = 2000

[awareness]
level = "default"
EOF
  if [ -f "$ROOT_DIR/.rtk/pipeline.toml" ]; then
    cp -f "$ROOT_DIR/.rtk/pipeline.toml" "$RTK_CFG_DIR/pipeline.toml"
  fi
}

link_state_dirs() {
  mkdir -p "$HOME/.config" "$HOME/.local/share" "$HOME/.local/bin"

  # Migrate volatile $HOME data once if persistent store has no history.db yet
  if [ -d "$HOME/.local/share/rtk" ] && [ ! -L "$HOME/.local/share/rtk" ]; then
    if [ ! -f "$RTK_DATA_DIR/history.db" ] && [ -f "$HOME/.local/share/rtk/history.db" ]; then
      cp -a "$HOME/.local/share/rtk/." "$RTK_DATA_DIR/" 2>/dev/null || true
    fi
    rm -rf "$HOME/.local/share/rtk"
  fi

  if [ -d "$HOME/.config/rtk" ] && [ ! -L "$HOME/.config/rtk" ]; then
    rm -rf "$HOME/.config/rtk"
  fi

  ln -sfn "$RTK_CFG_DIR" "$HOME/.config/rtk"
  ln -sfn "$RTK_DATA_DIR" "$HOME/.local/share/rtk"

  if [ -x "$RTK_CACHE_BIN" ]; then
    ln -sf "$RTK_CACHE_BIN" "$HOME/.local/bin/rtk" 2>/dev/null || true
    ln -sf "$RTK_CACHE_BIN" /usr/local/bin/rtk 2>/dev/null || true
    RTK_BIN="$RTK_CACHE_BIN"
  fi
}

ensure_rtk_installed() {
  mkdir -p "$RTK_STATE_ROOT/bin" "$RTK_CFG_DIR" "$RTK_DATA_DIR"

  # Capture existing binary into persistent vault if present on system
  if [ ! -x "$RTK_CACHE_BIN" ]; then
    for cand in "$HOME/.local/bin/rtk" /usr/local/bin/rtk; do
      if [ -x "$cand" ] && [ ! -L "$cand" ]; then
        cp -f "$cand" "$RTK_CACHE_BIN"
        chmod +x "$RTK_CACHE_BIN"
        break
      fi
    done
  fi

  if [ ! -x "$RTK_CACHE_BIN" ]; then
    local rtk_ver="${RTK_VERSION:-v1.2.1}"
    echo "[rtk] Installing rtk ${rtk_ver} (Rust Token Killer)..." >&2
    curl -fsSL "https://raw.githubusercontent.com/rtk-ai/rtk/${rtk_ver}/install.sh" \
      | RTK_VERSION="$rtk_ver" RTK_INSTALL_DIR="$RTK_STATE_ROOT/bin" sh
    chmod +x "$RTK_CACHE_BIN"
  fi

  if [ ! -f "$RTK_CFG_DIR/config.toml" ]; then
    write_lite_config
  elif [ -f "$ROOT_DIR/.rtk/pipeline.toml" ]; then
    cp -f "$ROOT_DIR/.rtk/pipeline.toml" "$RTK_CFG_DIR/pipeline.toml"
  fi

  link_state_dirs

  if [ -z "$RTK_BIN" ] && command -v rtk >/dev/null 2>&1; then
    RTK_BIN="$(command -v rtk)"
  fi
}

CONTAINER_MARKER="/tmp/.rtk_container_initialized"

apply_setup() {
  if [ ! -f "$RTK_CFG_DIR/config.toml" ]; then
    write_lite_config
  elif [ -f "$ROOT_DIR/.rtk/pipeline.toml" ]; then
    cp -f "$ROOT_DIR/.rtk/pipeline.toml" "$RTK_CFG_DIR/pipeline.toml"
  fi
  link_state_dirs
  (cd "$ROOT_DIR" && "$RTK_BIN" trust -y >/dev/null 2>&1) || true
  rm -f "$RTK_DATA_DIR/pipeline-status.json" 2>/dev/null || true
  RTK_TELEMETRY_DISABLED=1 "$RTK_BIN" init --agent antigravity --auto-patch --trust-filters </dev/null >/dev/null 2>&1 || true
  RTK_TELEMETRY_DISABLED=1 "$RTK_BIN" init -g --agent antigravity --auto-patch --trust-filters </dev/null >/dev/null 2>&1 || true
  touch "$CONTAINER_MARKER"
}

ensure_rtk_installed

if [ "$#" -eq 0 ]; then
  exec "$RTK_BIN" gain
elif [ "$1" = "ensure" ]; then
  if [ ! -f "$CONTAINER_MARKER" ]; then
    apply_setup
  fi
  exit 0
elif [ "$1" = "setup" ]; then
  write_lite_config
  apply_setup
  exec "$RTK_BIN" pipeline show
else
  exec "$RTK_BIN" "$@"
fi
