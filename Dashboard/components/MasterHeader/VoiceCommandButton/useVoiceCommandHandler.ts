import type { PointerEvent } from "react";
import { useDashboard } from "@/features/dashboard/context/DashboardContext";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { useVoiceCommand } from "@/features/iot/hooks/useVoiceCommand";
import { debugLog } from "@/lib/debug";
import { executeVoiceCommand } from "./utils";

export interface UseVoiceCommandHandlerOptions {
  openSettingsOnStart?: boolean;
}

/**
 * Shared push-to-talk pointer handler for both desktop sidebar and mobile floating buttons.
 * Encapsulates pointer capture, SpeechRecognition completion callback, and command execution (DRY).
 */
export function useVoiceCommandHandler(options: UseVoiceCommandHandlerOptions = {}) {
  const { openSettingsOnStart = true } = options;
  const { isListening, transcript, startListening, stopListening } = useVoiceCommand();
  const { handleSetPinState, handleBatchPinState } = useDashboard();
  const setIsMenuOpen = useIoTStore((s) => s.setIsMenuOpen);
  const setActiveSettingsTab = useIoTStore((s) => s.setActiveSettingsTab);
  const showToast = useIoTStore((s) => s.showToast);

  const handlePointerDown = (e: PointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);

    if (openSettingsOnStart) {
      setIsMenuOpen(true);
      setActiveSettingsTab("voice");
    }

    startListening((finalTranscript) => {
      const { voiceCommands, macros, segments } = useIoTStore.getState();
      executeVoiceCommand(finalTranscript, {
        voiceCommands,
        macros,
        segments,
        handleSetPinState,
        handleBatchPinState,
        showToast,
      });
    });
  };

  const releaseAndStop = (e: PointerEvent) => {
    e.preventDefault();

    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch (error) {
      debugLog.warn("VoiceCommand", "Pointer capture was already released.", error);
    }

    stopListening();
  };

  return {
    isListening,
    transcript,
    handlePointerDown,
    handlePointerUp: releaseAndStop,
    handlePointerCancel: releaseAndStop,
  };
}
