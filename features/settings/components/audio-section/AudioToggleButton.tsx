"use client";

import { Toggle as DissolveToggle } from "@/components/dissolve/toggle";
import { Activity, VolumeX } from "@/components/ui/hugeicons-groups/media";
import { useReducedMotion } from "motion/react";

interface Props {
  isMusicOn: boolean;
  isLoading: boolean;
  onToggle: () => void;
}

export function AudioToggleButton({ isMusicOn, isLoading, onToggle }: Props) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div>
      <div
        onClick={() => {
          if (!isLoading) onToggle();
        }}
        className={`flex min-h-[5.5rem] w-full flex-row-reverse items-center justify-between gap-3 rounded-2xl border p-4 text-right transition-colors duration-200 hover:bg-card-hover-bg hover:text-text-primary ${
          isMusicOn
            ? "border-accent3 bg-accent3-transparent shadow-accent3-transparent"
            : "border-border-color bg-card-bg-solid hover:border-text-muted"
        } ${isLoading ? "cursor-not-allowed opacity-70" : ""}`}
      >
        <DissolveToggle
          value={isMusicOn}
          onValueChange={() => onToggle()}
          onClick={(event) => event.stopPropagation()}
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
          <span className={`block text-sm font-bold transition-colors ${
            isMusicOn ? "text-accent3" : "text-text-secondary"
          }`}>
            موزیک پس‌زمینه
          </span>
          <span className="block text-xs leading-relaxed text-text-muted">
            {isLoading ? "در حال بارگذاری..." : isMusicOn ? "فعال · در حال پخش" : "غیرفعال · متوقف"}
          </span>
        </div>

        <div
          className={`shrink-0 rounded-xl p-2.5 transition-colors duration-200 ${
            isMusicOn
              ? "border border-accent3/30 bg-accent3-transparent text-accent3"
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
