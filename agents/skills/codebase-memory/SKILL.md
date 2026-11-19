---
name: codebase-memory
description: Use the codebase-memory-mcp (DeusData/codebase-memory-mcp v0.12.1+) knowledge graph for structural code queries, call tracing, impact analysis, dead code detection, architecture exploration, and ADR persistence. Always installed in the project via tools/cbm.sh (`bun run cbm <tool> ...` or `codebase-memory-mcp cli <tool> ...`) with persistent graph artifact `.codebase-memory/graph.db.zst` (project name: `app-applet`).
---

# Codebase Memory (`codebase-memory-mcp` v0.12.1) — Knowledge Graph Mastery Guide

## Optimal Hybrid Mastery Rule (Speed + Structural Accuracy)

Empirical benchmarks in this workspace show why a **Hybrid Graph + Native Tool** strategy is critical:
- **Cold CLI invocation (without daemon):** `~5,500ms` per call (spawns a temporary daemon every time).
- **Warm CLI invocation (`codebase-memory-mcp daemon start`, auto-started by `./tools/cbm.sh`):** `~2,000ms` per call via `run_command`.
- **Native `view_file` tool:** `~2ms` per call, supports 4–8 parallel file reads in a single turn, and provides exact 1-indexed line numbers required by `replace_file_content`.

### When to Use `codebase-memory-mcp` (High Value / Structural Discovery)
Use **1 targeted `bun run cbm <tool> --project app-applet ...` call** when:
1. **Call-Chain & Impact Tracing (`trace_path`):** Answering *"Who calls function X?"* (`--direction inbound`) or *"What downstream functions does X trigger?"* (`--direction outbound` / `both`) across multiple files in 1 hop instead of 5 sequential grep searches.
2. **Unknown Symbol / Cross-Repo Discovery (`search_graph`, `query_graph`):** Locating functions, hooks, or components by regex pattern (`--name-pattern ".*Viewport.*"`) or Cypher relationships (`CALLS`, `IMPORTS`, `DEFINES`) when you do not yet know the target file path.
3. **Architecture & Dead-Code Audits (`get_architecture`, `search_graph --max-degree 0`, `detect_changes`):** Inspecting package boundaries, entry points, or unreferenced symbols.

### When NOT to Use `codebase-memory-mcp` (Use Native `view_file` Instead)
1. **Known File Paths & Pre-Edit Line Inspection:** Once you know which file(s) to inspect or edit (either from user context, `ARCHITECTURE.md`, or a `search_graph` / `trace_path` result), **immediately use parallel native `view_file` calls**. Do **not** call `get_code_snippet` or `get_file_outline` via shell for files you are about to edit—`get_code_snippet` costs `~2,000ms` via shell and does not give full file line numbers for `replace_file_content`.
2. **Never Chain 3+ `cbm` CLI Calls in One Shell Command:** Chaining 3–4 CLI calls in one `run_command` takes `6–8s+` and risks hitting `WaitMsBeforeAsync`, pushing the shell command into an async background task and costing an extra turn.

The native binary is permanently available via:
- `bun run cbm <tool> [flags]` (auto-starts the warm background daemon and auto-bootstraps via `./tools/cbm.sh`)
- `codebase-memory-mcp cli <tool> [flags]`
- `bun run cbm:index` (re-indexes `/app/applet` against the warm daemon and writes `.codebase-memory/graph.db.zst`)

Default project identifier: **`app-applet`**

## Quick Decision Matrix (CLI Invocation)

