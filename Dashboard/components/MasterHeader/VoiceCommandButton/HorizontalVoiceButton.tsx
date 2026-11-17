import { m } from "motion/react";
import type { PointerEvent } from "react";
import { Mic } from "@/components/ui/hugeicons";
import type { VoiceCommandButtonProps } from "./types";

interface HorizontalVoiceButtonProps extends VoiceCommandButtonProps {
  isListening: boolean;
  handlePointerDown: (e: PointerEvent) => void;
  handlePointerUp: (e: PointerEvent) => void;
  handlePointerCancel: (e: PointerEvent) => void;
}

export default function HorizontalVoiceButton({
  animationsEnabled,
  isListening,
  handlePointerDown,
  handlePointerUp,
  handlePointerCancel,
}: HorizontalVoiceButtonProps) {
  return (
    <m.button
      type="button"
      whileTap={{ scale: 0.95 }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onContextMenu={(e) => e.preventDefault()}
      style={{ touchAction: "none" }}
      className={`p-2 md:p-2.5 transition-[color,background-color,border-color,transform] duration-150 ease-out border rounded-xl flex justify-center items-center group select-none ${
        isListening
          ? "bg-accent4-transparent border-accent4 text-accent4"
          : "bg-card-bg-solid md:hover:bg-card-hover-bg border-border-color text-text-secondary md:hover:text-accent3 md:hover:border-accent3"
      }`}
      aria-label="فرمان صوتی (نگه دارید)"
    >
      <Mic
        aria-hidden="true"
        className={`size-4 transition-transform duration-150 ease-out ${isListening && animationsEnabled ? "animate-pulse scale-110" : animationsEnabled ? "md:group-hover:scale-110" : ""}`}
      />
    </m.button>
  );
}
