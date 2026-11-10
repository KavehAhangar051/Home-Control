# Implementation Plans

Generated and reconciled by the `improve` skill on 2026-11-01. Execute in the order below unless dependencies say otherwise. Each executor: read the plan fully before starting, honor its STOP conditions, and update your row when done.

## Execution order & status

| Plan | Title | Priority | Effort | Depends on | Status |
|------|-------|----------|--------|------------|--------|
| 001  | Fix Textarea Active Line Position Height & Scroll Drift | P1 | S | — | DONE (Verified) |
| 002  | Extend Markdown Title Extraction to Support Setext Headings | P1 | S | — | DONE (Verified) |
| 003  | Add Unified Verification Command (`npm run check`) in Package Manifest | P2 | S | — | DONE (Verified) |
| 005  | Optimize Markdown Engine Input Processing with Input Guarding | P2 | S | 002 | DONE (Verified) |
| 006  | Fix Outer Fence Length Matching & Single-Pipe Table Divider False Positives | P1 | S | — | DONE |
| 007  | Expand Automated Contract Tests for Active Line Math & C-Family Enhancer | P1 | S | 006 | DONE |
| 008  | Gate GitHub Pages CI Workflow on `npm run check` & Remove Unused Font Dependency | P2 | S | — | DONE |
| 009  | Reconcile `ADR-0012`, `ADR-0009`, and `DESIGN.md` Documentation Drift | P3 | S | 007 | DONE |

Status values: `TODO` | `IN PROGRESS` | `DONE` | `BLOCKED` (with one-line reason) | `REJECTED` (with one-line rationale — finding fixed independently or approach abandoned)

## Dependency notes

- **Plan 005** optimizes document processing after Setext heading extraction in **Plan 002** is locked down (both verified `DONE`).
- **Plan 007** depends on **Plan 006** because both plans modify `tests/domain-contracts.test.ts`; executing 006 first avoids merge/drift conflicts in the test suite.
- **Plan 009** depends on **Plan 007** so that `adr/0009-active-line-position-tracking.md`'s reference to `tests/domain-contracts.test.ts` is backed by the newly added `calculateActiveLinePosition` contract assertions.

## Findings considered and rejected

- *Sanitize HTML in CodeBlock*: `CodeBlock` uses `highlightCode` from `highlight.js` which returns HTML-escaped token spans (and `escapeHtml` on fallback paths). Extra DOMPurify overhead on every code block render was rejected as unnecessary runtime overhead.
- *Add `rehype-sanitize` over `rehype-raw` in `PreviewView`*: By-design architectural choice (`package.json:65-67` explicitly ignores `react-doctor/react-markdown-unsanitized-raw-html` and `ADR-0008` defines the app as a 100% local, zero-backend single-user scratchpad with no shared/untrusted server content). Adding `rehype-sanitize` would strip legitimate inline HTML/RTL layout tags authored by the user.
- *Split `store/MarkdownContext.tsx` (313 lines)*: Already splits runtime subscriptions into `StudioUIContext` (`useStudioUI`) and `MarkdownContext` (`useMarkdownContext`) (`TD-003` marked Resolved in `docs/TECH-DEBT.md:13`), and sits within the 300–400 line tolerance in `AGENTS.md`.
