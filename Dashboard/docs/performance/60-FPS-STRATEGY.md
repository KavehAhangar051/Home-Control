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
- `components/motion/dock.tsx`: the stationary Dock shell no longer forces an additional `transform-gpu` promotion. Its active pill retains a scoped transform hint because that element actually moves; the shell keeps its existing translucent backdrop appearance. The backdrop filter may still require browser-managed compositing/raster resources.
- `components/motion/color-picker.tsx`: uses `useSpring`/`useTransform`/`MotionValue` for cursor thumb and pendulum loupe without React state loops on drag; panel reveal avoids blur in `"lite"` tier.
- `components/motion/range-slider*.tsx`: drives fill and thumb transforms via `MotionValue` + `useSpring`.
- `components/motion/theme-toggle.tsx`, `components/motion/theme-toggle-config.ts` & `styles/view-transitions.css`: theme changes use native View Transitions without synchronous `document.body.offsetHeight` forced reflow; `"lite"` tier switches `circle-blur` to the non-blurred circle reveal and overrides the inherited `will-change: clip-path, filter` with `will-change: clip-path` plus `filter: none`, avoiding an unnecessary filter layer while preserving the circle reveal.
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

### Implemented GPU-first & LUT infrastructure

- `lib/gpuLut.ts`: precomputed typed-array LUTs eliminate repeated per-frame CPU math across color/palette generation (`themeStyles.ts`), HSV→RGB & hex formatting (`color-picker.tsx`), Gaussian wave crests (`range-slider-wave.tsx`), cubic easing and frame-delta physics decay (`sheetViewportAnimator.ts`, `use-cursor-listeners.ts`), and cubic Bezier Bernstein basis sampling (`composited-bezier-particle.tsx`).
- `lib/gpuDisplay.ts` & `lib/hooks/use-gpu-display.ts`: probes native display resolution, `devicePixelRatio`, GPU backend (`webgpu`/`webgl2`/`webgl`/`2d`), and display refresh rate (`60/90/120/144/165/240/360 Hz`) via a one-shot 14-frame `requestAnimationFrame` pass, synchronizes `--display-dpr`/`--display-fps`/`--display-pixel` CSS variables, provides `snapToDevicePixel` for crisp native-DPR transforms, and exposes a WebGL2 `TEXTURE_3D` LUT uploader (`upload3dColorLutTexture`).
- `components/motion/composited-bezier-particle.tsx`: Canvas and Workflow Bezier signal particles pre-sample cubic curves through `sampleEqualArcCubicBezier` (with a bounded keyframe cache) and animate equal-distance `translate3d`/opacity WAAPI keyframes on compositor layers with one shared visibility pause listener and `useReducedMotion()` support.
- `app/globals.css`, `styles/view-transitions.css`, `theme-toggle-config.ts`, `sheetViewportAnimator.ts`, `CanvasWorkspace.tsx`, `WorkflowStudio.tsx`, `loader.tsx`, `loader-shapes.tsx`, `range-slider-*.tsx`, `expandable-tabs.tsx`, and card/node components: keyframes and active transforms use 3D transforms (`translate3d`/`scale3d`/`rotate3d`, `backface-visibility: hidden`), `Percent` loader uses native-FPS `rAF` + `scaleX` instead of 25fps `setInterval`, `Metaballs` animates GPU `x` instead of SVG `cx`, interactive cards/nodes avoid CPU `width`/`height`/`box-shadow` transitions, and collapsible panels isolate layout via `contain: layout style`.
- Hot-path layout & async hardening: `use-portal-target.ts` replaces `document.body` `MutationObserver({ subtree: true })` with an O(1) portal registry wired to `DashboardMain.tsx`; `use-slider.ts`, `color-picker.tsx`, and `useSheetViewportGestures.ts` cache bounding rects across active drag/pinch/wheel frames; `lib/i18n.tsx` removes per-render `JSON.stringify`/`JSON.parse`; `persianDateUtils.ts` caches calendar-day formatting; and `lib/asyncScheduler.ts` (`yieldToMain` + `scheduleIdleStorageWrite`) moves interactive storage writes (`createUiSlice.ts`, `lib/fonts.ts`, `useTrellisWorkspaceController.ts`, `AmbientManager.ts`) and full-config serialization (`buildEspConfig.ts`) off active UI frames.
- Always-running global shell GPU/VRAM offload: `CustomCursor` moves 3D tilt/scale easing into its native-FPS LUT rAF loop (zero CSS transition thrashing, cached DPR, isolated SVG VRAM layer); `ClockWidget` + `RealTimeClock` run with zero per-second React re-renders via wall-clock-aligned imperative text + `rotate3d` GPU hand updates; `.animate-pulse`/`.animate-ping`/`.animate-spin`/`.animate-node-spark*` promote onto isolated VRAM layers in `globals.css`; `.cn-tooltip-content` in `reui-nova.css` uses 3D GPU transforms; `lib/audio/index.ts` detaches global unlock capture listeners once primed; `nodeMotion.ts` switches pan inertia to LUT + 3D transforms; and `TrellisSegmentTile`/`TrellisSegmentView`/`Input`/`Select`/`Toggle` drop CPU `box-shadow` transitions.
- Framework, bundler, CSS & browser platform flags: `next.config.ts` enables production `inlineCss`, `cssChunking: "graph"`, `scrollRestoration`, `optimizeServerReact`, SWC `removeConsole` (preserving `error`/`warn`), `poweredByHeader: false`, expanded `optimizePackageImports`, and Turbopack DCE/CJS tree-shaking/cross-module constant inlining/chunking priority flags; `package.json` targets Tailwind v4 evergreen `browserslist` (`ES2022` and `"strict": true` in `tsconfig.json`); `app/layout.tsx` sets `viewport.colorScheme`, `appleWebApp`, PWA icons, and MQTT/Cloudflare `preconnect` hints; `app/globals.css` adds Houdini `@property` tokens, `interpolate-size: allow-keywords`, `overscroll-behavior: none`, `touch-action: manipulation`, and `prefers-contrast` / `forced-colors` rules; `asyncScheduler.ts` adds `scheduler.postTask` + `freeze` flush; `resilience.ts` prefers native `AbortSignal.timeout()`; `cloudflare/api.ts` uses Fetch `priority: "high"` + bounded `keepalive`; `usePageVisibility.ts` handles bfcache `pageshow`, `resume`, and `pagehide`; `lib/audio/context.ts` requests `latencyHint: "interactive"`; and `gpuDisplay.ts` exposes wide-gamut (`color-gamut`), HDR (`dynamic-range`), and `webgpu` attributes on `<html>`.
- Runtime telemetry, SSG shell & platform ergonomics: `features/dashboard/components/layout/DashboardClientEntry.tsx` renders `DashboardShell` directly (with hydration-safe post-mount `workspaceDisplayMode` restoration in `useCrossTabSync`) so static export prerenders real shell HTML; `lib/perfObserver.ts` (`usePerfObserver`) records LoAF, INP (`event`), LCP, and CLS with zero DOM overhead on `window.__dashboardPerf`; `app/manifest.ts` + `public/sw.js` + `lib/hooks/use-pwa.ts` provide offline-capable PWA installability; `lib/hooks/use-wake-lock.ts` integrates `navigator.wakeLock` for wall tablets; and `lib/hooks/use-cross-tab-sync.ts` synchronizes theme, display mode, and preferences live across browser tabs via `BroadcastChannel` + `storage` events.
- First-paint optimization & transfer compression: `next.config.ts` sets `compress: true` + `experimental.inlineCss` + `cssChunking: "graph"` (inlining critical CSS with zero render-blocking stylesheet links); `scripts/compress-export.mjs` emits `.br` (Brotli q=11) and `.gz` (Gzip level=9) sidecars for `.html`/`.css`/`.js`/`.json`/`.webmanifest`/`.svg`/`.txt` in `out/` alongside `scripts/serve-compressed.mjs`; and `DashboardContainer.tsx` dynamically defers non-critical chunks (`DeferredPlatformRuntime`, fine-pointer `CustomCursor`, `ScrollToTopButton`, and idle-warmed `ToastNotification` + `lib/audio`) until after First Paint (`requestAnimationFrame` + `scheduleIdleTask`).

