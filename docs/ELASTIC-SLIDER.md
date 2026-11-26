# Dissolve ElasticSlider

`ElasticSlider` is a standalone, canvas-backed value control at `components/dissolve/elastic-slider.tsx`. It is integrated as the seventh selectable style in the shared `DashboardSlider` facade. Existing six beUI variants remain available, and the global appearance preference can apply Elastic to every slider that uses the facade.

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
| `defaultValue` | `number` | `50` | Initial uncontrolled value |
| `onValueChange` | `(value: number) => void` | — | Fires when the value changes |
| `onValueCommit` | `(value: number) => void` | — | Fires when a pointer gesture ends or a key changes the value |
| `min / max / step` | `number` | `0 / 100 / 1` | Value range and increment |
| `formatValue` | `(value: number) => string` | `String(value)` | Visible value formatting |
| `formatValueText` | `(value: number) => string` | `formatValue` result | Accessible value announcement, including units or localized text |
| `icon` | `({ color, size }) => ReactNode` | — | Optional leading icon; receives the correct foreground for each fill layer |
| `size` | `"sm" | "md"` | `"md"` | Track height preset |
| `showValue` | `boolean` | `true` | Hides the visible value when false |
| `showTicks` | `boolean` | `true` | Shows boundary and per-step marks when the range has at most 20 steps |
| `disabled` | `boolean` | `false` | Disables pointer and keyboard input |
| `className` | `string` | — | Adds a class to the root |
| `partClassNames` | `Partial<Record<ElasticSliderPart, string>>` | — | Styles individual parts |

## Interaction

- Tap/click anywhere on the track to jump to that value; dragging follows the pointer's displacement.
- Pulling beyond either endpoint stretches the canvas track with resistance; release springs it back.
- Numeric characters roll independently as the value changes.
- UI click feedback and a short vibration fire on each step when there are 20 or fewer steps, otherwise only at the endpoints.
- Arrow keys adjust by one step; Shift + Arrow and Page Up/Down use a larger increment; Home and End select the bounds.
- The slider exposes `role="slider"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, and a separately formatted `aria-valuetext`.
- Boundary and per-step tick marks are drawn when the range contains 20 or fewer steps.
- In dashboard usage, `size="sm"` is selected for compact/ultra controls and the root can shrink below the standalone 180px minimum width.

The fill direction is intentionally left-to-right, independent of the dashboard's RTL document direction. Colors inherit from `--dissolve-surface`, `--dissolve-primary`, `--dissolve-foreground`, and `--dissolve-primary-foreground`.