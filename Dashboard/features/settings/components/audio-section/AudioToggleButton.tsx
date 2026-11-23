import { Activity, VolumeX } from "@/components/ui/hugeicons-groups/media";
import { Toggle } from "@/components/ui/toggle";

interface Props {
  isMusicOn: boolean;
  isLoading: boolean;
  onToggle: () => void;
}

export function AudioToggleButton({ isMusicOn, isLoading, onToggle }: Props) {
  return (
    <div>
      <Toggle
        variant="outline"
        pressed={isMusicOn}
        onPressedChange={() => onToggle()}
        disabled={isLoading}
        aria-label="موزیک پس‌زمینه"
        className={`switch-toggle w-full h-auto min-h-[5.5rem] flex-row-reverse justify-between gap-3 whitespace-normal rounded-2xl border p-4 text-right transition-colors duration-200 hover:bg-card-hover-bg hover:text-text-primary focus-visible:ring-accent3 group ${
          isMusicOn
            ? "bg-accent3-transparent aria-pressed:bg-accent3-transparent data-[state=on]:bg-accent3-transparent border-accent3 shadow-accent3-transparent"
            : "bg-card-bg-solid border-border-color hover:border-text-muted"
        } ${isLoading ? "opacity-70 cursor-not-allowed" : ""}`}
      >
        <div
          className={`flex h-6 w-10 shrink-0 items-center rounded-[8px] border p-1 transition-colors duration-300 ${
            isMusicOn ? "bg-accent3 border-transparent" : "bg-card-hover-bg border-border-color"
          }`}
        >
          <div
            className={`size-3.5 rounded-[4px] shadow-sm transition-transform duration-300 ${
              isMusicOn ? "bg-accent3-foreground translate-x-0" : "bg-text-secondary -translate-x-4"
            }`}
          />
        </div>

        <div className="min-w-0 flex-1 space-y-1 text-start">
          <span
            className={`block text-sm font-bold transition-colors ${
              isMusicOn ? "text-accent3" : "text-text-secondary"
            }`}
          >
            موزیک پس‌زمینه
          </span>
          <span className="block text-xs leading-relaxed text-text-muted">
            {isLoading ? "در حال بارگذاری..." : isMusicOn ? "فعال · در حال پخش" : "غیرفعال · متوقف"}
          </span>
        </div>

        <div
          className={`shrink-0 rounded-xl p-2.5 transition-colors duration-200 ${
            isMusicOn
              ? "bg-accent3-transparent text-accent3 border border-accent3/30"
              : "bg-card-hover-bg text-text-muted"
          }`}
        >
          {isMusicOn ? (
            <Activity className="size-5 motion-safe:animate-pulse" aria-hidden="true" />
          ) : (
            <VolumeX className="size-5" aria-hidden="true" />
          )}
        </div>
      </Toggle>
    </div>
  );
}
