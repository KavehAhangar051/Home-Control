#!/usr/bin/env bash
set -euo pipefail

# Persistent wrapper & auto-bootstrapper for PlatformIO Core (platformio/platformio-core).
# Stores the Python virtualenv, platforms, toolchains, frameworks, and global cache inside
# <repo>/.agent-state/platformio so container resets never lose installed ESP32/native packages,
# and fresh GitHub imports automatically bootstrap PlatformIO Core on first run.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PIO_STATE_ROOT="$ROOT_DIR/.agent-state/platformio"
PIO_VENV_DIR="$PIO_STATE_ROOT/penv"
PIO_BIN="$PIO_VENV_DIR/bin/pio"
PLATFORMIO_BIN="$PIO_VENV_DIR/bin/platformio"
PIO_CONTAINER_MARKER="/tmp/.pio_container_initialized"

export PLATFORMIO_CORE_DIR="$PIO_STATE_ROOT"

link_pio_state() {
  mkdir -p "$HOME/.local/bin" "$PIO_STATE_ROOT"

  # Migrate volatile $HOME/.platformio once if persistent store has no platforms yet
  if [ -d "$HOME/.platformio" ] && [ ! -L "$HOME/.platformio" ]; then
    if [ ! -d "$PIO_STATE_ROOT/platforms" ] && [ -d "$HOME/.platformio/platforms" ]; then
      cp -a "$HOME/.platformio/." "$PIO_STATE_ROOT/" 2>/dev/null || true
    fi
    rm -rf "$HOME/.platformio"
  fi

  ln -sfn "$PIO_STATE_ROOT" "$HOME/.platformio"

  if [ -x "$PIO_BIN" ]; then
    ln -sf "$PIO_BIN" "$HOME/.local/bin/pio" 2>/dev/null || true
    ln -sf "$PIO_BIN" /usr/local/bin/pio 2>/dev/null || true
  fi
  if [ -x "$PLATFORMIO_BIN" ]; then
    ln -sf "$PLATFORMIO_BIN" "$HOME/.local/bin/platformio" 2>/dev/null || true
    ln -sf "$PLATFORMIO_BIN" /usr/local/bin/platformio 2>/dev/null || true
  fi
}

install_pio_venv() {
  echo "[pio] Installing PlatformIO Core into $PIO_VENV_DIR..." >&2
  rm -rf "$PIO_VENV_DIR"
  python3 -m venv --without-pip "$PIO_VENV_DIR"
  local tmp_get_pip
  tmp_get_pip="$(mktemp /tmp/get-pip-XXXXXX.py)"
  curl -fsSL "https://bootstrap.pypa.io/get-pip.py" -o "$tmp_get_pip"
  "$PIO_VENV_DIR/bin/python" "$tmp_get_pip" --quiet
  rm -f "$tmp_get_pip"
  "$PIO_VENV_DIR/bin/pip" install --quiet -U platformio
}

ensure_pio_installed() {
  mkdir -p "$PIO_STATE_ROOT"
  if [ ! -x "$PIO_BIN" ] || ! "$PIO_BIN" --version >/dev/null 2>&1; then
    install_pio_venv
  fi
  link_pio_state
}

configure_pio() {
  "$PIO_BIN" settings set enable_telemetry No >/dev/null 2>&1 || true
  "$PIO_BIN" settings set check_platformio_interval 9999 >/dev/null 2>&1 || true
}

ensure_pio_installed

CMD="${1:-}"
if [ "$CMD" = "ensure" ]; then
  if [ ! -f "$PIO_CONTAINER_MARKER" ]; then
    configure_pio
    touch "$PIO_CONTAINER_MARKER"
  fi
  exit 0
elif [ "$CMD" = "setup" ]; then
  configure_pio
  echo "[pio] Installing PlatformIO environments (native, native_core3, esp32dev, esp32dev_core3)..." >&2
  "$PIO_BIN" pkg install -e native -e native_core3 -e esp32dev -e esp32dev_core3
  touch "$PIO_CONTAINER_MARKER"
  exec "$PIO_BIN" --version
else
  exec "$PIO_BIN" "$@"
fi
