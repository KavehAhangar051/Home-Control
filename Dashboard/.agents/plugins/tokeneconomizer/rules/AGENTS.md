# TokenEconomizer

`microsoft/TokenEconomizer` & `rtk` (Lite Mode) are persisted inside `.agent-state/` (survives container resets) and unified via `./tools/r` + `./tools/agent-bridge.py`:
- Start a task with `python3 ./tools/agent-bridge.py start` (restores offline in `<20ms` and injects learned repository facts).
- Execute shell commands via `./tools/r <cmd>` (auto-compresses output via `rtk` and feeds `PostToolUse` + `TurnGuard` into `TokenEconomizer`).
- Close & fold finished turns via `python3 ./tools/agent-bridge.py end` (persists new `envfacts` micro-skills and `rtk gain` metrics).
