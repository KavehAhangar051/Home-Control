#!/usr/bin/env bash
set -euo pipefail

# Persistent wrapper & offline-resilient auto-bootstrapper for volcengine/OpenViking + CPU-only Ollama.
# Stores uv, Python venv (openviking + openviking-sdk + vikingbot), @openviking/cli, CPU-only Ollama + models,
# official plugin/hook bundles, configs (~/.openviking), and workspace data inside <repo>/.agent-state/openviking
# so container resets never wipe OpenViking or exceed the 12 GiB RAM / tmpfs container budget.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OV_STATE="$ROOT_DIR/.agent-state/openviking"
OV_BIN_DIR="$OV_STATE/bin"
OV_VENV="$OV_STATE/venv"
OV_CLI_DIR="$OV_STATE/cli"
OV_HOME="$OV_STATE/home"
OV_DATA="$OV_STATE/data"
OV_LOG_DIR="$OV_HOME/logs"
OV_OLLAMA_DIR="$OV_STATE/ollama"
OV_OLLAMA_BIN="$OV_OLLAMA_DIR/bin/ollama"
OV_OLLAMA_MODELS="$OV_OLLAMA_DIR/models"
OV_OLLAMA_HOST="${OV_OLLAMA_HOST:-127.0.0.1}"
OV_OLLAMA_PORT="${OV_OLLAMA_PORT:-11434}"
OV_OLLAMA_URL="${OV_OLLAMA_URL:-http://${OV_OLLAMA_HOST}:${OV_OLLAMA_PORT}}"
OV_EMBEDDING_MODEL="${OV_EMBEDDING_MODEL:-qwen3-embedding:0.6b}"
OV_VLM_MODEL="${OV_VLM_MODEL:-qwen3.5:4b}"
OV_QUERY_PLANNER_MODEL="${OV_QUERY_PLANNER_MODEL:-guoxuter/ov_intent_analysis_sft:v7_q8}"
OV_SERVER_HOST="${OV_SERVER_HOST:-127.0.0.1}"
OV_SERVER_PORT="${OV_SERVER_PORT:-1933}"
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

export_ollama_env() {
  export OLLAMA_MODELS="$OV_OLLAMA_MODELS"
  export OLLAMA_HOST="${OV_OLLAMA_HOST}:${OV_OLLAMA_PORT}"
  export OLLAMA_MAX_LOADED_MODELS="${OLLAMA_MAX_LOADED_MODELS:-1}"
  export OLLAMA_NUM_PARALLEL="${OLLAMA_NUM_PARALLEL:-1}"
  export OLLAMA_FLASH_ATTENTION="${OLLAMA_FLASH_ATTENTION:-1}"
  export OLLAMA_KV_CACHE_TYPE="${OLLAMA_KV_CACHE_TYPE:-q8_0}"
  export OLLAMA_KEEP_ALIVE="${OLLAMA_KEEP_ALIVE:-2m}"
  export OLLAMA_LOAD_TIMEOUT="${OLLAMA_LOAD_TIMEOUT:-5m}"
}

strip_unused_ollama_gpu_libs() {
  local lib_dir="$OV_OLLAMA_DIR/lib/ollama"
  if [ -d "$lib_dir" ]; then
    rm -rf "$lib_dir"/cuda* "$lib_dir"/vulkan* "$lib_dir"/rocm* 2>/dev/null || true
  fi
}

write_default_ov_conf() {
  cat > "$OV_HOME/ov.conf" << EOF
{
  "storage": {
    "workspace": "$OV_DATA"
  },
  "server": {
    "host": "$OV_SERVER_HOST",
    "port": $OV_SERVER_PORT,
    "workers": 1
  },
  "embedding": {
    "dense": {
      "provider": "ollama",
      "model": "$OV_EMBEDDING_MODEL",
      "api_base": "http://localhost:${OV_OLLAMA_PORT}/v1",
      "dimension": 1024,
      "input": "text"
    },
    "max_concurrent": 1,
    "max_retries": 3
  },
  "vlm": {
    "provider": "litellm",
    "model": "ollama/${OV_VLM_MODEL}",
    "api_key": "no-key",
    "api_base": "http://localhost:${OV_OLLAMA_PORT}",
    "temperature": 0.0,
    "max_retries": 2,
    "max_concurrent": 1,
    "timeout": 600.0,
    "extra_request_body": {
      "num_ctx": 8192,
      "think": false
    }
  },
  "query_planner": {
    "provider": "litellm",
    "model": "ollama/${OV_QUERY_PLANNER_MODEL}",
    "api_key": "no-key",
    "api_base": "http://localhost:${OV_OLLAMA_PORT}",
    "temperature": 0.0,
    "timeout": 60.0,
    "max_concurrent": 1,
    "extra_request_body": {
      "think": false
    }
  },
  "retrieval": {
    "recall_intent_timeout_s": 20.0,
    "recall_rewrite_timeout_s": 60.0
  }
}
EOF
}

