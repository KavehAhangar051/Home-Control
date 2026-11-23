import { Check } from "@/components/ui/hugeicons-groups/controls";

interface ButtonModeSelectorProps {
  buttonMode: "switch" | "push";
  setButtonMode: (mode: "switch" | "push") => void;
  animationsEnabled?: boolean;
}

const BUTTON_MODES = [
  {
    value: "switch" as const,
    title: "کلید دوحالته",
    description: "با هر لمس روشن یا خاموش می‌ماند",
  },
  {
    value: "push" as const,
    title: "شستی لحظه‌ای",
    description: "فقط هنگام نگه‌داشتن وصل است",
  },
] as const;

export default function ButtonModeSelector({ buttonMode, setButtonMode }: ButtonModeSelectorProps) {
  return (
    <fieldset className="space-y-2.5">
      <legend className="text-xs font-semibold text-text-primary">رفتار کلید کنترل</legend>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {BUTTON_MODES.map((option) => {
          const isSelected = buttonMode === option.value;

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setButtonMode(option.value)}
              className={`flex min-h-11 cursor-pointer items-start justify-between gap-3 rounded-xl border p-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 ${
                isSelected
                  ? "border-accent3 bg-accent3-transparent text-text-primary"
                  : "border-border-color bg-bg-main text-text-secondary hover:border-text-muted/60 hover:text-text-primary"
              }`}
            >
              <div className="min-w-0 space-y-1">
                <span className="block text-xs font-semibold text-text-primary">
                  {option.title}
                </span>
                <span className="block text-[11px] leading-5 text-text-muted">
                  {option.description}
                </span>
              </div>
              <span
                aria-hidden="true"
                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  isSelected
                    ? "border-accent3 bg-accent3 text-accent3-foreground"
                    : "border-border-color bg-transparent text-transparent"
                }`}
              >
                <Check className="size-3" strokeWidth={2.25} />
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
