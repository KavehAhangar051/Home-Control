#!/usr/bin/env bash
set -euo pipefail

# Persistent wrapper & offline-resilient auto-bootstrapper for volcengine/OpenViking
# Stores uv, Python venv (openviking + openviking-sdk + vikingbot), @openviking/cli,
# official plugin/hook bundles, configs (~/.openviking), and workspace data inside
# <repo>/.agent-state/openviking so container resets never wipe OpenViking or its memory.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OV_STATE="$ROOT_DIR/.agent-state/openviking"
OV_BIN_DIR="$OV_STATE/bin"
OV_VENV="$OV_STATE/venv"
OV_CLI_DIR="$OV_STATE/cli"
OV_HOME="$OV_STATE/home"
OV_DATA="$OV_STATE/data"
OV_LOG_DIR="$OV_HOME/logs"
OV_PLUGIN_DIR="$ROOT_DIR/.agents/plugins/openviking"
OV_BUNDLE_DIR="$OV_STATE/plugin-bundle"
OV_HOOK_ENTRY="$OV_BUNDLE_DIR/hook-plugin/scripts/hook.mjs"
OV_DOCTOR_ENTRY="$OV_BUNDLE_DIR/hook-plugin/scripts/ov-memory-doctor.mjs"
OV_MCP_ENTRY="$OV_PLUGIN_DIR/servers/mcp-proxy.mjs"
OV_VERSION="${OV_VERSION:-v0.5.5}"

export OPENVIKING_LANG="${OPENVIKING_LANG:-en}"

has_python310() {
  python3 -E -S -c 'import sys; sys.exit(sys.version_info < (3, 10))' >/dev/null 2>&1
}

ensure_dirs_and_configs() {
  mkdir -p "$OV_BIN_DIR" "$OV_HOME" "$OV_DATA" "$OV_LOG_DIR" "$HOME/.local/bin"

  # Migrate volatile ~/.openviking into persistent workspace vault once
  if [ -d "$HOME/.openviking" ] && [ ! -L "$HOME/.openviking" ]; then
    cp -an "$HOME/.openviking/." "$OV_HOME/" 2>/dev/null || true
    rm -rf "$HOME/.openviking"
  fi
  ln -sfn "$OV_HOME" "$HOME/.openviking"
  chmod 700 "$OV_HOME" 2>/dev/null || true

  if [ ! -f "$OV_HOME/ovcli.settings.conf" ]; then
    printf '{\n  "language": "en"\n}\n' > "$OV_HOME/ovcli.settings.conf"
  fi

  if [ ! -f "$OV_HOME/ovcli.conf" ]; then
    cat > "$OV_HOME/ovcli.conf" << 'EOF'
{
  "url": "http://127.0.0.1:1933",
  "output": "table",
  "timeout": 60.0
}
EOF
  fi
  chmod 600 "$OV_HOME/ovcli.conf" 2>/dev/null || true
}

