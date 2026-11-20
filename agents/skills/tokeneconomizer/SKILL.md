---
name: tokeneconomizer
description: Permanent installation and operational guide for Microsoft TokenEconomizer (microsoft/TokenEconomizer) — cross-session micro-skills (learned repository facts), tool pruning proposals, and stuck failure-loop intervention, coexisting cleanly with rtk (Lite Mode) and codebase-memory-mcp.
---

# TokenEconomizer — Permanent Cross-Session Token Optimization Skill

`microsoft/TokenEconomizer` (`https://github.com/microsoft/TokenEconomizer`) is a 100% Python stdlib-only (Python >= 3.10, zero PyPI dependencies) token-reduction toolkit permanently installed via `/tools/te.sh` (`bun run te`), global launchers (`/usr/local/bin/te`, `/usr/local/bin/te-hook`, `~/.tokeneconomizer/bin/{te,te-hook}`), Python user site-packages (`import tokeneconomizer`), and workspace Antigravity hooks (`/.agents/plugins/tokeneconomizer/`).

## 1. Three Core Mechanisms (+ Optional Repo Map)

| Mechanism | Setting Key | Project Default | What It Does |
| --- | --- | --- | --- |
| **Micro-skills** | `microskills` | `envfacts` | Learns repository-specific facts (working build/test commands, environment quirks) across sessions with **zero model calls** (`envfacts`), or with an optional LLM distiller (`on` = `envfacts+distiller`), and injects confirmed facts at session start. |
| **Tool pruning** | `toolprune` | `propose` | Tracks never-used tools across sessions and proposes a safe deny list (`te toolprune show` / `te toolprune apply` / `te toolprune restore`). Switch to `toolprune=auto` for automatic idle-time application. |
| **Loop guard** | `loopguard` | `nudge` | Detects turns stuck in repeated failures and injects a concise mid-turn redirect note (requires a supported host CLI with hooks & side-call support). |
| **Repository map** | `repomap` | `off` | Optional aider-based signature map (`pip install aider-chat` + `te config set repomap=on`). Note: this project already uses `codebase-memory-mcp` (`bun run cbm`) for instant AST graph queries. |

## 2. Essential CLI Commands (`te` or `bun run te`)

```bash
# Health check (Python, state root, detected agents, rtk compatibility, errors.log)
bun run te:doctor                 # or: te doctor

# Repository learning status & session token metrics
bun run te:status                 # or: te status / te status --explain

# Inspect or manage learned repository facts (micro-skills)
te microskills
te microskills forget <ID>
te microskills unforget <ID>

# Inspect, apply, or restore unused-tool pruning proposals
te toolprune show
te toolprune apply
te toolprune restore

# View or change configuration (per-repo by default, or --global)
te config show
te config set microskills=envfacts toolprune=propose loopguard=nudge
te config unset <KEY>

# List all tracked repositories & migrate/merge state
te repos
te history import --dry-run

# Re-bootstrap launchers/config or update from upstream GitHub
bun run te:setup                  # or: bash ./tools/te.sh setup
bash ./tools/te.sh update
```

## 3. Coexistence with `rtk` (Lite Mode) and `codebase-memory-mcp`

- **`rtk` (`mode Lite`)**: Rewrites/compresses shell stdout/stderr (`git`, `tsc`, `bun`, `grep`, etc.) in `<10ms` before it enters context. TokenEconomizer explicitly reads `rtk`-prefixed commands as the underlying commands they wrap and adds zero extra tools.
- **`codebase-memory-mcp` (`bun run cbm`)**: Handles instant AST structural discovery (`search_graph`, `trace_path`, `query_graph`), complementing TokenEconomizer's cross-session behavioral memory.
- **Per-host CLI targeting**: Pass `--host <agent>` (`antigravity`, `claude`, `codex`, `copilot`, `cursor`, `droid`, `grok`, `hermes`, `opencode`, `pi`) when inspecting or driving a specific host's sessions.

## 4. Runtime & Host Honesty Note

- Full automatic lifecycle hooks (`SessionStart`, `PreInvocation`, `PostToolUse`, `Stop`) fire automatically when running inside a supported host CLI (`claude`, `codex`, `copilot`, `agy` Antigravity CLI, `pi`, `cursor`, `droid`, `opencode`, `hermes`) pointing at `~/.tokeneconomizer/plugin` or `/.agents/plugins/tokeneconomizer`.
- Inside containerized sandboxes where none of those host CLIs are running on `PATH`, the `te` / `te-hook` binaries, Python `tokeneconomizer` library, `~/.tokeneconomizer` state store, and `./tools/te.sh` auto-bootstrapper remain fully operational via terminal commands, and automatically attach whenever a supported host CLI is attached to this workspace.

## 5. Official Command References

See `references/` in this skill directory for upstream slash-command specs (`status.md`, `microskills.md`, `toolprune.md`, `config.md`, `repos.md`).
