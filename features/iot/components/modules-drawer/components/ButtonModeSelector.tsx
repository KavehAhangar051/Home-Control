import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface ButtonModeSelectorProps {
  buttonMode: "switch" | "push";
  setButtonMode: (mode: "switch" | "push") => void;
  animationsEnabled?: boolean;
}

export default function ButtonModeSelector({ buttonMode, setButtonMode }: ButtonModeSelectorProps) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs theme-text-secondary font-medium block">نوع عملکرد کلید کنترل</div>
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
          className="h-9 w-full text-xs font-medium font-sans rounded-lg cursor-pointer aria-pressed:bg-[var(--card-hover-bg)] aria-pressed:border-[var(--accent3)] aria-pressed:text-[var(--text-primary)]"
        >
          کلید دوحالته (دائمی)
        </ToggleGroupItem>
        <ToggleGroupItem
          value="push"
          className="h-9 w-full text-xs font-medium font-sans rounded-lg cursor-pointer aria-pressed:bg-[var(--card-hover-bg)] aria-pressed:border-[var(--accent3)] aria-pressed:text-[var(--text-primary)]"
        >
          شستی (لحظه‌ای)
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
