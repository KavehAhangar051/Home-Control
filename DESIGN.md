# Design System — Home Control Dashboard

## Product and UX direction

Home Control Dashboard is a Persian-first control surface for ESP32 home automation. The interface should feel like a focused product workspace: calm, operational, and predictable under frequent use.
Use ChatGPT and Cloudflare Dashboard as interaction references, not as assets or exact copies. Prefer clear hierarchy, restrained chrome, subtle separators, consistent spacing, and controls whose state is immediately understandable.

## Navigation and header

- On desktop (`md` and above), navigation uses a vertical rail on the right side of the viewport, consistent with the application's RTL direction, paired with a bottom desktop footer bar.
- On mobile (`< md`), the right rail and desktop footer are hidden; navigation uses a centered floating bottom Dock with upward-expanding `ExpandableTabs` panels (`MobileDockNav`) and an integrated press-and-hold voice command trigger, while `ThemeToggle` lives cleanly in the mobile top breadcrumb bar.
- Do not expose header-position switchers or controls that move desktop navigation to another edge.
- Preserve existing application actions and behavior when adjusting navigation. Presentation changes must not alter MQTT topics, ESP32 payloads, Cloudflare synchronization, or automation logic.
- The product title may remain editable, but it must not control header placement.

## Color and appearance

- Default appearance starts in dark mode (`Graphite` neutral ramp `#141415`) and supports user switching to light mode through `ThemeToggle` using the native View Transition API with a reduced-motion fallback.
- Settings expose controlled customization for primary/secondary accents (`accent3`, `accent4`) and dark/light contrast balance (`darkBlackness`, `lightWhiteness`), applied through CSS custom properties (`--bg-main`, `--card-bg-solid`, `--border-color`, `--text-*`, `--accent3`, `--accent4`).
- Prefer neutral surfaces, restrained borders, and readable contrast across active, pending, disabled, and error states. Do not rely on color alone to convey device state.
- When `data-perf-tier="lite"` or `animationsFps=30` is active on resource-constrained devices, multi-layer `backdrop-blur` and expensive per-frame filters step down cleanly to crisp solid surfaces without flattening state hierarchy.

## Typography

- **Dana** (`--font-dana`, bundled locally via `next/font/local` with Persian `FaNum` glyphs) is the default UI font.
- Five selectable secondary fonts (`Vazirmatn`, `IBM Plex Sans Arabic`, `Noto Sans Arabic`, `Rubik`, `Readex Pro`) are configured in `app/layout.tsx` (`preload: false`) and managed through `lib/fonts.ts` so users only fetch non-default webfonts when chosen.
- Use a consistent type scale (`text-fluid-*` / tabular numbers for telemetry and counters). Keep Persian labels concise and aligned naturally in RTL layouts.

## Layout and responsive behavior

- The root document uses Persian language and RTL direction.
- Keep the right rail distinct from the workspace with spacing and a subtle border/surface difference rather than heavy shadows.
- The workspace must remain usable at desktop, tablet, and mobile widths. On narrow screens, keep navigation reachable and compact; do not fall back to a top header.
- Prefer consistent spacing and a small set of corner radii. Use cards only when grouping content improves scanning or task completion.

## Interaction and accessibility

- Use semantic buttons, accessible names for icon-only controls, visible keyboard focus, and appropriate disabled/pending states.
- Distinguish a requested command from confirmed device state when MQTT, WebSocket, or Cloudflare communication may fail.
- Preserve rich Motion springs, transforms, opacity transitions, and View Transitions by default; adaptively step down GPU-heavy filters and continuous ambient loops on struggling devices while never blocking essential interaction feedback.
- Respect both `animationsEnabled` and `prefers-reduced-motion` (`MotionConfig reducedMotion`). Sound must never be required to understand or complete an action.

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