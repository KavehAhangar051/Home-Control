#!/usr/bin/env bash
set -euo pipefail

# Persistent wrapper & auto-bootstrapper for codebase-memory-mcp (DeusData/codebase-memory-mcp).
# Ensures the native binary is installed on PATH, persistent settings are applied,
# and the project knowledge graph (.codebase-memory/graph.db.zst) is indexed and ready.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CBM_BIN=""

resolve_cbm_bin() {
  if command -v codebase-memory-mcp >/dev/null 2>&1; then
    CBM_BIN="$(command -v codebase-memory-mcp)"
    return 0
  fi
  if [ -x "$HOME/.local/bin/codebase-memory-mcp" ]; then
    CBM_BIN="$HOME/.local/bin/codebase-memory-mcp"
    return 0
  fi
  if [ -x "/usr/local/bin/codebase-memory-mcp" ]; then
    CBM_BIN="/usr/local/bin/codebase-memory-mcp"
    return 0
  fi
  return 1
}

ensure_cbm_installed() {
  if resolve_cbm_bin; then
    return 0
  fi

  echo "[cbm] Installing codebase-memory-mcp..." >&2
  curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash
  ln -sf "$HOME/.local/bin/codebase-memory-mcp" /usr/local/bin/codebase-memory-mcp 2>/dev/null || true
  resolve_cbm_bin
  "$CBM_BIN" config set auto_index true >/dev/null 2>&1 || true
  "$CBM_BIN" config set watch_non_git true >/dev/null 2>&1 || true
}

ensure_cbm_installed

ensure_cbm_daemon() {
  "$CBM_BIN" daemon start >/dev/null 2>&1 || true
}

CMD="${1:-cli}"
if [ "$CMD" = "index" ]; then
  shift || true
  ensure_cbm_daemon
  exec "$CBM_BIN" cli index_repository --repo-path "$ROOT_DIR" --persistence true "$@"
elif [ "$CMD" = "cli" ]; then
  shift || true
  ensure_cbm_daemon
  exec "$CBM_BIN" cli "$@"
else
  exec "$CBM_BIN" "$@"
fi
