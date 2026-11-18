import type { PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { Mic } from "@/components/ui/hugeicons-groups/shell";
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
          ? "border-accent4 bg-accent4-transparent font-medium text-accent4"
          : "border-transparent bg-transparent text-text-secondary hover:bg-sidebar-hover hover:text-sidebar-text"
      }`}
      aria-label={isListening ? "در حال شنیدن فرمان صوتی" : "فرمان صوتی (نگه دارید)"}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <Mic
          aria-hidden="true"
          strokeWidth={1.5}
          className={`size-4 shrink-0 ${
            isListening ? "text-accent4" : "text-sidebar-muted"
          } ${isListening && animationsEnabled ? "animate-pulse" : ""}`}
        />
        <span className="truncate text-sm">{isListening ? "در حال شنیدن..." : "فرمان صوتی"}</span>
      </div>
      <kbd className="hidden rounded border border-sidebar-border bg-sidebar-control-bg px-1.5 py-0.5 font-mono text-[11px] font-normal text-sidebar-muted md:inline-block">
        نگه‌دارید
      </kbd>
    </Button>
  );
}
