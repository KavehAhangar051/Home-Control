---
name: openviking
description: Permanent installation and operational guide for volcengine/OpenViking (v0.5.5) — context database for AI agents with L0/L1/L2 tiered loading (viking://), semantic memory, RAG, Experience trajectories, Kanban, Skills registry, MCP stdio proxy (ov-mcp), openviking-server, and VikingBot.
---

# OpenViking (`volcengine/OpenViking` v0.5.5) — Complete Mastery Guide

OpenViking is permanently persisted inside `.agent-state/openviking/` (surviving container resets) and wired via `./tools/ov.sh` (`bun run ov`), global launchers on `PATH` (`/usr/local/bin/{ov,ov-node,openviking-server,openviking-gateway,vikingbot,ov-mcp,ov-hook,ov-doctor,ov-python,uv}`), and the official Agent Plugins 1.0 + Antigravity hooks package in `/.agents/plugins/openviking/`.

## 1. Installed Components & Official Sub-Skills

| Component | Binary / Entrypoint | Purpose |
| --- | --- | --- |
| **Python CLI (`0.5.5`)** | `ov` / `bun run ov` | Primary OpenViking CLI (`ls`, `tree`, `find`, `search`, `grep`, `glob`, `abstract`, `overview`, `read`, `add-resource`, `add-memory`, `session`, `skills`, `mcps`, `doctor`, `health`, `status`) |
| **Node CLI (`0.5.3`)** | `ov-node` (`@openviking/cli`) | Standalone Node.js CLI fallback |
| **Context Server** | `openviking-server` / `bun run ov:server` | FastAPI + RAGFS Rust + AVX-512 native engine + AGFS SDK HTTP server & `/mcp` streamable-HTTP endpoint |
| **MCP Proxy** | `ov-mcp` / `bun run ov:mcp` | Official stdio → streamable-HTTP MCP proxy (`/.agents/plugins/openviking/servers/mcp-proxy.mjs`) |
| **VikingBot** | `vikingbot` / `bun run vikingbot` | Built-in agent gateway/assistant with full optional extras (`[gateway-fast,gemini-async,bot]`) |
| **Python SDK** | `ov-python` (`import openviking, openviking_sdk`) | Python 3.11 venv with `openviking==0.5.5` and `openviking-sdk==0.1.20` |

### 7 Official OpenViking Agent Skills (in `/agents/skills/`)
- `openviking-memory`: Semantic recall before tasks (`find`/`search`/`read`) and memory persistence (`remember`/`write`).
- `openviking-rule-search`: Search applicable rules/constraints before planned actions.
- `openviking-skills`: Discover (`find(context_type="skill")`), execute, create (`add_skill`), and share skills in `viking://agent/skills`.
- `ov-experience-memory`: Search and reuse prior task Experience trajectories in `viking://~/memories/experiences`.
- `ov-kanban`: Multi-step / multi-agent task boards stored inside OpenViking markdown files.
- `ov-memory-troubleshoot`: Read-only diagnostics tracing memories back to archive diffs and sessions.
- `ov-resources`: Ingest, browse, and search documentation/repositories under `viking://resources/`.

## 2. Quick Operations

```bash
# Diagnostics & conformance
bun run ov:doctor                 # or: ov-doctor / ov doctor
bun run tools:check               # checks rtk, te, cbm, and ov together

# Server lifecycle (requires ~/.openviking/ov.conf with embedding + vlm provider)
openviking-server init            # interactive provider/model setup wizard -> ~/.openviking/ov.conf
bun run ov:server start           # start local server daemon on 127.0.0.1:1933
bun run ov:server status          # check daemon PID & /health
bun run ov:server stop            # stop local server daemon

# Connecting to an existing / remote OpenViking server
ov config                         # interactive connection setup -> ~/.openviking/ovcli.conf
ov health && ov status

# Tiered context exploration (L0 -> L1 -> L2)
ov add-resource <path-or-url>     # ingest repository, docs, or webpage
ov ls viking://resources/
ov tree viking://resources/ -L 2
ov abstract <viking-uri>          # L0: 1-sentence summary
ov overview <viking-uri>          # L1: core overview & key points
ov read <viking-uri>              # L2: full source content
ov find "<query>"                 # semantic vector retrieval
ov grep "<pattern>" --uri viking://resources/

# Start MCP stdio proxy or VikingBot
bun run ov:mcp                    # stdio MCP server for MCP-capable clients
bun run vikingbot --help
```

## 3. Configuration Notes (`~/.openviking/`)

- `~/.openviking` is symlinked to `.agent-state/openviking/home/`, so `ovcli.conf`, `ov.conf`, `ovcli.settings.conf`, logs, and local workspace data persist across container resets.
- `ovcli.conf` defaults to `{"url": "http://127.0.0.1:1933", "output": "table", "timeout": 60.0}`.
- To run a **local** `openviking-server`, configure `embedding` and `vlm` in `~/.openviking/ov.conf` (via `openviking-server init` or editing `~/.openviking/ov.conf` for OpenAI, Volcengine, Gemini, Codex OAuth, or Ollama) before running `bun run ov:server start`. To use a **remote/hosted** server, run `ov config` or set `OPENVIKING_URL` and `OPENVIKING_API_KEY`.
