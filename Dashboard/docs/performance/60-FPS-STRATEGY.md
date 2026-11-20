# 60 FPS Rendering and Motion Strategy

## Goal and realistic guarantee

The dashboard's motion-quality target is **stable 60 FPS on 60 Hz displays**, including during normal device-state updates and common interactions. On displays with higher refresh rates, animations should follow the browser/display cadence rather than being artificially capped at 60 FPS.

A universal 60 FPS guarantee on every device is not technically possible: CPU/GPU capability, memory pressure, browser scheduling, thermal throttling, power-saving modes, display refresh rate, and background-tab throttling are outside the application's control. The engineering goal is therefore to eliminate avoidable main-thread, React, Zustand, and CSSOM work so even constrained devices sustain 60 FPS with **zero visual degradation**—keeping all animations and transitions active unless the user explicitly disables or lowers them in Dashboard Settings (پایداری).

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
- `lib/performanceTier.ts` & `lib/hooks/use-performance-tier.ts`: zero-idle-CPU tier controller mapping explicit user Settings (`animationsEnabled === false` or `animationsFps <= 30`) directly to `html[data-perf-tier="full" | "lite"]` with no continuous background rAF polling and no automatic visual downgrade on weak hardware.
- `features/iot/components/DashboardStyles.tsx` & `styles/themeStyles.ts`: static CSS rules stay memoized on `(isDark, animationsEnabled)` while dynamic theme/accent custom properties diff and apply directly via `document.documentElement.style.setProperty(...)` (`requestAnimationFrame`-coalesced on slider drags), eliminating full `<style>` tag re-parsing at 60 FPS.
- `features/iot/services/mqtt/init.ts`, `createSegmentsSlice.ts`, `useAutoOffTimer.ts`, `usePinOperations.ts` & `DashboardContext.tsx`: MQTT `pin_update` digital/PWM/timer telemetry coalesces into a single `requestAnimationFrame` `useIoTStore.setState` commit; `useAutoOffTimer` uses a single-pin selector (`state.autoOffRemaining[pin]`); slice setters short-circuit on reference equality; `usePinOperations` avoids global `useState` churn on clicks/PWM ticks; and `DashboardActionsContext` isolates stable callbacks from readiness state updates.
- `lib/asyncScheduler.ts`, `useCloudflarePush.ts`, `buildEspConfig.ts`, `useCloudflareInit.ts`, `canvasStorage.ts`, `workflowStorage.ts` & `useTrellisWorkspaceController.ts`: `JSON.stringify` config diffing and browser `localStorage` persistence are coalesced and deferred into `requestIdleCallback` slices (with automatic `pagehide` / `visibilitychange` flush guarantees), keeping 60 Hz slider, drag, and edit frames free of synchronous serialization stalls.
- `useWorkflowRuntime.ts`, `WorkflowStudio.tsx`, `DashboardWorkspace.tsx`, `IoTWorkspace.tsx` & `WorkspaceSection.tsx`: workflow countdown timers share one consolidated 1s ticker; DAG evaluation scopes strictly to referenced pins; non-pin workflow nodes receive a stable empty pin map to preserve `React.memo`; heavy workspace display mode (`grid | trellis | canvas`) and Settings panel switches use `useDeferredValue`; and actively dragged Canvas/Workflow nodes apply scoped `willChange: "transform"` only while dragging.
- `components/motion/action-swap-variants.ts` & `action-swap.tsx`: `"full"` tier uses the expressive blur/roll/cascade variants; `"lite"` tier shifts to compositor-only transform + opacity variants when explicitly enabled in Settings.
- `components/motion/color-picker.tsx`: uses `useSpring`/`useTransform`/`MotionValue` for cursor thumb and pendulum loupe without React state loops on drag; panel reveal avoids blur in `"lite"` tier.
- `components/motion/range-slider*.tsx`: drives fill and thumb transforms via `MotionValue` + `useSpring`.
- `components/motion/theme-toggle.tsx` & `styles/view-transitions.css`: theme changes use native View Transitions without synchronous `document.body.offsetHeight` forced reflow; `"lite"` tier skips root `filter: blur(8px)`.
- Canvas & Workflow gestures (`useSheetViewportGestures.ts`, `useCanvasNodeInteractions.ts`, `useWorkflowInteractions.ts`, `useWorkflowStudio.ts`): pointer move, resize, wheel zoom, and 2-finger pinch zoom are coalesced to `requestAnimationFrame`; transient viewport changes avoid per-frame `localStorage` serialization; node drag tilt updates non-inherited `rotate`/`translate` without forcing React parent re-renders.
- Infinite background loops (`usePageVisibility.ts`, `app/globals.css`, `CanvasWiresLayer.tsx`, `WorkflowWiresSvg.tsx`): hidden tabs pause CSS keyframes; Canvas and Workflow wire particles use `CompositedBezierParticle`, which samples cubic Bezier paths only when geometry changes and animates equal-distance `translate3d`/opacity keyframes through the Web Animations API. The shared component pauses its animations while the document is hidden and respects `prefers-reduced-motion`. These transform/opacity animations are compositor candidates; actual compositor promotion remains browser-dependent. The explicit `"lite"` tier continues to suppress decorative wire particles when the user selects reduced animation settings.

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
- Performance tiering never silently disables animations, transitions, or visual fidelity on low-end devices; `"lite"` mode activates strictly when the user disables animations or selects `30 FPS` in Settings (`animationsEnabled` / `animationsFps`), while always honoring `prefers-reduced-motion`.



