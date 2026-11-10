# Plan 009: Reconcile `ADR-0012`, `ADR-0009`, and `DESIGN.md` Documentation Drift

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: Compare the "Current state" excerpts below
> against `adr/0012-lru-caching-and-off-thread-processing.md`,
> `adr/0009-active-line-position-tracking.md`, and `DESIGN.md` before
> proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/007-domain-contract-test-expansion.md
- **Category**: docs
- **Planned at**: commit `v0.1.0-working`, 2026-11-01

## Why this matters

`AGENTS.md` and `GEMINI.md` instruct every AI agent session to read `ARCHITECTURE.md` and `DESIGN.md` at the start of a chat, and `ARCHITECTURE.md` references the ADR records in `adr/`. Currently, three documentation drift points exist:
1. `adr/0012-lru-caching-and-off-thread-processing.md:16-17` claims that `services/markdownWorker.ts` (`processDocumentAsync`) exists in the codebase, whereas off-blocking reactivity is actually implemented via `utils/lruCache.ts` (`createBoundedCache`) combined with React 19 `useDeferredValue` (`ADR-0010`, `store/MarkdownContext.tsx:136`).
2. `adr/0009-active-line-position-tracking.md:26` references a non-existent test file path `tests/unit/active-line-position.test.ts` instead of `tests/domain-contracts.test.ts`.
3. `DESIGN.md:28,37,41-43` lists stale token values (`#71717a` instead of `#52525b` for light-mode `--color-text-secondary`, and `1.85rem`/`1.50rem`/`1.25rem` instead of `1.65rem`/`1.35rem`/`1.125rem` defined in `app/globals.css:130,277-305`).

Reconciling these documents prevents future agents from searching for non-existent files (`services/markdownWorker.ts`, `tests/unit/active-line-position.test.ts`) or reverting contrast/typography fixes in `app/globals.css`.

## Current state

- `adr/0012-lru-caching-and-off-thread-processing.md:13-20`:
```markdown
1. **کش دوگانه LRU کراندار:**
   - کش با ظرفیت ۶۴ سند در `services/markdownEngine.ts` برای پردازش کل سند مارک‌داون.
   - کش با ظرفیت ۲۰۰ قطعه‌کد در `utils/syntaxHighlighter.ts` برای پرهیز از کامپایل مجدد گرامرهای زبانی.
2. **لایه پردازش غیرهمزمان و لغو وظایف (`services/markdownWorker.ts`):**
   - ایجاد تابع `processDocumentAsync` با زمان‌بندی خرد (Microtask Scheduling) و پشتیبانی از ابطال تسک‌های منقضی‌شده جهت تضمین پیوسته ۶۰fps در رابط کاربری.
3. **تفکیک ماژولار زیرالمان‌های جدول (`components/ui/table-elements.tsx`):**
   - تفکیک قطعات جدول جهت رعایت اصل تک‌مسئولیتی و کاهش حجم فایل کانتینر به زیر ۸۰ خط.
```

- `adr/0009-active-line-position-tracking.md:26`:
```markdown
- **Positive:** Easily unit-tested via the pure `calculateActiveLinePosition` function (`tests/unit/active-line-position.test.ts`).
```

- `DESIGN.md:28` and `DESIGN.md:37-44`:
```markdown
| **متن ثانویه (Secondary)**| `--color-text-secondary`| `#a1a1aa` (Zinc 400) | `#71717a` (Zinc 500) | > 4.7:1 (AA) |
...
- **فونت فارسی:** `Vazirmatn` (برای تمامی حروف، کلمات و متون فارسی)
- **فونت انگلیسی:** `Kode Mono` (برای تمامی حروف، کلمات و کاراکترهای انگلیسی و کد)
- **ارتفاع خطوط (Line-Height):** `1.85` برای متون فارسی در پیش‌نمایش و `1.6` برای المان‌های کنترلی
- **مقیاس اندازه متن:**
  - **H1:** `1.85rem` با وزن ۷۰۰
  - **H2:** `1.50rem` با وزن ۷۰۰
  - **H3:** `1.25rem` با وزن ۶۰۰
  - **متن بدنه:** `0.875rem` تا `1rem`
```

## Commands you will need

| Purpose   | Command         | Expected on success |
|-----------|-----------------|---------------------|
| Full gate | `npm run check` | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `adr/0012-lru-caching-and-off-thread-processing.md`
- `adr/0009-active-line-position-tracking.md`
- `DESIGN.md`

**Out of scope** (do NOT touch):
- `app/globals.css` — `app/globals.css` is the source of truth for active CSS tokens.
- Any TypeScript/TSX source file.

## Git workflow

- Branch: `advisor/009-reconcile-adr-and-design-docs`
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Update `adr/0012-lru-caching-and-off-thread-processing.md` and `adr/0009-active-line-position-tracking.md`

1. In `adr/0012-lru-caching-and-off-thread-processing.md`, replace the reference to `services/markdownWorker.ts` (`processDocumentAsync`) with `utils/lruCache.ts` (`createBoundedCache` with Hit/Miss telemetry) + React 19 `useDeferredValue` in `store/MarkdownContext.tsx`, and reference `tests/domain-contracts.test.ts`.
2. In `adr/0009-active-line-position-tracking.md:26`, replace `tests/unit/active-line-position.test.ts` with `tests/domain-contracts.test.ts`.

**Verify**: `npm run check` → exits 0.

### Step 2: Update `DESIGN.md` token table and heading scale to match `app/globals.css`

1. In `DESIGN.md:28`, update Light Mode `--color-text-secondary` from `#71717a (Zinc 500)` to `#52525b (Zinc 600)` (`> 6.7:1 (AA/AAA)`).
2. In `DESIGN.md:37-44`, update the Persian font description to `Dana` (with `Vazirmatn` fallback) and the heading scale to `H1: 1.65rem (700)`, `H2: 1.35rem (700)`, `H3: 1.125rem (600)`, matching `app/globals.css:277-305`.

**Verify**: `npm run check` → exits 0.

## Test plan

- Documentation-only change; verify `npm run check` exits 0 and no stale references to `markdownWorker.ts` or `active-line-position.test.ts` remain in `adr/`.

## Done criteria

- [ ] `adr/0012-lru-caching-and-off-thread-processing.md` accurately describes `utils/lruCache.ts` (`createBoundedCache`) and `store/MarkdownContext.tsx` (`useDeferredValue`)
- [ ] `adr/0009-active-line-position-tracking.md` references `tests/domain-contracts.test.ts`
- [ ] `DESIGN.md` matches `app/globals.css` for `--color-text-secondary` (`#52525b`) and heading sizes (`1.65rem`, `1.35rem`, `1.125rem`)
- [ ] `npm run check` exits 0

## STOP conditions

Stop and report back (do not improvise) if:
- The files in `adr/` or `DESIGN.md` do not match the "Current state" excerpts.

## Maintenance notes

- Whenever token values in `app/globals.css` change, update `DESIGN.md` in the same change so recon docs stay synchronized with CSS tokens.
