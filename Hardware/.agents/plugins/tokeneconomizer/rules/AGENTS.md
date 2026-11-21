# TokenEconomizer
`microsoft/TokenEconomizer`, `rtk` (Lite Mode), `codebase-memory-mcp`, and `PlatformIO` are persisted inside `.agent-state/` & `.codebase-memory/` and unified via `./tools/r` + `./tools/agent-bridge.py`:

- Start a task with `bun run agent:start` (restores offline in `<20ms` and injects learned repository facts).
- Execute shell commands via `bun run r -- <cmd>` (auto-compresses output via `rtk` and feeds `PostToolUse` + `TurnGuard` into `TokenEconomizer`).
- Close & fold finished turns via `bun run agent:end` (persists new `envfacts` micro-skills and checkpoints `rtk` + `te` SQLite stores).