### 3D LUT WebGL2 surfaces

- `upload3dColorLutTexture` (`lib/gpuDisplay.ts`) and the WebGL 2 3D LUT surface pipeline (`GPU-RENDERING.md`) remain scoped for dedicated decorative GPU surfaces without distorting interactive semantic UI colors, text contrast, or user theme palettes.

### Verification status

- Source-level change only: no browser performance trace or compositor-layer inspection has been captured for this branch.
- Confirm actual compositor promotion, frame-time distribution, and GPU memory in Chromium DevTools before describing the new particle animation as verified GPU execution.

## Workflow edge hover transitions

- Workflow edge hover previously transitioned SVG `stroke` and `stroke-opacity` on the main Bezier path and endpoint circles, which can trigger repeated SVG paint work.
- The edge now keeps its base stroke stable and cross-fades a destructive-color overlay using `opacity`. This is compositor-friendly, but SVG layer promotion and GPU execution remain browser-dependent; verify with paint flashing and a performance trace on target browsers.
- The selected edge retains its existing visual state. The hover treatment is not a guarantee that the entire SVG scene is GPU-only.

## WebGL 2 LUT surfaces

- The opt-in WebGL 2 3D LUT foundation is documented in `GPU-RENDERING.md`. It is intended for decorative image surfaces only and is not mounted in the dashboard shell.
- LUT surfaces redraw on source/LUT/size changes rather than maintaining a continuous frame loop. They create contexts near the viewport, cap backing-store dimensions, and retain an original-image fallback.
- Do not count the renderer as a dashboard-wide GPU migration until a real surface is integrated and its GPU memory, context count, frame time, color output, and context restoration are profiled on target hardware.

## Current measurement status

- **Turbopack pre-optimization baseline:** 7,411 graph records, 58 homepage `/` client JS outputs (**2,880,282 B raw / 1,164,449 B compressed**).
- **Turbopack post-optimization snapshot:** 7,415 graph records, 58 homepage `/` client JS outputs (**2,890,766 B raw (+10,484 B) / 1,168,296 B compressed (+3,847 B)** — zero extra client chunks added).
- **Live browser verification (headless Chromium 1440x900 & 390x844):** Verified `perfTier="full"` steady ~60 Hz (`16.6–16.8 ms`) rAF cadence, `30 FPS` / `60 FPS` switching in Settings → پایداری toggling `data-perf-tier` between `"lite"` and `"full"`, zero synchronous `localStorage` spam during Canvas & Workflow Studio wheel zoom bursts, imperative `--drag-tilt` rotation without parent re-renders during node drag, zero horizontal overflow on `390x844` mobile, and clean `bun run build` static export.