create_launchers_and_links() {
  ensure_dirs_and_configs

  if [ -x "$OV_BIN_DIR/uv" ]; then
    ln -sf "$OV_BIN_DIR/uv" "$HOME/.local/bin/uv" 2>/dev/null || true
    ln -sf "$OV_BIN_DIR/uv" /usr/local/bin/uv 2>/dev/null || true
  fi

  cat > "$OV_BIN_DIR/ov" << EOF
#!/bin/sh
export OPENVIKING_LANG="\${OPENVIKING_LANG:-en}"
exec "$OV_VENV/bin/ov" "\$@"
EOF
  cat > "$OV_BIN_DIR/ov-node" << EOF
#!/bin/sh
export OPENVIKING_LANG="\${OPENVIKING_LANG:-en}"
exec "$OV_CLI_DIR/node_modules/.bin/ov" "\$@"
EOF
  cat > "$OV_BIN_DIR/openviking-server" << EOF
#!/bin/sh
exec "$OV_VENV/bin/openviking-server" "\$@"
EOF
  cat > "$OV_BIN_DIR/openviking-gateway" << EOF
#!/bin/sh
exec "$OV_VENV/bin/openviking-gateway" "\$@"
EOF
  cat > "$OV_BIN_DIR/vikingbot" << EOF
#!/bin/sh
exec "$OV_VENV/bin/vikingbot" "\$@"
EOF
  cat > "$OV_BIN_DIR/ov-python" << EOF
#!/bin/sh
exec "$OV_VENV/bin/python" "\$@"
EOF
  cat > "$OV_BIN_DIR/ov-mcp" << EOF
#!/bin/sh
exec node "$OV_MCP_ENTRY" "\$@"
EOF
  cat > "$OV_BIN_DIR/ov-hook" << EOF
#!/bin/sh
exec bash "$ROOT_DIR/tools/ov.sh" hook "\$@"
EOF
  cat > "$OV_BIN_DIR/ov-doctor" << EOF
#!/bin/sh
exec bash "$ROOT_DIR/tools/ov.sh" doctor "\$@"
EOF

  chmod +x \
    "$OV_BIN_DIR/ov" \
    "$OV_BIN_DIR/ov-node" \
    "$OV_BIN_DIR/openviking-server" \
    "$OV_BIN_DIR/openviking-gateway" \
    "$OV_BIN_DIR/vikingbot" \
    "$OV_BIN_DIR/ov-python" \
    "$OV_BIN_DIR/ov-mcp" \
    "$OV_BIN_DIR/ov-hook" \
    "$OV_BIN_DIR/ov-doctor"

  for name in ov ov-node openviking-server openviking-gateway vikingbot ov-python ov-mcp ov-hook ov-doctor; do
    ln -sf "$OV_BIN_DIR/$name" "$HOME/.local/bin/$name" 2>/dev/null || true
    ln -sf "$OV_BIN_DIR/$name" "/usr/local/bin/$name" 2>/dev/null || true
  done
}

