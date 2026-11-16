import { useVoiceCommandHandler } from "@/components/MasterHeader/VoiceCommandButton/useVoiceCommandHandler";

export function useMobileVoiceCommand() {
  const { isListening, handlePointerDown, handlePointerUp, handlePointerCancel } =
    useVoiceCommandHandler({ openSettingsOnStart: false });

  return {
    isListening,
    handlePointerDown,
    handlePointerUp,
    handlePointerCancel,
  };
}
