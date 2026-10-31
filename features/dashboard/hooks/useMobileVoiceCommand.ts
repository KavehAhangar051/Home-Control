import React from "react";
import { useVoiceCommand } from "@/features/iot/hooks/useVoiceCommand";
import { useDashboard } from "@/features/dashboard/context/DashboardContext";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { executeVoiceCommand } from "@/components/MasterHeader/VoiceCommandButton/utils";

export function useMobileVoiceCommand() {
  const { isListening, startListening, stopListening } = useVoiceCommand();
  const { handleSetPinState, handleBatchPinState } = useDashboard();

  const showToast = useIoTStore((s) => s.showToast);
  const segments = useIoTStore((s) => s.segments);
  const macros = useIoTStore((s) => s.macros);
  const voiceCommands = useIoTStore((s) => s.voiceCommands);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (e.currentTarget && e.currentTarget.setPointerCapture) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    // We don't open the settings menu here for the mobile floating button
    startListening((finalTranscript) => {
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

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    if (e.currentTarget && e.currentTarget.releasePointerCapture) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {}
    }
    stopListening();
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    e.preventDefault();
    if (e.currentTarget && e.currentTarget.releasePointerCapture) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {}
    }
    stopListening();
  };

  return {
    isListening,
    handlePointerDown,
    handlePointerUp,
    handlePointerCancel,
  };
}
