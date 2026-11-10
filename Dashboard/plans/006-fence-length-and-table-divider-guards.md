# Plan 006: Fix Outer Fence Length Matching & Single-Pipe Table Divider False Positives

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: Compare the "Current state" excerpts below
> against the live code in `utils/rtlConverter.ts`, `services/markdownEngine.ts`,
> and `tests/domain-contracts.test.ts` before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `v0.1.0-working`, 2026-11-01

## Why this matters

`utils/rtlConverter.ts` and `services/markdownEngine.ts` currently toggle `inCodeBlock` / `inCode` whenever any line matches `CODE_FENCE_REGEX = /^\s*(```|~~~)/`. In CommonMark and GitHub Flavored Markdown (GFM), a fenced code block opened with 4 or more backticks/tildes (e.g. ```` ````markdown ````) is only closed by a closing fence of the **same character and at least the same length**, and a closing fence cannot have an info string. Because `RTL Markdown Studio` is built for writing developer documentation (`docs/PRODUCT.md`), users frequently write outer 4-backtick fences containing inner 3-backtick examples. Today, the inner ` ``` ` prematurely closes `inCodeBlock`, causing tables inside the code example to be mutated into `---:` and `# comments` inside the code example to be extracted as the document title.

Additionally, `TABLE_DIVIDER_REGEX = /^\s*\|?(\s*:?-+:?\s*\|)+\s*$/` in `utils/rtlConverter.ts:26` matches a single-column trailing-pipe line like `--- |` (without a leading pipe or a second column), which is not a valid GFM table delimiter row.

## Current state

- `utils/rtlConverter.ts:23-27`:
```typescript
export const CODE_FENCE_REGEX = /^\s*(```|~~~)/;

