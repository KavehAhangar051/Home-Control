import { Activity, VolumeX } from "@/components/ui/hugeicons-groups/media";
import { useReducedMotion } from "motion/react";
import { Toggle as DissolveToggle } from "@/components/dissolve/toggle";

interface Props {
  isMusicOn: boolean;
  isLoading: boolean;
  onToggle: () => void;
}

export function AudioToggleButton({ isMusicOn, isLoading, onToggle }: Props) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div>
      <div className={`w-full h-auto min-h-[5.5rem] flex-row-reverse justify-between gap-3 whitespace-normal rounded-2xl border p-4 text-right transition-colors duration-200 hover:bg-card-hover-bg hover:text-text-primary focus-visible:ring-accent3 group ${
          isMusicOn
            ? "bg-accent3-transparent aria-pressed:bg-accent3-transparent data-[state=on]:bg-accent3-transparent border-accent3 shadow-accent3-transparent"
            : "bg-card-bg-solid border-border-color hover:border-text-muted"
        } ${isLoading ? "opacity-70 cursor-not-allowed" : ""}`}>

        <DissolveToggle
          value={isMusicOn}
          onValueChange={() => onToggle()}
          disabled={isLoading}
          size="sm"
          onColor="var(--accent3)"
          offColor="var(--card-hover-bg)"
          haptics={false}
          reducedMotion={Boolean(prefersReducedMotion)}
          accessibilityLabel="موزیک پس‌زمینه"
          className="shrink-0"
        />

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
      </div>
    </div>
  );
}
