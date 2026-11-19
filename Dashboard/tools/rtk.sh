#!/usr/bin/env bash
set -euo pipefail

# Persistent wrapper & auto-bootstrapper for rtk (Rust Token Killer - https://github.com/rtk-ai/rtk)
# Configured permanently in Lite Mode:
# - Zero-overhead deterministic CLI compression (<10ms per command)
# - Lite awareness level ("default": 10-line compact rules, no heavy prompt table bloat)
# - ANSI colors & Pro hints disabled for maximum LLM token savings
# - Telemetry disabled, SQLite gzip recall store enabled
# - Pipeline: rtk:default + rtk:terse (no external LLM proxy round-trips)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RTK_BIN=""

resolve_rtk_bin() {
  if command -v rtk >/dev/null 2>&1; then
    RTK_BIN="$(command -v rtk)"
    return 0
  fi
  if [ -x "$HOME/.local/bin/rtk" ]; then
    RTK_BIN="$HOME/.local/bin/rtk"
    return 0
  fi
  if [ -x "/usr/local/bin/rtk" ]; then
    RTK_BIN="/usr/local/bin/rtk"
    return 0
  fi
  return 1
}

write_lite_config() {
  local config_dir="$HOME/.config/rtk"
  mkdir -p "$config_dir"

  cat > "$config_dir/config.toml" << 'EOF'
[tracking]
enabled = true
history_days = 90

[display]
colors = false
emoji = false
max_width = 120
pro_hint = false

[filters]
ignore_dirs = [
    ".git",
    "node_modules",
    ".next",
    "out",
    ".codebase-memory",
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
]

[retriever]
mode = "sqlite"
max_entry_bytes = 10485760
max_entries = 200
retention_days = 30
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
}

ensure_rtk_installed() {
  if resolve_rtk_bin && [ -f "$HOME/.config/rtk/config.toml" ]; then
    return 0
  fi

  if ! resolve_rtk_bin; then
    echo "[rtk] Installing rtk (Rust Token Killer)..." >&2
    curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
    ln -sf "$HOME/.local/bin/rtk" /usr/local/bin/rtk 2>/dev/null || true
    resolve_rtk_bin
  fi

  write_lite_config

  (cd "$ROOT_DIR" && "$RTK_BIN" trust -y >/dev/null 2>&1) || true
  rm -f "$HOME/.local/share/rtk/pipeline-status.json" 2>/dev/null || true
  RTK_TELEMETRY_DISABLED=1 "$RTK_BIN" init --agent antigravity --auto-patch --trust-filters </dev/null >/dev/null 2>&1 || true
  RTK_TELEMETRY_DISABLED=1 "$RTK_BIN" init -g --agent antigravity --auto-patch --trust-filters </dev/null >/dev/null 2>&1 || true
  RTK_TELEMETRY_DISABLED=1 "$RTK_BIN" init -g --gemini --auto-patch --trust-filters </dev/null >/dev/null 2>&1 || true
  RTK_TELEMETRY_DISABLED=1 "$RTK_BIN" init -g --auto-patch --trust-filters </dev/null >/dev/null 2>&1 || true
}

ensure_rtk_installed

if [ "$#" -eq 0 ]; then
  exec "$RTK_BIN" gain
elif [ "$1" = "setup" ]; then
  write_lite_config
  (cd "$ROOT_DIR" && "$RTK_BIN" trust -y >/dev/null 2>&1) || true
  rm -f "$HOME/.local/share/rtk/pipeline-status.json" 2>/dev/null || true
  RTK_TELEMETRY_DISABLED=1 "$RTK_BIN" init --agent antigravity --auto-patch --trust-filters </dev/null >/dev/null 2>&1 || true
  RTK_TELEMETRY_DISABLED=1 "$RTK_BIN" init -g --agent antigravity --auto-patch --trust-filters </dev/null >/dev/null 2>&1 || true
  RTK_TELEMETRY_DISABLED=1 "$RTK_BIN" init -g --gemini --auto-patch --trust-filters </dev/null >/dev/null 2>&1 || true
  RTK_TELEMETRY_DISABLED=1 "$RTK_BIN" init -g --auto-patch --trust-filters </dev/null >/dev/null 2>&1 || true
  exec "$RTK_BIN" pipeline show
else
  exec "$RTK_BIN" "$@"
fi