ensure_dirs_and_configs() {
  mkdir -p "$OV_BIN_DIR" "$OV_HOME" "$OV_DATA" "$OV_LOG_DIR" "$OV_OLLAMA_MODELS" "$HOME/.local/bin"

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
    cat > "$OV_HOME/ovcli.conf" << EOF
{
  "url": "http://${OV_SERVER_HOST}:${OV_SERVER_PORT}",
  "output": "table",
  "timeout": 60.0
}
EOF
  fi

  if [ ! -f "$OV_HOME/ov.conf" ]; then
    write_default_ov_conf
  fi

  chmod 600 "$OV_HOME/ovcli.conf" "$OV_HOME/ov.conf" 2>/dev/null || true
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
  cat > "$OV_BIN_DIR/ollama" << EOF
#!/bin/sh
export OLLAMA_MODELS="\${OLLAMA_MODELS:-$OV_OLLAMA_MODELS}"
export OLLAMA_HOST="\${OLLAMA_HOST:-${OV_OLLAMA_HOST}:${OV_OLLAMA_PORT}}"
export OLLAMA_MAX_LOADED_MODELS="\${OLLAMA_MAX_LOADED_MODELS:-1}"
export OLLAMA_NUM_PARALLEL="\${OLLAMA_NUM_PARALLEL:-1}"
export OLLAMA_FLASH_ATTENTION="\${OLLAMA_FLASH_ATTENTION:-1}"
export OLLAMA_KV_CACHE_TYPE="\${OLLAMA_KV_CACHE_TYPE:-q8_0}"
export OLLAMA_KEEP_ALIVE="\${OLLAMA_KEEP_ALIVE:-2m}"
export OLLAMA_LOAD_TIMEOUT="\${OLLAMA_LOAD_TIMEOUT:-5m}"
exec "$OV_OLLAMA_BIN" "\$@"
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
    "$OV_BIN_DIR/ov-doctor" \
    "$OV_BIN_DIR/ollama"

  for name in ov ov-node openviking-server openviking-gateway vikingbot ov-python ov-mcp ov-hook ov-doctor ollama; do
    ln -sf "$OV_BIN_DIR/$name" "$HOME/.local/bin/$name" 2>/dev/null || true
    ln -sf "$OV_BIN_DIR/$name" "/usr/local/bin/$name" 2>/dev/null || true
  done
}

ensure_ollama_installed() {
  strip_unused_ollama_gpu_libs
  if [ -x "$OV_OLLAMA_BIN" ]; then
    return 0
  fi

  local arch=""
  case "$(uname -m)" in
    x86_64|amd64) arch="amd64" ;;
    aarch64|arm64) arch="arm64" ;;
    *)
      echo "[ov] Unsupported architecture for Ollama: $(uname -m)" >&2
      return 1
      ;;
  esac

  mkdir -p "$OV_OLLAMA_DIR" "$OV_OLLAMA_MODELS"
  local url="https://ollama.com/download/ollama-linux-${arch}.tar.zst"
  echo "[ov] Installing CPU-only Ollama (${arch}, stripping GPU libs to preserve 12 GiB RAM)..." >&2

  if command -v zstd >/dev/null 2>&1; then
    curl -fsSL "$url" | zstd -d -c | tar -x -C "$OV_OLLAMA_DIR" \
      --exclude='lib/ollama/cuda*' --exclude='lib/ollama/vulkan*' --exclude='lib/ollama/rocm*'
  else
    if ! "$OV_VENV/bin/python" -c "import zstandard" >/dev/null 2>&1; then
      "$OV_BIN_DIR/uv" pip install --no-cache --python "$OV_VENV/bin/python" zstandard
    fi
    curl -fsSL "$url" | "$OV_VENV/bin/python" -c '
