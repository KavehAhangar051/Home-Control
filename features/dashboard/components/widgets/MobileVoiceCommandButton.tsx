import { m } from "motion/react";
import { Mic } from "@/components/ui/hugeicons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { useMobileVoiceCommand } from "../../hooks/useMobileVoiceCommand";

export default function MobileVoiceCommandButton() {
  const animationsEnabled = useIoTStore((s) => s.animationsEnabled);
  const activeGroupId = useIoTStore((s) => s.activeGroupId);
  const activeSegmentId = useIoTStore((s) => s.activeSegmentId);

  const { isListening, handlePointerDown, handlePointerUp, handlePointerCancel } =
    useMobileVoiceCommand();

  const isDragging = !!activeGroupId || !!activeSegmentId;

  if (isDragging) return null;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <m.button
            whileTap={{ scale: 0.96 }}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onContextMenu={(e) => e.preventDefault()}
            style={{ touchAction: "none" }}
            aria-label="فرمان صوتی (نگه دارید)"
            className={`sm:hidden fixed bottom-6 left-6 z-50 p-3.5 rounded-xl flex justify-center items-center select-none transition-[background-color,border-color,color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] focus-ring ${
              isListening
                ? "bg-accent4 border border-accent4 text-white"
                : "bg-card-hover-bg border border-border-color text-text-secondary hover:text-text-primary"
            }`}
          >
            <Mic
              strokeWidth={1.5}
              className={`size-5 ${isListening && animationsEnabled ? "animate-pulse" : ""}`}
            />
          </m.button>
        }
      />
      <TooltipContent>فرمان صوتی (نگه دارید)</TooltipContent>
    </Tooltip>
  );
}
