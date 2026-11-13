import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface ButtonModeSelectorProps {
  buttonMode: "switch" | "push";
  setButtonMode: (mode: "switch" | "push") => void;
  animationsEnabled?: boolean;
}

export default function ButtonModeSelector({ buttonMode, setButtonMode }: ButtonModeSelectorProps) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] theme-text-tertiary font-bold block">نوع عملکرد کلید کنترل:</div>
      <ToggleGroup
        variant="outline"
        spacing={2}
        value={[buttonMode]}
        onValueChange={(vals) => {
          const val = vals[0];

          if (val === "switch" || val === "push") setButtonMode(val);
        }}
        className="grid w-full grid-cols-2"
      >
        <ToggleGroupItem
          value="switch"
          className="h-9 w-full text-[10px] font-bold font-sans rounded-xl cursor-pointer aria-pressed:bg-[var(--accent3-transparent)] aria-pressed:border-[var(--accent3)] aria-pressed:text-[var(--accent3)]"
        >
          سوییچ (دائمی Toggle)
        </ToggleGroupItem>
        <ToggleGroupItem
          value="push"
          className="h-9 w-full text-[10px] font-bold font-sans rounded-xl cursor-pointer aria-pressed:bg-[var(--accent3-transparent)] aria-pressed:border-[var(--accent3)] aria-pressed:text-[var(--accent3)]"
        >
          شستی (لحظه‌ای Shasti)
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
