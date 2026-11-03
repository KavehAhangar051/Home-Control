# Plan 007: Expand Automated Contract Tests for Active Line Math & C-Family Enhancer

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: Compare the "Current state" excerpts below
> against the live code in `hooks/useActiveLinePosition.ts`,
> `utils/cFamilyEnhancer.ts`, and `tests/domain-contracts.test.ts` before
> proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/006-fence-length-and-table-divider-guards.md
- **Category**: tests
- **Planned at**: commit `v0.1.0-working`, 2026-11-01

## Why this matters

`adr/0009-active-line-position-tracking.md:26` documents that the active line position math is verified via unit tests on `calculateActiveLinePosition` (`hooks/useActiveLinePosition.ts:53-76`), yet `calculateActiveLinePosition` currently has zero test coverage in `tests/domain-contracts.test.ts`. Similarly, `enhanceHighlightedHtml` (`utils/cFamilyEnhancer.ts:45-121`) mutates syntax-highlighted HTML strings before they are rendered via `dangerouslySetInnerHTML`, but is only tested on a single positive C snippet without verifying that string/comment spans (`hljs-string`, `hljs-comment`) and non-systems languages (`python`, `javascript`) are never mutated.

Adding explicit contract tests for these two pure functions closes the test gap documented in `ADR-0009` and protects the HTML enhancement pipeline against regressions.

## Current state

- `hooks/useActiveLinePosition.ts:53-76`:
```typescript
export function calculateActiveLinePosition(
  selectionStart: number,
  value: string,
  scrollTop: number,
  clientHeight: number,
  options?: { lineHeight?: number; paddingTop?: number }
): ActiveLineInfo {
  const text = value ?? '';
  const limit = Math.min(Math.max(0, selectionStart), text.length);
  const lineNumber = 1 + countNewlinesBeforeIndex(text, limit);

  const lineHeight = options?.lineHeight && options.lineHeight > 0 ? options.lineHeight : 24;
  const paddingTop = options?.paddingTop ?? 16;

  const lineTop = paddingTop + (lineNumber - 1) * lineHeight - scrollTop;
  const isVisible = lineTop >= 0 && lineTop <= clientHeight;

  return {
    lineNumber,
    top: lineTop,
    height: lineHeight,
    isVisible,
  };
}
```

- `utils/cFamilyEnhancer.ts:45-48`:
```typescript
export function enhanceHighlightedHtml(html: string, language: string): string {
  if (!html || !SYSTEMS_LANGUAGES.has(language)) {
    return html;
  }
```

- `tests/domain-contracts.test.ts:132-149`:
```typescript
function verifyStatsAndSyncScrollContracts(): void {
  const emptyStats = calculateDocumentStats('');
  assert.equal(emptyStats, EMPTY_DOCUMENT_STATS);
  assert.equal(Object.isFrozen(EMPTY_DOCUMENT_STATS), true);
  assert.equal(emptyStats.wordCount, 0);
  assert.equal(emptyStats.lineCount, 0);
  assert.equal(emptyStats.estimatedReadTimeMinutes, 0);

  const stats = calculateDocumentStats('سلام دنیا\nHello world');
  assert.equal(stats.wordCount, 4);
  assert.equal(stats.lineCount, 2);
  assert.equal(stats.persianCharCount, 8);
  assert.equal(stats.estimatedReadTimeMinutes, 1);

  assert.equal(getScrollProgress(50, 200, 100), 0.5);
  assert.equal(getScrollProgress(NaN, 200, 100), 0);
  assert.equal(calculateTargetScrollTop(50, 200, 100, 500, 100), 200);
}
```

- **Repo conventions to follow**:
  - Tests use Node's built-in `node:assert/strict` and run via `bun tests/domain-contracts.test.ts` (`npm run test`).
  - Keep `tests/domain-contracts.test.ts` under 300 lines per `AGENTS.md` / `ARCHITECTURE.md`.

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|---------------------|---------------------|
| Typecheck | `npm run typecheck` | exit 0, no errors   |
| Lint      | `npm run lint`      | exit 0, no errors   |
| Tests     | `npm run test`      | exit 0, all pass    |
| Full gate | `npm run check`     | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `tests/domain-contracts.test.ts`

**Out of scope** (do NOT touch):
- `hooks/useActiveLinePosition.ts`
- `utils/cFamilyEnhancer.ts`

## Git workflow

- Branch: `advisor/007-domain-contract-test-expansion`
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Import `calculateActiveLinePosition` and `enhanceHighlightedHtml` in `tests/domain-contracts.test.ts`

1. Import `calculateActiveLinePosition` from `../hooks/useActiveLinePosition` and `enhanceHighlightedHtml` from `../utils/cFamilyEnhancer`.
2. In `verifyStatsAndSyncScrollContracts()`, add assertions for `calculateActiveLinePosition`:
   - Line 1 at index 0 (`lineNumber === 1`, `top === 16`, `height === 24`, `isVisible === true`).
   - Line 3 after two `\n` characters with custom `{ lineHeight: 20, paddingTop: 10 }` and `scrollTop: 5` (`lineNumber === 3`, `top === 45`, `isVisible === true`).
   - Clamping negative or past-end `selectionStart` values without throwing, and `isVisible === false` when `scrollTop` pushes `lineTop < 0` or `lineTop > clientHeight`.
3. In `verifyFileValidationAndSyntaxHighlighterContracts()`, add assertions for `enhanceHighlightedHtml`:
   - Non-systems language (`enhanceHighlightedHtml('foo(BAR)', 'python') === 'foo(BAR)'`).
   - Tokens inside `<span class="hljs-string">"ptr-&gt;call(MAX_CONST)"</span>` and `<span class="hljs-comment">// obj.prop</span>` remain untouched when `language === 'c'`.

**Verify**: `npm run check` → exits 0 with all tests, typecheck, and lint passing.

## Test plan

- File: `tests/domain-contracts.test.ts`
- Cases added:
  - `calculateActiveLinePosition`: initial cursor, multi-line offset with custom metrics, out-of-bounds cursor indices, off-screen `isVisible === false`.
  - `enhanceHighlightedHtml`: non-systems language pass-through, string/comment span immunity in C.
- Verification: `npm run check` → exits 0.

## Done criteria

- [ ] `npm run typecheck` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run test` exits 0 with new `calculateActiveLinePosition` and `enhanceHighlightedHtml` assertions passing
- [ ] `tests/domain-contracts.test.ts` remains under 300 lines (`wc -l tests/domain-contracts.test.ts`)
- [ ] No files outside `tests/domain-contracts.test.ts` and `plans/README.md` are modified

## STOP conditions

Stop and report back (do not improvise) if:
- Importing `hooks/useActiveLinePosition.ts` in `bun tests/domain-contracts.test.ts` fails due to React client-hook resolution in Bun (if so, stop and report).
- `tests/domain-contracts.test.ts` exceeds 300 lines.

## Maintenance notes

- Keep `adr/0009-active-line-position-tracking.md` pointed at `tests/domain-contracts.test.ts` (covered in Plan 009).