import sys, zstandard
dctx = zstandard.ZstdDecompressor()
dctx.copy_stream(sys.stdin.buffer, sys.stdout.buffer)
' | tar -x -C "$OV_OLLAMA_DIR" \
      --exclude='lib/ollama/cuda*' --exclude='lib/ollama/vulkan*' --exclude='lib/ollama/rocm*'
  fi

  strip_unused_ollama_gpu_libs
  chmod +x "$OV_OLLAMA_BIN" 2>/dev/null || true
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

  echo "[ov] Installing openviking[gateway-fast,gemini-async,bot], openviking-sdk, and zstandard (--no-cache)..." >&2
  "$OV_BIN_DIR/uv" pip install --no-cache --python "$OV_VENV/bin/python" --upgrade \
    "openviking[gateway-fast,gemini-async,bot]" openviking-sdk zstandard

  if [ ! -x "$OV_CLI_DIR/node_modules/.bin/ov" ]; then
    echo "[ov] Installing @openviking/cli..." >&2
    local tmp_npm=""
    tmp_npm="$(mktemp -d)"
    npm --prefix "$OV_CLI_DIR" --cache "$tmp_npm" install --no-save @openviking/cli >/dev/null 2>&1 || true
    rm -rf "$tmp_npm"
  fi

  if [ ! -f "$OV_HOOK_ENTRY" ] || [ ! -f "$OV_MCP_ENTRY" ]; then
    echo "[ov] Syncing official OpenViking plugin, MCP proxy, hooks, and skills (${OV_VERSION})..." >&2
    local tmp_src=""
    tmp_src="$(mktemp -d)"
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

    rm -rf "$tmp_src"
  fi

  ensure_ollama_installed
  create_launchers_and_links
}

is_ov_installed() {
  [ -x "$OV_VENV/bin/ov" ] \
    && [ -x "$OV_VENV/bin/openviking-server" ] \
    && [ -x "$OV_VENV/bin/vikingbot" ] \
    && [ -x "$OV_OLLAMA_BIN" ] \
    && [ -f "$OV_MCP_ENTRY" ] \
    && [ -f "$OV_HOOK_ENTRY" ]
}

ensure_ov_installed() {
  if is_ov_installed; then
    strip_unused_ollama_gpu_libs
    if [ ! -L "$HOME/.openviking" ] \
      || [ ! -f "$OV_HOME/ov.conf" ] \
      || [ ! -x "$OV_BIN_DIR/ollama" ] \
      || [ ! -x /usr/local/bin/ov ] \
      || [ ! -x /usr/local/bin/openviking-server ] \
      || [ ! -x /usr/local/bin/ov-mcp ] \
      || [ ! -x /usr/local/bin/ollama ]; then
      create_launchers_and_links
    fi
    return 0
  fi

  install_from_upstream
}

is_ollama_running() {
  curl -sf --max-time 2 "${OV_OLLAMA_URL}/api/tags" >/dev/null 2>&1
}

is_server_running() {
  curl -sf --max-time 2 "http://${OV_SERVER_HOST}:${OV_SERVER_PORT}/health" >/dev/null 2>&1
}

start_ollama_daemon() {
  ensure_ov_installed
  export_ollama_env

  if is_ollama_running; then
    return 0
  fi

  mkdir -p "$OV_LOG_DIR"
  local pid_file="$OV_LOG_DIR/ollama.pid"
  local log_file="$OV_LOG_DIR/ollama.log"

  nohup "$OV_BIN_DIR/ollama" serve >"$log_file" 2>&1 &
  echo $! > "$pid_file"

  for _ in $(seq 1 30); do
    if is_ollama_running; then
      return 0
    fi
    sleep 0.5
  done

  echo "[ov] Ollama failed to become ready at ${OV_OLLAMA_URL}. Check $log_file" >&2
  tail -n 20 "$log_file" >&2 || true
  return 1
}

stop_ollama_daemon() {
  local pid_file="$OV_LOG_DIR/ollama.pid"
  local killed=0
  if [ -f "$pid_file" ]; then
    local pid=""
    pid="$(cat "$pid_file")"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      sleep 1
      kill -9 "$pid" 2>/dev/null || true
      killed=1
    fi
    rm -f "$pid_file"
  fi
  if [ "$killed" -eq 0 ] && command -v pkill >/dev/null 2>&1; then
    pkill -f "${OV_OLLAMA_BIN} serve" 2>/dev/null || true
    sleep 1
  fi
}

list_ollama_model_names() {
  curl -sf --max-time 5 "${OV_OLLAMA_URL}/api/tags" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
    for m in data.get("models", []):
        print(m.get("name", ""))
except Exception:
    pass
'
}

ensure_ollama_models() {
  start_ollama_daemon
  export_ollama_env

  local installed=""
  installed="$(list_ollama_model_names || true)"

  # Remove oversized qwen3-embedding:4b if present so the 12 GiB RAM cap is protected
  if printf '%s\n' "$installed" | grep -qx "qwen3-embedding:4b"; then
    echo "[ov] Removing oversized qwen3-embedding:4b to protect 12 GiB RAM budget..." >&2
    "$OV_BIN_DIR/ollama" rm qwen3-embedding:4b >/dev/null 2>&1 || true
  fi

  local model=""
  for model in "$OV_EMBEDDING_MODEL" "$OV_VLM_MODEL" "$OV_QUERY_PLANNER_MODEL"; do
    if ! printf '%s\n' "$installed" | grep -qx "$model"; then
      echo "[ov] Pulling local Ollama model: $model..." >&2
      "$OV_BIN_DIR/ollama" pull "$model"
    fi
  done
}

