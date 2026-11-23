---
name: rtk
description: Token-optimized CLI proxy (Rust Token Killer - rtk-ai/rtk) permanently configured in Lite Mode. Compresses shell outputs (git, tsc, bun, npm, next, grep, rg, ls, tree, diff, test, err) by 60–90% in <10ms before entering LLM context.
---

# RTK (Rust Token Killer) — Lite Mode Mastery Skill

`rtk` (`https://github.com/rtk-ai/rtk`, v1.2.0+) is permanently installed (`/usr/local/bin/rtk`) and auto-bootstrapped via `./tools/rtk.sh` (`bun run rtk`) in **Lite Mode**.

## 1. Why Lite Mode?

- **Minimal Standing Context (`awareness.level = "default"`):** Uses the 10-line compact awareness rule (`/.agents/plugins/rtk/rules/AGENTS.md`) instead of legacy 137-line prompt tables, costing almost zero standing tokens per turn.
- **Pure Text Output (`colors = false`, `emoji = false`, `pro_hint = false`):** Strips ANSI color codes, progress spinners, decorative emojis, and promotional hints from command output so every returned byte is pure signal.
- **Zero-Latency Deterministic Pipeline (`home-control-lite` extending `rtk:default` + `rtk:terse`):** Runs locally in `<10ms` without external LLM proxy round-trips or telemetry (`telemetry.enabled = false`).
- **Lossless Recall Store (`retriever.mode = "sqlite"`, `compression = true`):** Whenever `rtk` condenses or truncates output, it stores the full output in a local gzip-compressed SQLite blob and prints `[full output: rtk recall <hash>]`.

---

## 2. When to Use `rtk` vs Native Tools

| Task | Best Tool | Why |
|------|-----------|-----|
| **Reading known source files for editing** | Native `view_file` (in parallel) | ~2ms latency, exact 1-indexed line numbers for `replace_file_content`. |
| **Listing a single directory** | Native `list_dir` | ~2ms native tool call. |
| **All shell / CLI commands in `run_command`** | **`rtk <cmd>`** (`rtk git`, `rtk tsc`, `rtk bun`, `rtk next`, `rtk grep`, `rtk diff`, `rtk err`, `rtk test`) | Cuts terminal stdout/stderr noise by 60–90% in `<10ms`. |

---

## 3. Essential `rtk` Commands in `run_command`

Whenever running shell commands via `run_command`, prefix supported commands with `rtk` (or `bun run rtk`):

### Build, Typecheck, Lint & Test
```bash
rtk tsc --noEmit                         # Grouped TypeScript errors or 1-line "TypeScript: No errors found"
rtk bun x biome check --write app components features lib
rtk next build                           # Condensed Next.js build summary without progress bar noise
rtk test node --import ./tests/ts-loader.mjs --test tests/*.test.mjs
rtk err <command>                        # Run any command and show ONLY errors/warnings
```

### Git & Diffs
```bash
rtk git status                           # Compact status summary
rtk git diff                             # Ultra-condensed diff (changed lines + essential context)
rtk git log -n 10                        # 1-line per commit summary
rtk git add . && rtk git commit -m "..." && rtk git push
```

### File Search, Tree & JSON Inspection
```bash
rtk grep -rn "pattern" features/         # Matches grouped by file, whitespace stripped
rtk rg "pattern" features/               # Native ripgrep with compact grouped output
rtk tree -L 2 features/                  # Token-optimized directory tree
rtk json package.json --keys-only        # Inspect JSON structure without bulky values
rtk deps                                 # Summarize project dependencies
```

### Recovery & Token Savings Analytics
```bash
rtk recall <hash>                        # Recover full unfiltered output from a previous truncated command
rtk bypass <command>                     # Run a command completely unfiltered while tracking tokens
rtk gain                                 # View token savings dashboard (or `bun run rtk:gain`)
```

---

## 4. Auto-Bootstrap & Verification

If the container environment ever resets, running `bash ./tools/rtk.sh setup` or `bun run rtk` automatically:
1. Installs `/usr/local/bin/rtk` if missing.
2. Writes Lite Mode config (`~/.config/rtk/config.toml`) and copies `.rtk/pipeline.toml` to `~/.config/rtk/pipeline.toml`.
3. Registers the Antigravity (`/.agents/plugins/rtk`), Gemini (`~/.gemini/hooks`), and Claude hooks.