const MATH_BLOCK_REGEX = /^\s*\$\$/;
const TABLE_DIVIDER_REGEX = /^\s*\|?(\s*:?-+:?\s*\|)+\s*$/;
const ALIGN_REPLACE_REGEX = /:?-+:?/g;
```

- `utils/rtlConverter.ts:44-60`:
```typescript
  let inCodeBlock = false;
  let inMathBlock = false;
  let hasModified = false;

  for (let i = 0; i < lineCount; i++) {
    const line = lines[i];

    // Check if toggling fenced code blocks (``` or ~~~)
    if (CODE_FENCE_REGEX.test(line)) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    // Never modify lines inside code blocks
    if (inCodeBlock) {
      continue;
    }
```

- `services/markdownEngine.ts:182-204`:
```typescript
  if (!text) return '';
  let inCode = false;
  let lineStart = 0;
  let lineCount = 0;
  let prevLine = '';

  while (lineStart < text.length && lineCount < 60) {
    let lineEnd = text.indexOf('\n', lineStart);

    if (lineEnd === -1) {
      lineEnd = text.length;
    }

    const line = text.slice(lineStart, lineEnd);
    lineCount++;
    lineStart = lineEnd + 1;

    if (CODE_FENCE_REGEX.test(line)) {
      inCode = !inCode;
      prevLine = line;
      continue;
    }
```

- **Repo conventions to follow**:
  - Keep pure functions in `utils/` and `services/` free of React/DOM imports (`ARCHITECTURE.md`, ADR-0005).
  - Pre-compile all regular expressions at module scope (`ARCHITECTURE.md` Section 7).
  - Add JSDoc comments to exported helpers (`AGENTS.md`).

## Commands you will need

| Purpose   | Command                          | Expected on success |
|-----------|----------------------------------|---------------------|
| Typecheck | `npm run typecheck`              | exit 0, no errors   |
| Lint      | `npm run lint`                   | exit 0, no errors   |
| Tests     | `npm run test`                   | exit 0, all pass    |
| Full gate | `npm run check`                  | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `utils/rtlConverter.ts`
- `services/markdownEngine.ts`
- `tests/domain-contracts.test.ts`

**Out of scope** (do NOT touch):
- `components/**` — UI rendering of code blocks and tables is handled by `react-markdown` and `remark-gfm`.
- `utils/syntaxHighlighter.ts` — syntax highlighting operates on already-parsed AST code nodes.

## Git workflow

- Branch: `advisor/006-fence-and-table-guards` (if git is initialized; otherwise apply directly in working tree only when dispatched).
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Add fence state tracker helper and tighten `TABLE_DIVIDER_REGEX` in `utils/rtlConverter.ts`

1. Keep `export const CODE_FENCE_REGEX = /^\s*(`{3,}|~{3,})/;` exported for backward compatibility.
2. Add an exported pure helper `updateCodeFenceState(line: string, activeFence: string | null): { toggled: boolean; activeFence: string | null }` in `utils/rtlConverter.ts`:
   - Match opening fence when `activeFence === null` via `/^\s*(`{3,}|~{3,})/` and store the matched fence marker (e.g. ```` ```` ```` or `~~~`).
   - When `activeFence !== null`, only close the fence if the line matches only the same fence character of length `>= activeFence.length` with optional trailing whitespace (`/^\s*(`{3,}|~{3,})\s*$/`).
3. Update `TABLE_DIVIDER_REGEX` in `utils/rtlConverter.ts` so a valid table divider row either starts with `|` (`^\s*\|(\s*:?-+:?\s*\|)+\s*$`) OR has at least two pipe-separated columns (`^\s*:?-+:?\s*\|(\s*:?-+:?\s*\|?)+\s*$`), rejecting single-column `--- |` false positives while still matching `| --- |`, `| --- | :--- |`, and `--- | ---`.
4. Use `updateCodeFenceState` inside `alignMarkdownTablesRtl` in `utils/rtlConverter.ts`.

**Verify**: `npm run typecheck && npm run lint` → exits 0 with no errors.

### Step 2: Use `updateCodeFenceState` in `services/markdownEngine.ts`

1. Import `updateCodeFenceState` from `@/utils/rtlConverter` in `services/markdownEngine.ts`.
2. Replace `let inCode = false;` with `let activeFence: string | null = null;` in `extractDocumentTitle` (`services/markdownEngine.ts:182-205`) so nested 3-backtick fences inside 4-backtick fences do not prematurely exit code mode.

**Verify**: `npm run typecheck && npm run lint` → exits 0 with no errors.

### Step 3: Add regression tests in `tests/domain-contracts.test.ts`

In `verifyRtlMarkdownAndEngineContracts()` (`tests/domain-contracts.test.ts:80-130`), add assertions verifying:
1. A 4-backtick code block wrapping a 3-backtick fence and a `# Fake Title` + `| a | b |\n| --- | --- |` preserves the inner table untouched and extracts the real `# Real Title` after the closing ```` ```` ```` fence.
2. A single-pipe line `--- |` outside a table is not mutated to `---: |`, while both `| --- | --- |` and `--- | ---` are converted to right-aligned `---:`.

**Verify**: `npm run check` → exits 0 (typecheck, lint, and all contract tests pass).

## Test plan

- File: `tests/domain-contracts.test.ts` (inside `verifyRtlMarkdownAndEngineContracts`).
- Cases covered:
  1. Nested 3-backtick fence inside 4-backtick outer fence (`processDocument` title + table preservation).
  2. Single-pipe non-table line `--- |` untouched vs multi-column `| --- | :--- |` converted.
- Verification: `npm run check` → exits 0.

## Done criteria

- [ ] `npm run typecheck` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run test` exits 0 with nested fence and single-pipe divider assertions passing
- [ ] No files outside `utils/rtlConverter.ts`, `services/markdownEngine.ts`, `tests/domain-contracts.test.ts`, and `plans/README.md` are modified

## STOP conditions

Stop and report back (do not improvise) if:
- The code at the locations in "Current state" doesn't match the excerpts.
- Any existing test in `tests/domain-contracts.test.ts` fails after updating `TABLE_DIVIDER_REGEX`.
- `npm run check` fails twice after a reasonable fix attempt.

## Maintenance notes

- Both `utils/rtlConverter.ts` and `services/markdownEngine.ts` share `updateCodeFenceState` so fenced code block boundary rules remain a single source of truth (DRY / Pragmatic Programmer).