manage_ollama() {
  ensure_ov_installed
  export_ollama_env
  local sub="${1:-status}"
  shift || true

  case "$sub" in
    start)
      if start_ollama_daemon; then
        echo "[ov] Ollama running at ${OV_OLLAMA_URL} (models: $OV_OLLAMA_MODELS, max_loaded=$OLLAMA_MAX_LOADED_MODELS)."
      fi
      ;;
    stop)
      stop_ollama_daemon
      echo "[ov] Ollama stopped."
      ;;
    restart)
      stop_ollama_daemon
      start_ollama_daemon
      echo "[ov] Ollama restarted at ${OV_OLLAMA_URL}."
      ;;
    ensure-models)
      ensure_ollama_models
      echo "[ov] Verified Ollama models: $OV_EMBEDDING_MODEL, $OV_VLM_MODEL, $OV_QUERY_PLANNER_MODEL."
      ;;
    status)
      local ver=""
      ver="$("$OV_BIN_DIR/ollama" --version 2>/dev/null | head -n 1 || true)"
      if is_ollama_running; then
        local models_csv=""
        models_csv="$(list_ollama_model_names | paste -sd ', ' -)"
        echo "[ov] Ollama running at ${OV_OLLAMA_URL} (${ver:-ok}; models: ${models_csv:-none})."
      else
        echo "[ov] Ollama stopped (${ver:-installed})."
      fi
      ;;
    ps|list|pull|rm|run|show)
      exec "$OV_BIN_DIR/ollama" "$sub" "$@"
      ;;
    *)
      exec "$OV_BIN_DIR/ollama" "$sub" "$@"
      ;;
  esac
}

run_doctor() {
  ensure_ov_installed
  start_ollama_daemon || true
  echo "=== OpenViking CLI & Runtime ==="
  "$OV_BIN_DIR/ov" --version
  if [ -x "$OV_CLI_DIR/node_modules/.bin/ov" ]; then
    echo "ov-node: $("$OV_CLI_DIR/node_modules/.bin/ov" --version)"
  fi
  echo "=== Ollama Local Runtime ==="
  manage_ollama status
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
  export_ollama_env
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
        echo "[ov] Missing $OV_HOME/ov.conf." >&2
        return 1
      fi
      ensure_ollama_models
      exec "$OV_BIN_DIR/openviking-server" --config "$OV_HOME/ov.conf" "$@"
      ;;
    start)
      if [ ! -f "$OV_HOME/ov.conf" ]; then
        echo "[ov] Missing $OV_HOME/ov.conf." >&2
        return 1
      fi
      ensure_ollama_models
      if is_server_running; then
        echo "[ov] openviking-server already healthy at http://${OV_SERVER_HOST}:${OV_SERVER_PORT}."
        return 0
      fi
      if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
        echo "[ov] openviking-server already running (PID $(cat "$pid_file"))."
        return 0
      fi
      nohup "$OV_BIN_DIR/openviking-server" --config "$OV_HOME/ov.conf" "$@" >"$log_file" 2>&1 &
      echo $! > "$pid_file"
      for _ in $(seq 1 40); do
        if is_server_running; then
          echo "[ov] openviking-server started (PID $(cat "$pid_file"), http://${OV_SERVER_HOST}:${OV_SERVER_PORT})."
          return 0
        fi
        if ! kill -0 "$(cat "$pid_file")" 2>/dev/null; then
          break
        fi
        sleep 0.5
      done
      echo "[ov] openviking-server failed to become healthy. Check $log_file" >&2
      tail -n 30 "$log_file" >&2 || true
      return 1
      ;;
    stop)
      if [ -f "$pid_file" ]; then
        local pid=""
        pid="$(cat "$pid_file")"
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
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
    restart)
      manage_server stop
      manage_server start "$@"
      ;;
    status)
      if is_server_running; then
        echo "[ov] openviking-server healthy at http://${OV_SERVER_HOST}:${OV_SERVER_PORT} (PID $(cat "$pid_file" 2>/dev/null || echo external))."
        "$OV_BIN_DIR/ov" health || true
      elif [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
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

recover_runtime() {
  ensure_ov_installed
  ensure_ollama_models
  manage_server start
}

run_hook() {
  ensure_ov_installed
  local event="${1:-}"
  local client="${2:-antigravity}"
  if [ ! -f "$OV_HOOK_ENTRY" ]; then
    exit 0
  fi
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
  recover)
    shift || true
    recover_runtime "$@"
    ;;
  setup)
    shift || true
    ensure_ov_installed
    create_launchers_and_links
    ensure_ollama_models
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
  ollama)
    shift || true
    manage_ollama "$@"
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
