# Dissolve ElasticSlider

`ElasticSlider` is a standalone, framework-free DOM/motion value control at `components/dissolve/elastic-slider.tsx`. It is integrated as the seventh selectable style in the shared `DashboardSlider` facade. Existing six beUI variants remain available, and the global appearance preference can apply Elastic to every slider that uses the facade.

## Usage

```tsx
import { useState } from "react";
import { ElasticSlider } from "@/components/dissolve/elastic-slider";

export function VolumeControl() {
  const [volume, setVolume] = useState(40);

  return (
    <ElasticSlider
      label="Volume"
      value={volume}
      onValueChange={setVolume}
      formatValue={(value) => `${value}%`}
    />
  );
}
```

## Use it across the dashboard

Dashboard controls should use the shared facade so the user's global style preference applies consistently:

```tsx
import { DashboardSlider } from "@/components/motion/dashboard-slider";

<DashboardSlider
  defaultVariant="fluid"
  label="روشنایی"
  value={brightness}
  onValueChange={setBrightness}
  min={0}
  max={100}
  unit="%"
  format={(value) => `${value}%`}
/>
```

When «کشسان و غلتان» is selected in Settings → Appearance → Slider Style, this control automatically renders as `ElasticSlider`. The `defaultVariant` is used again when the preference is reset to «هوشمند».

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `label` | `string` | required | Visible label and accessible name |
| `value` | `number` | — | Controlled value |
| `defaultValue` | `number` | `min` | Initial uncontrolled value; defaults to the minimum |
| `onValueChange` | `(value: number) => void` | — | Fires when the value changes |
| `onValueCommit` | `(value: number) => void` | — | Dashboard adapter alias for Dissolve's `onSlidingComplete` callback |
| `min / max / step` | `number` | `0 / 100 / 1` | Value range and increment |
| `formatValue` | `(value: number) => string` | `String(value)` | Visible value formatting |
| `formatValueText` | `(value: number) => string` | visible formatted value | Optional screen-reader value announcement |
| `icon` | `({ color, size }) => ReactNode` | — | Optional leading icon; receives the correct foreground for each fill layer |
| `size` | `"sm" | "md" | "lg"` | `"md"` | Track height preset (32 / 44 / 56px) |
| `showValue` | `boolean` | `true` | Hides the visible value when false |
| `showTicks` | `boolean` | `true` | Shows boundary and per-step dots when the range has at most 20 steps |
| `haptics` | `boolean` | `true` | Enables short haptic feedback at endpoints and on ranges with 20 steps or fewer |
| `disabled` | `boolean` | `false` | Disables pointer and keyboard input |
| `className` | `string` | — | Adds a class to the root |

## Interaction

- Tap/click anywhere on the track to jump to that value; dragging follows the pointer's displacement.
- Pulling beyond either endpoint stretches the entire track with rubber-band resistance; release springs it back with a bounce.
- Numeric characters roll independently as the value changes.
- Haptic feedback follows the dashboard's Stability → Haptics preference and only runs after browser user activation.
- Arrow keys adjust by one step; Shift + Arrow and Page Up/Down use a larger increment; Home and End select the bounds.
- The slider exposes `role="slider"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, and `aria-valuetext`; `formatValueText` can localize the announcement separately from the visible value.
- Haptic feedback runs at endpoints and on every step when the range has 20 steps or fewer. This dashboard extension also draws small boundary and per-step dots for ranges of 20 steps or fewer.
- In dashboard usage, `size="sm"` is selected for compact/ultra controls; the upstream component uses its natural parent width.

The fill direction and label/value ordering are explicitly LTR inside the control, independent of the dashboard's RTL document direction. Colors inherit from `--dissolve-background` and `--dissolve-foreground`; the fill uses the foreground token and the empty track derives a low-alpha foreground tint.