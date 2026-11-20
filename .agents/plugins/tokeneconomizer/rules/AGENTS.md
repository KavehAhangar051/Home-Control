# TokenEconomizer

`microsoft/TokenEconomizer` is permanently installed (`te`, `te-hook`, `./tools/te.sh`, `bun run te`) alongside `rtk` (Lite Mode) and `codebase-memory-mcp`.
- Use `bun run te:status` (`te status`) to inspect learned repository facts, session metrics, and active mechanisms.
- Use `bun run te:doctor` (`te doctor`) to verify Python >= 3.10, state directory (`~/.tokeneconomizer`), detected agents, and `rtk` compatibility.
- Manage mechanisms with `te config show` / `te config set microskills=envfacts toolprune=propose loopguard=nudge`.
- Coexists cleanly with `rtk`: `rtk` compresses shell stdout/stderr, while TokenEconomizer learns repo facts across sessions and guards against stuck failure loops.