install_from_upstream() {
  if ! has_python310; then
    echo "[ov] Error: Python >= 3.10 is required for OpenViking." >&2
    exit 1
  fi

  mkdir -p "$OV_STATE" "$OV_BIN_DIR" "$OV_CLI_DIR"

  if [ ! -x "$OV_BIN_DIR/uv" ]; then
    echo "[ov] Installing uv..." >&2
    curl -LsSf https://astral.sh/uv/install.sh | env UV_UNMANAGED_INSTALL="$OV_BIN_DIR" sh
  fi

  if [ ! -x "$OV_VENV/bin/python" ]; then
    echo "[ov] Creating Python 3.11 virtual environment..." >&2
    "$OV_BIN_DIR/uv" venv "$OV_VENV" --python python3
  fi

  echo "[ov] Installing openviking[gateway-fast,gemini-async,bot] and openviking-sdk..." >&2
  "$OV_BIN_DIR/uv" pip install --python "$OV_VENV/bin/python" --upgrade \
    "openviking[gateway-fast,gemini-async,bot]" openviking-sdk

  if [ ! -x "$OV_CLI_DIR/node_modules/.bin/ov" ]; then
    echo "[ov] Installing @openviking/cli..." >&2
    npm --prefix "$OV_CLI_DIR" install --no-save @openviking/cli >/dev/null 2>&1 || true
  fi

  if [ ! -f "$OV_HOOK_ENTRY" ] || [ ! -f "$OV_MCP_ENTRY" ]; then
    echo "[ov] Syncing official OpenViking plugin, MCP proxy, hooks, and skills (${OV_VERSION})..." >&2
    local tmp_src=""
    tmp_src="$(mktemp -d)"
    trap 'rm -rf "$tmp_src"' RETURN
    git clone --depth 1 --branch "$OV_VERSION" --filter=blob:none --sparse --quiet \
      https://github.com/volcengine/OpenViking.git "$tmp_src/ov"
    git -C "$tmp_src/ov" sparse-checkout set agent-plugins examples/agent-hook-plugin examples/memory-plugin-shared/lib

    rm -rf "$OV_BUNDLE_DIR"
    mkdir -p "$OV_BUNDLE_DIR/hook-plugin" "$OV_BUNDLE_DIR/memory-plugin-shared/lib"
    cp -a "$tmp_src/ov/agent-plugins/." "$OV_BUNDLE_DIR/"

    if [ ! -f "$tmp_src/ov/examples/agent-hook-plugin/hosts/antigravity.mjs" ]; then
      git clone --depth 1 --branch main --filter=blob:none --sparse --quiet \
        https://github.com/volcengine/OpenViking.git "$tmp_src/ov-hooks"
      git -C "$tmp_src/ov-hooks" sparse-checkout set examples/agent-hook-plugin examples/memory-plugin-shared/lib
      cp -a "$tmp_src/ov-hooks/examples/agent-hook-plugin/." "$OV_BUNDLE_DIR/hook-plugin/"
      cp -a "$tmp_src/ov-hooks/examples/memory-plugin-shared/lib/." "$OV_BUNDLE_DIR/memory-plugin-shared/lib/"
    else
      cp -a "$tmp_src/ov/examples/agent-hook-plugin/." "$OV_BUNDLE_DIR/hook-plugin/"
      cp -a "$tmp_src/ov/examples/memory-plugin-shared/lib/." "$OV_BUNDLE_DIR/memory-plugin-shared/lib/"
    fi

    mkdir -p "$OV_PLUGIN_DIR/servers" "$OV_PLUGIN_DIR/skills" "$OV_PLUGIN_DIR/rules"
    cp -a "$OV_BUNDLE_DIR/plugin.json" "$OV_PLUGIN_DIR/plugin.json"
    cp -a "$OV_BUNDLE_DIR/mcp.json" "$OV_PLUGIN_DIR/mcp.json"
    cp -a "$OV_BUNDLE_DIR/README.md" "$OV_PLUGIN_DIR/README.md"
    cp -a "$OV_BUNDLE_DIR/plugin.test.mjs" "$OV_PLUGIN_DIR/plugin.test.mjs"
    cp -a "$OV_BUNDLE_DIR/servers/." "$OV_PLUGIN_DIR/servers/"
    cp -a "$OV_BUNDLE_DIR/skills/." "$OV_PLUGIN_DIR/skills/"

    for s in openviking-memory openviking-rule-search openviking-skills ov-experience-memory ov-kanban ov-memory-troubleshoot ov-resources; do
      rm -rf "$ROOT_DIR/agents/skills/$s"
      cp -a "$OV_BUNDLE_DIR/skills/$s" "$ROOT_DIR/agents/skills/$s"
    done
  fi

  create_launchers_and_links
}

is_ov_installed() {
  [ -x "$OV_VENV/bin/ov" ] \
    && [ -x "$OV_VENV/bin/openviking-server" ] \
    && [ -x "$OV_VENV/bin/vikingbot" ] \
    && [ -f "$OV_MCP_ENTRY" ] \
    && [ -f "$OV_HOOK_ENTRY" ]
}

ensure_ov_installed() {
  if is_ov_installed; then
    if [ ! -L "$HOME/.openviking" ] \
      || [ ! -x /usr/local/bin/ov ] \
      || [ ! -x /usr/local/bin/openviking-server ] \
      || [ ! -x /usr/local/bin/ov-mcp ]; then
      create_launchers_and_links
    fi
    return 0
  fi

  install_from_upstream
}

run_doctor() {
  ensure_ov_installed
  echo "=== OpenViking CLI & Runtime ==="
  "$OV_BIN_DIR/ov" --version
  if [ -x "$OV_CLI_DIR/node_modules/.bin/ov" ]; then
    echo "ov-node: $("$OV_CLI_DIR/node_modules/.bin/ov" --version)"
  fi
  echo "=== Plugin & MCP Conformance ==="
  node --test "$OV_PLUGIN_DIR/plugin.test.mjs"
  echo "=== OpenViking Server Doctor ==="
  "$OV_BIN_DIR/ov" doctor || true
  if [ -f "$OV_DOCTOR_ENTRY" ]; then
    echo "=== OpenViking Memory Plugin Doctor ==="
    node "$OV_DOCTOR_ENTRY" --offline || true
  fi
}

