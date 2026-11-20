# Design System — Home Control Dashboard

## Product and UX direction

Home Control Dashboard is a Persian-first control surface for ESP32 home automation. The interface should feel like a focused product workspace: calm, operational, and predictable under frequent use.
Use ChatGPT and Cloudflare Dashboard as interaction references, not as assets or exact copies. Prefer clear hierarchy, restrained chrome, subtle separators, consistent spacing, and controls whose state is immediately understandable.

## Navigation and header

- On desktop (`md` and above), navigation uses a vertical rail on the right side of the viewport, consistent with the application's RTL direction, paired with a bottom desktop footer bar.
- On mobile (`< md`), the right rail and desktop footer are hidden; navigation uses a centered floating bottom Dock with upward-expanding `ExpandableTabs` panels (`MobileDockNav`) supporting downward swipe-to-dismiss and an integrated press-and-hold voice command trigger, while `ThemeToggle` lives cleanly in the mobile top breadcrumb bar.
- Custom buttons / macros live cleanly inside the top `DashboardBreadcrumb` header (desktop next to `WorkspaceViewModeSelector`, mobile next to `ThemeToggle`) as a compact quick-run button or anchored dropdown selector so Grid, Trellis, and Canvas remain unobstructed.
- Every submenu entry (`Modules`, `Automations`, `Settings`) pairs its Persian label with a semantic Lucide icon across desktop sidebar submenus, mobile Dock upward panels, mobile subsection tabs, and breadcrumbs.
- Status notifications (`ToastNotification`) render as compact single-line pills anchored in the top header band inside a `pointer-events-none` wrapper with click and upward swipe-to-dismiss so they never cover segment cards or block clicks on mobile or desktop.
- In Trellis workspace mode, `TrellisChromeBar` exposes three built-in presets (`نمای گروه‌ها`, `پنل دیواری`, `همه قطعات`) plus a `چیدمان‌ها` popover for saving, restoring, and deleting named custom panel arrangements locally.
- Do not expose header-position switchers or controls that move desktop navigation to another edge.
- Preserve existing application actions and behavior when adjusting navigation. Presentation changes must not alter MQTT topics, ESP32 payloads, Cloudflare synchronization, or automation logic.
- The product title may remain editable, but it must not control header placement.

## Color and appearance

- Default appearance starts in dark mode (`Graphite` neutral ramp `#141415`) and supports user switching to light mode through `ThemeToggle` using the native View Transition API with a reduced-motion fallback.
- Settings expose controlled customization for primary/secondary accents (`accent3`, `accent4`) and dark/light contrast balance (`darkBlackness`, `lightWhiteness`), applied through CSS custom properties (`--bg-main`, `--card-bg-solid`, `--border-color`, `--text-*`, `--accent3`, `--accent4`).
- Active (`1`) output and input segments share unified `accent3` surface (`bg-accent3-transparent`), border (`border-accent3`), icon badge (`bg-accent3 text-accent3-foreground`), and Canvas wire/port styling, while input segments remain clearly distinguished via a read-only `ورودی` footer badge.
- Prefer neutral surfaces, restrained borders, and readable contrast across active, pending, disabled, and error states. Do not rely on color alone to convey device state.
- When `data-perf-tier="lite"` or `animationsFps=30` is active on resource-constrained devices, multi-layer `backdrop-blur` and expensive per-frame filters step down cleanly to crisp solid surfaces without flattening state hierarchy.

## Typography

- **Dana** (`--font-dana`, bundled locally via `next/font/local` with Persian `FaNum` glyphs) is the default UI font.
- Five selectable secondary fonts (`Vazirmatn`, `IBM Plex Sans Arabic`, `Noto Sans Arabic`, `Rubik`, `Readex Pro`) are configured in `app/layout.tsx` (`preload: false`) and managed through `lib/fonts.ts` so users only fetch non-default webfonts when chosen.
- Use a consistent type scale (`text-fluid-*` / tabular numbers for telemetry and counters). Keep Persian labels concise and aligned naturally in RTL layouts.

## Layout and responsive behavior

- The root document uses Persian language and RTL direction.
- Keep the right rail distinct from the workspace with spacing and a subtle border/surface difference rather than heavy shadows.
- The workspace must remain usable at desktop, tablet, and mobile widths. Group cards (`@container/group`), Trellis panels (`@container/trellis-group`), segment cards (`@container/segment`), and Settings/Workspace containers (`@container/workspace`, `@container/settings-card`) adapt directly to their own container width via Tailwind CSS v4 container queries. On narrow screens, keep navigation reachable and compact; do not fall back to a top header.
- Prefer consistent spacing and a small set of corner radii. Use cards only when grouping content improves scanning or task completion.

## Interaction and accessibility

