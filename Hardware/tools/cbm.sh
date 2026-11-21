#!/usr/bin/env bash
set -euo pipefail

# Persistent wrapper & auto-bootstrapper for codebase-memory-mcp (DeusData/codebase-memory-mcp).
# Keeps the binary and a root-restorable cache backup inside <repo>/.agent-state/cbm
# (so container resets restore in milliseconds without uid-mismatch errors) AND persists
# <repo>/.codebase-memory/graph.db.zst so fresh GitHub imports keep the indexed graph.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CBM_STATE_ROOT="$ROOT_DIR/.agent-state/cbm"
CBM_CACHE_BIN="$CBM_STATE_ROOT/bin/codebase-memory-mcp"
CBM_CACHE_BACKUP="$CBM_STATE_ROOT/cache-backup"
CBM_HOME_CACHE="$HOME/.cache/codebase-memory-mcp"
CBM_CONTAINER_MARKER="/tmp/.cbm_container_initialized"
CBM_BIN=""

link_bin() {
  mkdir -p "$HOME/.local/bin"
  if [ -x "$CBM_CACHE_BIN" ]; then
    ln -sf "$CBM_CACHE_BIN" "$HOME/.local/bin/codebase-memory-mcp" 2>/dev/null || true
    ln -sf "$CBM_CACHE_BIN" /usr/local/bin/codebase-memory-mcp 2>/dev/null || true
    CBM_BIN="$CBM_CACHE_BIN"
    return 0
  fi
  return 1
}

restore_home_cache() {
  # CBM requires $HOME/.cache/codebase-memory-mcp to be owned by the current uid (root),
  # never symlinked inside /app/applet (uid 1000). Restore from backup copy when wiped.
  if [ -L "$CBM_HOME_CACHE" ]; then
    rm -f "$CBM_HOME_CACHE"
  fi
  mkdir -p "$CBM_HOME_CACHE"
  chown -R "$(id -u):$(id -g)" "$CBM_HOME_CACHE" 2>/dev/null || true
  chmod 700 "$CBM_HOME_CACHE" 2>/dev/null || true

  if [ ! -f "$CBM_HOME_CACHE/app-applet.db" ] && [ -d "$CBM_CACHE_BACKUP" ] && [ -n "$(ls -A "$CBM_CACHE_BACKUP" 2>/dev/null)" ]; then
    cp -a "$CBM_CACHE_BACKUP/." "$CBM_HOME_CACHE/" 2>/dev/null || true
    chown -R "$(id -u):$(id -g)" "$CBM_HOME_CACHE" 2>/dev/null || true
    chmod 700 "$CBM_HOME_CACHE" 2>/dev/null || true
  fi
}

sync_backup_and_perms() {
  mkdir -p "$CBM_CACHE_BACKUP"
  if [ -d "$CBM_HOME_CACHE" ] && [ ! -L "$CBM_HOME_CACHE" ]; then
    for f in _config.db app-applet.db activity.db; do
      if [ -f "$CBM_HOME_CACHE/$f" ]; then
        cp -f "$CBM_HOME_CACHE/$f" "$CBM_CACHE_BACKUP/$f" 2>/dev/null || true
      fi
    done
  fi
  if [ -d "$ROOT_DIR/.codebase-memory" ]; then
    chmod 755 "$ROOT_DIR/.codebase-memory" 2>/dev/null || true
    chmod 644 "$ROOT_DIR/.codebase-memory/"* "$ROOT_DIR/.codebase-memory/.gitattributes" 2>/dev/null || true
  fi
}

resolve_cbm_bin() {
  if link_bin; then
    return 0
  fi
  for cand in "$HOME/.local/bin/codebase-memory-mcp" /usr/local/bin/codebase-memory-mcp; do
    if [ -x "$cand" ] && [ ! -L "$cand" ]; then
      mkdir -p "$(dirname "$CBM_CACHE_BIN")"
      cp -f "$cand" "$CBM_CACHE_BIN"
      chmod +x "$CBM_CACHE_BIN"
      link_bin
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
  mkdir -p "$HOME/.local/bin" "$(dirname "$CBM_CACHE_BIN")" "$CBM_CACHE_BACKUP"
  restore_home_cache
  if resolve_cbm_bin; then
    return 0
  fi

  local cbm_ver="${CBM_VERSION:-v0.12.1}"
  local cbm_url="${CBM_DOWNLOAD_URL:-https://github.com/DeusData/codebase-memory-mcp/releases/download/${cbm_ver}}"
  echo "[cbm] Installing codebase-memory-mcp ${cbm_ver}..." >&2
  curl -fsSL "https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/${cbm_ver}/install.sh" \
    | CBM_DOWNLOAD_URL="$cbm_url" bash
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
  if [ ! -f "$CBM_CONTAINER_MARKER" ]; then
    "$CBM_BIN" config set auto_index true >/dev/null 2>&1 || true
    "$CBM_BIN" config set watch_non_git true >/dev/null 2>&1 || true
    ensure_cbm_daemon
    if [ ! -f "$CBM_HOME_CACHE/app-applet.db" ] || ! "$CBM_BIN" cli list_projects 2>/dev/null | grep -q "app-applet"; then
      "$CBM_BIN" cli index_repository --repo-path "$ROOT_DIR" --persistence true >/dev/null 2>&1 || true
    fi
    sync_backup_and_perms
    touch "$CBM_CONTAINER_MARKER"
  fi
  exit 0
elif [ "$CMD" = "setup" ]; then
  "$CBM_BIN" config set auto_index true >/dev/null 2>&1 || true
  "$CBM_BIN" config set watch_non_git true >/dev/null 2>&1 || true
  ensure_cbm_daemon
  "$CBM_BIN" cli index_repository --repo-path "$ROOT_DIR" --persistence true
  sync_backup_and_perms
  touch "$CBM_CONTAINER_MARKER"
elif [ "$CMD" = "index" ]; then
  shift || true
  ensure_cbm_daemon
  "$CBM_BIN" cli index_repository --repo-path "$ROOT_DIR" --persistence true "$@"
  sync_backup_and_perms
elif [ "$CMD" = "cli" ]; then
  shift || true
  ensure_cbm_daemon
  exec "$CBM_BIN" cli "$@"
else
  exec "$CBM_BIN" "$@"
fi
