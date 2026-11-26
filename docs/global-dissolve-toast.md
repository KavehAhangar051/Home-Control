# Global Dissolve Toast

The dashboard uses the web Toast component from [dissolve-ui](https://dissolve.rselmi.com/components/toast/). The React wrapper and framework-free Canvas core are source-controlled under `components/dissolve/`; the grain engine is shared with the other Dissolve web components. No runtime dependency is added: the app already runs React 19 and react-dom.

## Global setup

`GlobalToastProvider` is mounted once in `app/layout.tsx`, above every dashboard route. It configures `top={8}` and `max={3}`. The oldest live item exits through the Dissolve dust animation when a fourth notification arrives. The core respects `prefers-reduced-motion`.

## Usage

```tsx
import { useToast } from "@/components/dissolve/toast";

function SaveButton() {
  const toast = useToast();

  const save = async () => {
    await saveSettings();
    toast.show({ title: "تنظیمات ذخیره شد", tone: "success" });
  };

  return <button onClick={save}>ذخیره</button>;
}
```

Supported options: `title`, optional `message`, `tone: "default" | "success" | "error"`, optional `duration` (zero means persistent), optional `action: { label, onPress }`, plus `enter` and `exit` Dissolve presets. The default entrance is `gather`; the default exit is `dust`.

## Existing notification compatibility

Existing `useIoTStore.getState().showToast(message, "success" | "error")` calls are forwarded by `LegacyToastBridge` into Dissolve, preserving existing call sites while replacing the old renderer. New components should call `useToast` directly, particularly when they need a message body or an action.

## Theme and direction

`components/dissolve/theme.css` maps every Dissolve color token to the dashboard's semantic CSS variables. The toast core's canvas text and action placement are RTL-aware. The action remains keyboard activatable when present. The grain engine uses its own pointer-transparent viewport canvas for the particle effect.

## Ownership

These files are copied source, not runtime imports from the npm package: `toast.tsx`, `toast.core.ts`, and `engine.ts`. Shared helpers remain in the existing `kit.ts` and `react.ts`. `dissolve.json` already declares the web platform and `components/dissolve` directory.
