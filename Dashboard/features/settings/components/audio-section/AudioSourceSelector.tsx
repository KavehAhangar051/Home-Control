import { Globe, HardDrive } from "@/components/ui/hugeicons";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface Props {
  musicSource: "local" | "api";
  onSourceChange: (source: "local" | "api") => void;
}

export function AudioSourceSelector({ musicSource, onSourceChange }: Props) {
  return (
    <div className="space-y-3 pt-4 border-t border-[var(--border-color)]">
      <p className="text-xs text-[var(--text-primary)] font-bold text-right">منبع موزیک</p>
      <ToggleGroup
        variant="outline"
        spacing={2}
        value={[musicSource]}
        onValueChange={(vals) => {
          const val = vals[0];

          if (val === "local" || val === "api") onSourceChange(val);
        }}
        className="grid w-full grid-cols-2"
      >
        <ToggleGroupItem
          value="api"
          className="h-auto w-full p-3 rounded-xl flex flex-col items-center justify-center gap-2 aria-pressed:bg-[var(--accent3-transparent)] aria-pressed:border-[var(--accent3)] aria-pressed:text-[var(--accent3)]"
        >
          <Globe className="w-5 h-5" />
          <span className="text-xs font-semibold">موزیک‌های آنلاین</span>
          <span className="text-[11px] opacity-75">آرشیو آنلاین موسیقی بی‌کلام</span>
        </ToggleGroupItem>

        <ToggleGroupItem
          value="local"
          className="h-auto w-full p-3 rounded-xl flex flex-col items-center justify-center gap-2 aria-pressed:bg-[var(--accent4-transparent)] aria-pressed:border-[var(--accent4)] aria-pressed:text-[var(--accent4)]"
        >
          <HardDrive className="w-5 h-5" />
          <span className="text-xs font-semibold">موزیک ثابت</span>
          <span className="text-[11px] opacity-75">قطعه پیش‌فرض محلی</span>
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