manage_server() {
  ensure_ov_installed
  local sub="${1:-status}"
  shift || true
  local pid_file="$OV_LOG_DIR/openviking-server.pid"
  local log_file="$OV_LOG_DIR/openviking-server.log"

  case "$sub" in
    init)
      exec "$OV_BIN_DIR/openviking-server" init "$@"
      ;;
    fg|foreground)
      if [ ! -f "$OV_HOME/ov.conf" ]; then
        echo "[ov] Missing $OV_HOME/ov.conf. Run 'openviking-server init' or create ~/.openviking/ov.conf first." >&2
        return 1
      fi
      exec "$OV_BIN_DIR/openviking-server" --config "$OV_HOME/ov.conf" "$@"
      ;;
    start)
      if [ ! -f "$OV_HOME/ov.conf" ]; then
        echo "[ov] Missing $OV_HOME/ov.conf. Configure ~/.openviking/ov.conf (or run 'openviking-server init') before starting the server." >&2
        return 1
      fi
      if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
        echo "[ov] openviking-server already running (PID $(cat "$pid_file"))."
        return 0
      fi
      nohup "$OV_BIN_DIR/openviking-server" --config "$OV_HOME/ov.conf" "$@" >"$log_file" 2>&1 &
      echo $! > "$pid_file"
      sleep 1
      if kill -0 "$(cat "$pid_file")" 2>/dev/null; then
        echo "[ov] openviking-server started (PID $(cat "$pid_file"), log: $log_file)."
      else
        echo "[ov] openviking-server failed to start. Check $log_file" >&2
        tail -n 30 "$log_file" >&2 || true
        return 1
      fi
      ;;
    stop)
      if [ -f "$pid_file" ]; then
        local pid
        pid="$(cat "$pid_file")"
        if kill -0 "$pid" 2>/dev/null; then
          kill "$pid" 2>/dev/null || true
          sleep 1
          kill -9 "$pid" 2>/dev/null || true
          echo "[ov] openviking-server stopped (PID $pid)."
        fi
        rm -f "$pid_file"
      else
        echo "[ov] openviking-server is not running."
      fi
      ;;
    status)
      if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
        echo "[ov] openviking-server running (PID $(cat "$pid_file"))."
        "$OV_BIN_DIR/ov" health || true
      else
        echo "[ov] openviking-server not running (ov.conf present: $([ -f "$OV_HOME/ov.conf" ] && echo yes || echo no))."
      fi
      ;;
    *)
      exec "$OV_BIN_DIR/openviking-server" "$sub" "$@"
      ;;
  esac
}

run_hook() {
  ensure_ov_installed
  local event="${1:-}"
  local client="${2:-antigravity}"
  if [ ! -f "$OV_HOOK_ENTRY" ]; then
    exit 0
  fi
  # If no server is reachable and no ov.conf / remote url is customized, degrade gracefully
  node "$OV_HOOK_ENTRY" "$event" "$client" || exit 0
}

CMD="${1:-}"

case "$CMD" in
  "")
    ensure_ov_installed
    exec "$OV_BIN_DIR/ov" --version
    ;;
  ensure)
    ensure_ov_installed
    exit 0
    ;;
  setup)
    shift || true
    ensure_ov_installed
    create_launchers_and_links
    run_doctor "$@"
    ;;
  update)
    shift || true
    rm -rf "$OV_BUNDLE_DIR"
    install_from_upstream
    run_doctor "$@"
    ;;
  doctor)
    shift || true
    run_doctor "$@"
    ;;
  server)
    shift || true
    manage_server "$@"
    ;;
  mcp)
    shift || true
    ensure_ov_installed
    exec node "$OV_MCP_ENTRY" "$@"
    ;;
  bot|vikingbot)
    shift || true
    ensure_ov_installed
    exec "$OV_BIN_DIR/vikingbot" "$@"
    ;;
  python)
    shift || true
    ensure_ov_installed
    exec "$OV_VENV/bin/python" "$@"
    ;;
  hook)
    shift || true
    run_hook "$@"
    ;;
  *)
    ensure_ov_installed
    exec "$OV_BIN_DIR/ov" "$@"
    ;;
esac
