# 60 FPS Rendering and Motion Strategy

## Goal and realistic guarantee

The dashboard's motion-quality target is **stable 60 FPS on 60 Hz displays**, including during normal device-state updates and common interactions. On displays with higher refresh rates, animations should follow the browser/display cadence rather than being artificially capped at 60 FPS.

A universal 60 FPS guarantee on every device is not technically possible: CPU/GPU capability, memory pressure, browser scheduling, thermal throttling, power-saving modes, display refresh rate, and background-tab throttling are outside the application's control. The engineering goal is therefore to maximize the number of devices that sustain their display's refresh rate, and to degrade nonessential visual work gracefully when the runtime cannot keep up.

## Frame budgets

| Refresh rate | Time available per frame |
|---|---:|
| 60 Hz | 16.67 ms |
| 90 Hz | 11.11 ms |
| 120 Hz | 8.33 ms |
| 144 Hz | 6.94 ms |

The entire frame budget is shared by JavaScript, React rendering/commit, style calculation, layout, paint, raster, compositing, browser work, and other pages/processes. A 16.67 ms target is not a JavaScript budget. Keep interaction-triggered main-thread work short enough to leave room for browser rendering.

Average FPS alone is insufficient. Review dropped/partially presented frames, frame-time distribution, long tasks, and the interaction that caused the work.

## Motion engineering rules

1. Prefer transform (translate/scale/rotate) and opacity for high-frequency motion. These are the most consistently compositor-friendly properties.
2. Treat filter, clip-path, color, gradients, shadows, borders, and SVG effects as conditional costs. Their acceleration varies by browser, element size, and GPU; profile them on low-powered devices before using them in dense or continuous motion.
3. Do not animate layout-affecting properties (width, height, top, left, margin, padding) in high-frequency paths unless the layout impact is isolated and measured.
4. Keep high-frequency pointer values in refs or MotionValues where possible. Avoid routing every pointer event through React state; coalesce visual state updates to requestAnimationFrame when React rendering is genuinely needed.
5. Never write synchronous persistence, perform graph-wide scans, or do unrelated computation in a per-frame callback. Commit persistent state at interaction boundaries.
6. Do not apply will-change globally. Layer promotion consumes GPU memory and can make weak devices slower; use it only for short-lived, measured cases.
7. Use the existing Motion runtime and native View Transition integration. Do not add overlapping animation libraries or repeat the broad motion/react-m migration: the 18 Nov 2026 Turbopack experiment increased the homepage client graph by 10,134 compressed bytes and was reverted.
8. Preserve meaningful transitions and micro-interactions. If a device struggles, first reduce nonessential ambient/decorative work and expensive effects; do not remove essential state feedback or interaction affordances.
9. Respect the dashboard animation setting and prefers-reduced-motion. Reduced motion is an accessibility preference, not a performance tier to override.
10. Avoid animating large numbers of independent elements simultaneously. Stagger decorative entrances where appropriate, but never delay urgent device-state feedback.

## Existing motion & rendering inventory

- `components/MotionProvider.tsx`: async `LazyMotion` with `domMax`; all 134 Motion calls already use `m.*` rather than monolithic `motion.*`. Retain `domMax` because layout and drag features are active.
- `lib/performanceTier.ts` & `lib/hooks/use-performance-tier.ts`: pure adaptive performance controller combining hardware hints (`hardwareConcurrency`, `deviceMemory`, `saveData`), Zustand `animationsFps` (`30 | 60`), a 1.5 s post-mount warmup grace window, and a sliding-window rAF frame-drop detector to manage `html[data-perf-tier="full" | "lite"]`.
- `components/motion/action-swap-variants.ts` & `action-swap.tsx`: `"full"` tier uses the expressive blur/roll/cascade variants; `"lite"` tier shifts to compositor-only transform + opacity variants with zero CSS `filter: blur()`.
- `components/motion/color-picker.tsx`: uses `useSpring`/`useTransform`/`MotionValue` for cursor thumb and pendulum loupe without React state loops on drag; panel reveal avoids blur in `"lite"` tier.
- `components/motion/range-slider.tsx`: drives fill and thumb transforms via `MotionValue` + `useSpring`.
- `components/motion/theme-toggle.tsx` & `styles/view-transitions.css`: theme changes use native View Transitions without synchronous `document.body.offsetHeight` forced reflow; `"lite"` tier skips root `filter: blur(8px)`.
- Canvas & Workflow gestures (`useSheetViewportGestures.ts`, `useCanvasNodeInteractions.ts`, `useWorkflowInteractions.ts`, `useWorkflowStudio.ts`): pointer move, resize, wheel zoom, and 2-finger pinch zoom are coalesced to `requestAnimationFrame`; transient viewport changes avoid per-frame `localStorage` serialization; node drag tilt updates `--drag-tilt` without forcing React parent re-renders.
- Infinite background loops (`usePageVisibility.ts`, `app/globals.css`, `CanvasWiresLayer.tsx`, `WorkflowEdgeItem.tsx`): hidden tabs (`html[data-page-hidden="true"]`) pause infinite CSS keyframes, and `"lite"` tier replaces dual SVG SMIL `<animateMotion>` wire particles with lightweight dash feedback.

## Verification protocol

Use equivalent Chromium desktop (`1440x900`) and mobile (`390x844`, 4x/6x CPU throttle or simulated weak-device tier) sessions for comparisons. Cover:

- First dashboard render, initial hydration, and actual network chunk requests (verifying `@dnd-kit/react` loads only for Grid).
- Grid, Trellis, Canvas, and Workflow workspace switching (`AnimateView` / View Transitions).
- Canvas & Workflow node drag, resize, wheel zoom, pinch zoom, and wire connections.
- Rapid device-state changes while wires, perimeter sparks, and UI transitions run.
- Settings Stability (`animationsEnabled` + `30 FPS` / `60 FPS`), ThemeToggle View Transition, and `content-visibility: auto` scrolling.

## Acceptance criteria

- On a 60 Hz target device, common interaction scenarios sustain smooth ~60 FPS with minimal dropped-frame bursts, and high-frequency gestures trigger zero per-frame `localStorage` writes or forced full-DOM reflows.
- On higher-refresh displays (`90/120/144 Hz`), the dashboard imposes no artificial 60 FPS cap.
- Adaptive tiering never disables essential device-state feedback, card transitions, touch affordances, or accessibility (`animationsEnabled` / `prefers-reduced-motion`).

## Current measurement status

- **Turbopack pre-optimization baseline:** 7,411 graph records, 58 homepage `/` client JS outputs (**2,880,282 B raw / 1,164,449 B compressed**).
- **Turbopack post-optimization snapshot:** 7,415 graph records, 58 homepage `/` client JS outputs (**2,890,766 B raw (+10,484 B) / 1,168,296 B compressed (+3,847 B)** — zero extra client chunks added).
- **Live browser verification (headless Chromium 1440x900 & 390x844):** Verified `perfTier="full"` steady ~60 Hz (`16.6–16.8 ms`) rAF cadence, `30 FPS` / `60 FPS` switching in Settings → پایداری toggling `data-perf-tier` between `"lite"` and `"full"`, zero synchronous `localStorage` spam during Canvas & Workflow Studio wheel zoom bursts, imperative `--drag-tilt` rotation without parent re-renders during node drag, zero horizontal overflow on `390x844` mobile, and clean `bun run build` static export.