- Use semantic buttons, accessible names for icon-only controls, visible keyboard focus, and appropriate disabled/pending states.
- Distinguish a requested command from confirmed device state when MQTT, WebSocket, or Cloudflare communication may fail: segment tiles paint instant optimistic feedback via React 19 `useOptimistic` with a subtle pulsing indicator while awaiting confirmation and automatic rollback on failure.
- Subtle mobile haptic feedback (`lib/haptics.ts` via Web Vibration API) reinforces segment toggles, push presses, macro execution, voice push-to-talk, and toast alerts, while remaining user-controllable in Stability settings (`HapticsToggle`) and automatically disabled under `prefers-reduced-motion`.
- Stability settings (`BackupRestoreSection`) and Workflow Studio (`WorkflowHeaderBar`, `WorkflowFooterControls`) expose direct JSON backup/export, restore/import, and native sharing (`File System Access API` + `Web Share API` with graceful download/input/clipboard fallbacks), alongside Workflow Studio Undo/Redo (`Ctrl+Z`/`Ctrl+Y`), Copy/Paste/Duplicate (`Ctrl+C`/`Ctrl+V`/`Ctrl+D`), and Sub-flow container grouping (`Ctrl+G`).
- Preserve rich Motion springs, transforms, opacity transitions, and View Transitions by default; adaptively step down GPU-heavy filters and continuous ambient loops on struggling devices while never blocking essential interaction feedback.
- **Canvas Sheet & Workflow Studio spatial motion (`sheetViewportAnimator.ts`):** Moving across the infinite Canvas Sheet (`CanvasWorkspace` and `WorkflowStudio`) should feel tactile, physically grounded, and locked at 60 FPS even on weaker devices—driving transient pan, momentum inertia coasting, smooth spring-interpolated focal wheel/button/pinch zoom, and cubic-out camera flight (`Fit View`, `Reset Layout`) imperatively on the composited world plane (`worldPlaneRef`) with zero React re-renders per frame, paired with non-inherited velocity-driven card sway (`el.style.rotate` and `el.style.translate` on `[data-canvas-node-motion="true"]`) that preserves 100% of animations and transitions whenever `animationsEnabled` is active.
- **Analog PWM dimmer cards & rules (`AnalogOutputBody`, `AddSegmentForm`, `ConditionActionItem`):** `analog_output` segments share the unified `accent3` active visual language across Grid, Trellis, and Canvas, pairing a tactile Power keycap (`0x01`, restoring last non-zero intensity) with a `DashboardSlider` (`0x0A`, 100ms drag throttle + immediate release flush) and tabular `%` telemetry, while the Modules form provides recommended PWM pin quick-picks and resolution/frequency presets and the Conditions editor toggles between boolean mode and exact PWM duty sliders.
- **Adaptive beUI Motion Sliders (`DashboardSlider`, `SliderStyleSection`):** Every slider in the dashboard renders through the 6 beUI motion primitives (`InlineSlider`, `RangeSlider`, `FluidSlider`, `WaveSlider`, `BubbleSlider`, `RulerSlider`). By default (`auto`), each surface uses its most ergonomic design (`Fluid` on PWM cards, `Inline` in appearance tuning, `Ruler` on Auto-Off timers, `Bubble` in segment creation, and `Range` in rule editors), and users can switch all dashboard sliders globally to any of the 6 models with a live interactive preview inside Settings → Appearance.
- Respect both `animationsEnabled` and `prefers-reduced-motion` (`MotionConfig reducedMotion`). Sound and haptics must never be required to understand or complete an action.
- **Impeccable craft, touch & RTL hardening (`themeStyles.ts`, `baseStyles.ts`, `reui-nova.css`, `use-slider.ts`, `color-picker.tsx`, `lib/persianText.ts`):** Technical badges, GPIO pins, timers, and logic gate labels keep tabular monospace (`--font-mono`, excluded from the Persian sans override); `.cn-alert` uses logical RTL properties (`text-start`, `pe-18`, `end-2`); `touch-none` is scoped strictly to drag handles (`GroupHeader`, `CardHeader`, `PlaceholderCard`) so mobile page scrolling never stalls over cards; sliders and the color picker isolate active `pointerId` and recover cleanly on `lostpointercapture` / `window` `blur`; hover rules gate on `@media (hover: hover) and (pointer: fine)`; keyboard `focus-visible` rings and single-`<h1>` landmark hierarchy hold across all views; and GPIO input / Workflow search normalize Persian/Arabic numerals (`۰-۹`/`٠-٩`) and `ي`/`ك` variants while preserving ZWNJ (`\u200C`).

## Implementation boundaries

- Root layout and global font loading: `app/layout.tsx` and `app/globals.css`.
- Desktop right-rail header/navigation (`md:`+): `components/MasterHeader.tsx` and `components/MasterHeader/`.
- Mobile floating Dock navigation (`< md`): `components/motion/{dock.tsx,expandable-tabs.tsx,expandable-tabs-layout.ts}` and `features/dashboard/components/layout/MobileDockNav.tsx`.
- Dashboard composition: `features/dashboard/components/layout/` (`DashboardHeader.tsx`, `DashboardBreadcrumb.tsx`, `DashboardMain.tsx`, `MobileDockNav.tsx`).
- Shared dynamic CSS: `features/iot/components/DashboardStyles.tsx` and `features/iot/components/styles/`.
- Settings UI: `features/settings/components/SettingsDrawer/`.
- Keep styling local to the owning component unless it is a genuine shared token.
- Make surgical changes: redesign navigation or appearance controls without refactoring unrelated dashboard, device, or automation features.
- **Documentation & verification discipline:** Update `DESIGN.md` (and `ARCHITECTURE.md`) immediately after any UI, layout, or token change so this guide stays accurate and trustworthy. Do not write unit tests for UI styling, Tailwind classes, pixel layouts, or animations.