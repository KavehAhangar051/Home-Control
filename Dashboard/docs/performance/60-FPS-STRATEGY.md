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

## Existing motion inventory (source audit, not runtime profiling)

- components/MotionProvider.tsx: async LazyMotion with domMax; retain domMax because layout and drag-related features are used.
- components/motion/action-swap-variants.ts: common label/icon transitions include blur filters alongside opacity and transform. Profile these effects under dense UI updates before changing the visual language.
- components/motion/color-picker.tsx: uses layout animation, spring/transform motion, and a blurred panel-item entrance. Inspect while dragging the color area and opening/closing the panel.
- components/motion/range-slider.tsx: drives fill and thumb positions with MotionValues/springs rather than React state for every visual interpolation.
- components/motion/loader.tsx: several continuous decorative loader variants exist. Keep loops limited to visible loading states and verify they stop when unmounted.
- components/motion/theme-toggle.tsx and styles/view-transitions.css: theme changes use native View Transitions with a reduced-motion fallback.
- Canvas drag, resize, and pan are frame-coalesced; persistent layout writes happen at gesture completion.

This inventory identifies profiling candidates. It does not prove that any listed animation currently drops frames.

## Verification protocol

Use equivalent production-mode sessions and the same device/browser for before/after comparisons. Cover:

- First dashboard render and initial hydration.
- Grid, Trellis, Canvas, and Workflow workspace switching.
- Canvas drag, resize, pan, and wire interactions.
- Workflow node drag and connection interactions.
- Rapid device-state changes while transitions and ambient UI are active.
- ColorPicker drag, RangeSlider drag, theme change, and common dialogs/menus.
- Touch input on a low-powered mobile device.

In Chrome DevTools, use the Performance panel's Frames and Animations tracks, the Rendering panel's Frame Rendering Stats/FPS meter, and paint flashing. Inspect dropped/partially presented frames, long tasks, layout/paint work, and compositing failures. Record the device, browser, refresh rate, route/workspace, interaction, and whether the run was production or development.

React Profiler and React Performance tracks help attribute React work, but their instrumentation adds overhead and is not a substitute for the browser's frame timeline. Bundle analyzer output is not an FPS measurement.

## Acceptance criteria

- On a 60 Hz target device, the common interaction scenarios should sustain approximately 60 FPS without recurring dropped-frame bursts.
- On higher-refresh displays, the app should not impose an unnecessary 60 FPS cap.
- State changes and input feedback remain responsive while decorative animations run.
- No repeated long tasks or forced-layout loops occur during common gestures.
- The weakest agreed reference device is recorded explicitly; results must not be generalized to every possible device.
- Any adaptive quality behavior must be driven by a demonstrated runtime bottleneck and must preserve essential state feedback, touch behavior, and reduced-motion settings.

## Current measurement status

**Not measured.** The repository currently has source-level optimization records and Turbopack bundle snapshots, but no comparable browser frame traces or device matrix. Do not claim a 60 FPS result until owner-led browser measurements are recorded.
