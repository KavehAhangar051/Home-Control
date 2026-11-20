#!/usr/bin/env bash
set -euo pipefail

# Persistent wrapper & auto-bootstrapper for codebase-memory-mcp (DeusData/codebase-memory-mcp).
# Ensures the native binary is installed on PATH, persistent settings are applied,
# and the project knowledge graph (.codebase-memory/graph.db.zst) is indexed and ready.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CBM_CACHE_BIN="$ROOT_DIR/.agent-state/cbm/bin/codebase-memory-mcp"
CBM_BIN=""

resolve_cbm_bin() {
  if [ -x "$CBM_CACHE_BIN" ]; then
    ln -sf "$CBM_CACHE_BIN" "$HOME/.local/bin/codebase-memory-mcp" 2>/dev/null || true
    ln -sf "$CBM_CACHE_BIN" /usr/local/bin/codebase-memory-mcp 2>/dev/null || true
    CBM_BIN="$CBM_CACHE_BIN"
    return 0
  fi
  for cand in "$HOME/.local/bin/codebase-memory-mcp" /usr/local/bin/codebase-memory-mcp; do
    if [ -x "$cand" ] && [ ! -L "$cand" ]; then
      mkdir -p "$(dirname "$CBM_CACHE_BIN")"
      cp -f "$cand" "$CBM_CACHE_BIN"
      chmod +x "$CBM_CACHE_BIN"
      ln -sf "$CBM_CACHE_BIN" /usr/local/bin/codebase-memory-mcp 2>/dev/null || true
      CBM_BIN="$CBM_CACHE_BIN"
      return 0
    fi
  done
  if command -v codebase-memory-mcp >/dev/null 2>&1; then
    CBM_BIN="$(command -v codebase-memory-mcp)"
    return 0
  fi
  return 1
}

ensure_cbm_installed() {
  mkdir -p "$HOME/.local/bin" "$(dirname "$CBM_CACHE_BIN")"
  if resolve_cbm_bin; then
    return 0
  fi

  local cbm_ver="${CBM_VERSION:-v0.12.1}"
  local cbm_url="${CBM_DOWNLOAD_URL:-https://github.com/DeusData/codebase-memory-mcp/releases/download/${cbm_ver}}"
  echo "[cbm] Installing codebase-memory-mcp ${cbm_ver}..." >&2
  curl -fsSL "https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/${cbm_ver}/install.sh" | CBM_DOWNLOAD_URL="$cbm_url" bash
  if [ -x "$HOME/.local/bin/codebase-memory-mcp" ] && [ ! -L "$HOME/.local/bin/codebase-memory-mcp" ]; then
    mv -f "$HOME/.local/bin/codebase-memory-mcp" "$CBM_CACHE_BIN"
    chmod +x "$CBM_CACHE_BIN"
  fi
  resolve_cbm_bin
  "$CBM_BIN" config set auto_index true >/dev/null 2>&1 || true
  "$CBM_BIN" config set watch_non_git true >/dev/null 2>&1 || true
}

ensure_cbm_installed

ensure_cbm_daemon() {
  "$CBM_BIN" daemon start >/dev/null 2>&1 || true
}

CMD="${1:-cli}"
if [ "$CMD" = "ensure" ]; then
  exit 0
elif [ "$CMD" = "index" ]; then
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
