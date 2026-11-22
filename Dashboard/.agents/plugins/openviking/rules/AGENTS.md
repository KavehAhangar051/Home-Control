# OpenViking Context Database

`volcengine/OpenViking` (`v0.5.5`, CLI `ov`, `openviking-server`, `vikingbot`, stdio MCP proxy `ov-mcp`, and 7 Agent Skills) is permanently persisted in `.agent-state/openviking/` and wired via `./tools/ov.sh` (`bun run ov`):
- Browse & search tiered `viking://` context (`L0` `.abstract.md`, `L1` `.overview.md`, `L2` `ov read`): `ov ls`, `ov tree`, `ov find`, `ov grep`, `ov abstract`, `ov overview`, `ov read`.
- Manage server, health, and MCP proxy: `bun run ov:doctor`, `bun run ov:server status|start|stop|init`, `bun run ov:mcp`.
- Consult `/agents/skills/openviking/SKILL.md` and the 7 official skills (`openviking-memory`, `openviking-rule-search`, `openviking-skills`, `ov-experience-memory`, `ov-kanban`, `ov-memory-troubleshoot`, `ov-resources`) when working with OpenViking.
