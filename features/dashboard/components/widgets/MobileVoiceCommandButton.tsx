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
            className={`sm:hidden fixed bottom-6 left-6 z-50 p-4 rounded-full shadow-lg flex justify-center items-center select-none transition-[background-color,border-color,color,box-shadow] duration-150 ease-out ${
              isListening
                ? "bg-[var(--accent4)] shadow-[0_0_20px_var(--accent4-transparent)] text-white"
                : "bg-[var(--card-bg-solid)] border border-[var(--border-color)] text-[var(--text-secondary)] shadow-[0_4px_15px_-5px_var(--border-color)]"
            }`}
          >
            <Mic
              strokeWidth={2}
              className={`w-6 h-6 ${isListening && animationsEnabled ? "animate-pulse" : ""}`}
            />
          </m.button>
        }
      />
      <TooltipContent>فرمان صوتی (نگه دارید)</TooltipContent>
    </Tooltip>
  );
}