| Question | Command |
|----------|---------|
| Re-index & persist graph artifact | `bun run cbm:index` |
| Project architecture summary / hotspots | `bun run cbm get_architecture --project app-applet` |
| Deep architecture (all aspects) | `bun run cbm get_architecture --project app-applet '{"project":"app-applet","aspects":["all"]}'` |
| Who calls X? | `bun run cbm trace_path --project app-applet --function-name X --direction inbound` |
| What does X call? | `bun run cbm trace_path --project app-applet --function-name X --direction outbound` |
| Full call chain + risk labels | `bun run cbm trace_path --project app-applet --function-name X --direction both --risk-labels true` |
| Find symbol by name pattern | `bun run cbm search_graph --project app-applet --name-pattern ".*Pattern.*"` |
| Text / regex search in indexed code | `bun run cbm search_code --project app-applet --pattern "search text" --mode full` |
| File symbol outline | `bun run cbm get_file_outline --project app-applet --file-path "features/iot/hooks/useIoTStore.ts"` |
| Read exact function snippet | `bun run cbm get_code_snippet --project app-applet --qualified-name "app-applet.features..."` |
| Dead code candidates | `bun run cbm search_graph --project app-applet --max-degree 0 --exclude-entry-points true` |
| Impact of local changes | `bun run cbm detect_changes --project app-applet` |
| Custom Cypher graph query | `bun run cbm query_graph --project app-applet --query "MATCH (f:Function) WHERE f.name =~ '.*Workflow.*' RETURN f.name, f.file_path LIMIT 25"` |
| Check index coverage | `bun run cbm check_index_coverage --project app-applet` |
| Manage Architecture Decision Record | `bun run cbm manage_adr --project app-applet --mode get` |

## All 17 MCP Tools Available via `bun run cbm <tool>`

1. `index_repository` (`--repo-path /app/applet --persistence true`)
2. `index_status` (`--repo-path /app/applet`)
3. `list_projects`
4. `delete_project` (`--project app-applet`)
5. `get_architecture` (`--project app-applet`)
6. `get_graph_schema` (`--project app-applet`)
7. `search_graph` (`--project app-applet --label Function --name-pattern "..."`)
8. `search_code` (`--project app-applet --pattern "..." --mode full`)
9. `trace_path` (`--project app-applet --function-name "..." --direction both --depth 3`)
10. `get_code_snippet` (`--project app-applet --qualified-name "..."`)
11. `get_file_outline` (`--project app-applet --file-path "..."`)
12. `query_graph` (`--project app-applet --query "MATCH ..."`)
13. `compare_graphs`
14. `detect_changes` (`--project app-applet`)
15. `check_index_coverage` (`--project app-applet`)
16. `manage_adr` (`--project app-applet --mode get|outline|update|set_sections`)
17. `ingest_traces`

## Edge Types
`CALLS`, `HTTP_CALLS`, `ASYNC_CALLS`, `IMPORTS`, `DEFINES`, `DEFINES_METHOD`,
`HANDLES`, `IMPLEMENTS`, `OVERRIDE`, `USAGE`, `WRITES`, `CONFIGURES`,
`FILE_CHANGES_WITH`, `CONTAINS_FILE`, `CONTAINS_FOLDER`, `CONTAINS_PACKAGE`,
`SIMILAR_TO`, `SEMANTICALLY_RELATED`, `MENTIONS`, `REFERENCES_FILE`

## Cypher Examples (for `query_graph`)
```bash
bun run cbm query_graph --project app-applet --query "MATCH (a)-[r:CALLS]->(b) WHERE b.name = 'triggerHaptic' RETURN a.name, a.file_path LIMIT 30"
bun run cbm query_graph --project app-applet --query "MATCH (f:Function) WHERE f.name =~ '.*Workflow.*' RETURN f.name, f.file_path LIMIT 30"
```

## Gotchas
1. `search_graph(relationship="HTTP_CALLS")` filters nodes by degree — use `query_graph` with Cypher to see actual edges.
2. `query_graph` has a 200-row cap — use `search_graph` with degree filters for counting.
3. `trace_path` needs exact function names — use `search_graph --name-pattern` or `get_file_outline` first.
4. `direction="outbound"` misses cross-service callers — use `direction="both"`.
5. Results default to 10 per page — check `has_more` and use `--offset`.
