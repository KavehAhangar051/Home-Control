import type { PointerEvent } from "react";
import { useVoiceCommand } from "@/features/iot/hooks/useVoiceCommand";
import { useDashboard } from "@/features/dashboard/context/DashboardContext";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { executeVoiceCommand } from "./utils";

export function useVoiceCommandHandler() {
  const { isListening, transcript, startListening, stopListening } = useVoiceCommand();
  const { handleSetPinState, handleBatchPinState } = useDashboard();
  const setIsMenuOpen = useIoTStore((s) => s.setIsMenuOpen);
  const setActiveSettingsTab = useIoTStore((s) => s.setActiveSettingsTab);
  const showToast = useIoTStore((s) => s.showToast);
  const segments = useIoTStore((s) => s.segments);
  const macros = useIoTStore((s) => s.macros);
  const voiceCommands = useIoTStore((s) => s.voiceCommands);

  const handlePointerDown = (e: PointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setIsMenuOpen(true);
    setActiveSettingsTab("voice-commands");
    startListening();
  };

  const handlePointerUp = (e: PointerEvent) => {
    e.preventDefault();
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {}
    stopListening();
    executeVoiceCommand(transcript, {
      voiceCommands,
      macros,
      segments,
      handleSetPinState,
      handleBatchPinState,
      showToast,
    });
  };

  const handlePointerCancel = (e: PointerEvent) => {
    e.preventDefault();
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {}
    stopListening();
  };

  return {
    isListening,
    transcript,
    handlePointerDown,
    handlePointerUp,
    handlePointerCancel,
  };
}
