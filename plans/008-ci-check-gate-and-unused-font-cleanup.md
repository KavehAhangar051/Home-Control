# Plan 008: Gate GitHub Pages CI Workflow on `npm run check` & Remove Unused Font Dependency

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: Compare the "Current state" excerpts below
> against `.github/workflows/deploy.yml` and `package.json` before proceeding;
> on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `v0.1.0-working`, 2026-11-01

## Why this matters

In `next.config.ts:28-30`, `eslint: { ignoreDuringBuilds: true }` disables ESLint during `next build`. Meanwhile, `.github/workflows/deploy.yml:60-68` installs dependencies and runs `next build` directly without running `npm run check` (`npm run typecheck && npm run lint && npm run test`). As a result, a commit that breaks ESLint rules or fails domain contract tests in `tests/domain-contracts.test.ts` will still build and deploy to production GitHub Pages.

Additionally, `package.json:19` declares `"@fontsource/jetbrains-mono": "^5.0.0"` in `dependencies`, even though `ADR-0003` (`adr/0003-hybrid-code-typography-and-font-caching.md`), `app/layout.tsx:2-8`, and `app/globals.css` standardized exclusively on `@fontsource/vazirmatn`, `@fontsource/kode-mono`, and local `Dana` fonts. No file in the repository imports `@fontsource/jetbrains-mono`.

## Current state

- `.github/workflows/deploy.yml:60-68`:
```yaml
      - name: Install dependencies
        run: ${{ steps.detect-package-manager.outputs.manager }} ${{ steps.detect-package-manager.outputs.command }}

      - name: Build Next.js static export
        run: ${{ steps.detect-package-manager.outputs.manager == 'bun' && 'bun run build' || 'npm run build' }}
        env:
          NEXT_EXPORT: 'true'
          NEXT_PUBLIC_BASE_PATH: ${{ steps.pages.outputs.base_path }}
```

- `package.json:18-22`:
```json
  "dependencies": {
    "@fontsource/jetbrains-mono": "^5.0.0",
    "@fontsource/kode-mono": "^5.3.0",
    "@fontsource/vazirmatn": "^5.0.0",
```

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|---------------------|---------------------|
| Typecheck | `npm run typecheck` | exit 0, no errors   |
| Lint      | `npm run lint`      | exit 0, no errors   |
| Tests     | `npm run test`      | exit 0, all pass    |
| Full gate | `npm run check`     | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `.github/workflows/deploy.yml`
- `package.json`

**Out of scope** (do NOT touch):
- `next.config.ts` — keep `ignoreDuringBuilds: true` so `next build` does not duplicate linting after the explicit CI check step.
- `app/layout.tsx` and `app/globals.css` — active font imports (`vazirmatn`, `kode-mono`, `Dana`) must remain untouched.

## Git workflow

- Branch: `advisor/008-ci-check-and-unused-font`
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Add verification gate step to `.github/workflows/deploy.yml`

Insert a `Verify typecheck, lint, and domain contracts` step immediately before `Build Next.js static export` in `.github/workflows/deploy.yml`:

```yaml
      - name: Verify typecheck, lint, and domain contracts
        run: ${{ steps.detect-package-manager.outputs.manager == 'bun' && 'bun run check' || 'npm run check' }}
```

**Verify**: Inspect `.github/workflows/deploy.yml` and run `npm run check` → exits 0.

### Step 2: Remove unused `@fontsource/jetbrains-mono` line from `package.json`

Remove `"@fontsource/jetbrains-mono": "^5.0.0",` from `package.json:19`.

**Verify**: `npm run check` → exits 0.

## Test plan

- Run `npm run check` to verify typecheck, ESLint, and all domain contract tests pass without `@fontsource/jetbrains-mono`.

## Done criteria

- [ ] `.github/workflows/deploy.yml` executes `bun run check` / `npm run check` before `build`
- [ ] `@fontsource/jetbrains-mono` is removed from `package.json`
- [ ] `npm run check` exits 0
- [ ] No files outside `.github/workflows/deploy.yml`, `package.json`, and `plans/README.md` are modified

## STOP conditions

Stop and report back (do not improvise) if:
- Any file in the repository is found importing `@fontsource/jetbrains-mono`.
- `npm run check` fails after the edit.

## Maintenance notes

- Any new test suite added to the repository should be wired into `package.json`'s `"test"` or `"check"` script so `.github/workflows/deploy.yml` enforces it automatically.
