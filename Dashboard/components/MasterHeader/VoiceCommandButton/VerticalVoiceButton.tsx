import type { PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { Mic } from "@/components/ui/hugeicons";
import type { VoiceCommandButtonProps } from "./types";

interface VerticalVoiceButtonProps extends VoiceCommandButtonProps {
  isListening: boolean;
  handlePointerDown: (e: PointerEvent) => void;
  handlePointerUp: (e: PointerEvent) => void;
  handlePointerCancel: (e: PointerEvent) => void;
}

export default function VerticalVoiceButton({
  animationsEnabled,
  isListening,
  handlePointerDown,
  handlePointerUp,
  handlePointerCancel,
}: VerticalVoiceButtonProps) {
  return (
    <Button
      variant="ghost"
      type="button"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onContextMenu={(e) => e.preventDefault()}
      style={{ touchAction: "none" }}
      className={`flex h-9 w-full items-center justify-between gap-2.5 rounded-lg border px-2.5 py-0 text-right text-sm font-normal transition-colors duration-150 select-none max-md:mx-auto max-md:w-9 max-md:justify-center max-md:px-0 ${
        isListening
          ? "border-[var(--accent4)] bg-[var(--accent4-transparent)] font-medium text-[var(--accent4)]"
          : "border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)]"
      }`}
      aria-label={isListening ? "در حال شنیدن فرمان صوتی" : "فرمان صوتی (نگه دارید)"}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <Mic
          aria-hidden="true"
          strokeWidth={1.5}
          className={`h-4 w-4 shrink-0 ${
            isListening ? "text-[var(--accent4)]" : "text-[var(--sidebar-muted)]"
          } ${isListening && animationsEnabled ? "animate-pulse" : ""}`}
        />
        <span className="truncate text-sm">{isListening ? "در حال شنیدن..." : "فرمان صوتی"}</span>
      </div>
      <kbd className="hidden rounded border border-[var(--sidebar-border)] bg-[var(--sidebar-control-bg)] px-1.5 py-0.5 font-mono text-[11px] font-normal text-[var(--sidebar-muted)] md:inline-block">
        نگه‌دارید
      </kbd>
    </Button>
  );
}