## GPU-first rendering and LUT roadmap

The dashboard uses a GPU-first strategy for visual work, not a claim that every browser operation can execute exclusively on the GPU. React, DOM construction, event handling, application state, and layout still require CPU work.

### Implemented first step

- Canvas and Workflow Bezier signal particles no longer animate CSS Motion Path's `offset-distance`. Their cubic curves are sampled once when geometry changes, then played as equal-distance Web Animations API keyframes that modify only `transform` and `opacity`.
- The browser can composite these transform/opacity animations independently of main-thread rendering when the target and runtime conditions permit it. No global `will-change` or forced layer promotion is added.
- The shared particle component uses one document-visibility listener for all active particle animations, cancels animations on cleanup, and respects reduced-motion preferences.

### 3D LUT integration (planned)

- Use WebGL 2 fragment shaders and a 3D texture for color lookup / grading on dedicated decorative GPU surfaces (ambient backgrounds, glows, and non-semantic visual effects).
- Do not apply a global LUT to the interactive DOM: it can distort device-state colors, warning/error semantics, text contrast, and user-selected theme colors.
- Keep one bounded GPU resource lifecycle per renderer, handle WebGL context loss, avoid CPU readbacks, and provide a visually safe fallback when WebGL is unavailable.
- Select LUT size, precision, and texture format from measured quality/performance trade-offs; do not assume that allocating more VRAM improves rendering.
- The LUT renderer is not yet enabled in the dashboard. It must be profiled on desktop and mobile hardware before being applied to production surfaces.

### Verification status

- Source-level change only: no browser performance trace or compositor-layer inspection has been captured for this branch.
- Confirm actual compositor promotion, frame-time distribution, and GPU memory in Chromium DevTools before describing the new particle animation as verified GPU execution.

## Current measurement status

- **Turbopack pre-optimization baseline:** 7,411 graph records, 58 homepage `/` client JS outputs (**2,880,282 B raw / 1,164,449 B compressed**).
- **Turbopack post-optimization snapshot:** 7,415 graph records, 58 homepage `/` client JS outputs (**2,890,766 B raw (+10,484 B) / 1,168,296 B compressed (+3,847 B)** — zero extra client chunks added).
- **Live browser verification (headless Chromium 1440x900 & 390x844):** Verified `perfTier="full"` steady ~60 Hz (`16.6–16.8 ms`) rAF cadence, `30 FPS` / `60 FPS` switching in Settings → پایداری toggling `data-perf-tier` between `"lite"` and `"full"`, zero synchronous `localStorage` spam during Canvas & Workflow Studio wheel zoom bursts, imperative `--drag-tilt` rotation without parent re-renders during node drag, zero horizontal overflow on `390x844` mobile, and clean `bun run build` static export.
