import { useCallback, useEffect, useRef } from "react";
import { useIoTStore } from "./useIoTStore";
import {
  createVoiceRecognitionSession,
  resolveSpeechRecognitionConstructor,
} from "./voiceRecognitionHelpers";

export const useVoiceCommand = () => {
  const isListening = useIoTStore((s) => s.isListening);
  const setIsListening = useIoTStore((s) => s.setIsListening);
  const transcript = useIoTStore((s) => s.voiceTranscript);
  const setTranscript = useIoTStore((s) => s.setVoiceTranscript);
  const showToast = useIoTStore((s) => s.showToast);

  const sessionRef = useRef<ReturnType<typeof createVoiceRecognitionSession> | null>(null);

  useEffect(() => {
    const session = createVoiceRecognitionSession({
      createRecognition: () => {
        const SpeechRecognition = resolveSpeechRecognitionConstructor();

        if (!SpeechRecognition) {
          if (typeof window !== "undefined") {
            console.warn("Speech recognition is not supported in this browser.");
          }

          return null;
        }

        return new SpeechRecognition();
      },
      getIsListening: () => useIoTStore.getState().isListening,
      setIsListening,
      setTranscript,
      showToast,
    });

    session.init();
    sessionRef.current = session;

    return () => {
      session.dispose();
      sessionRef.current = null;
    };
  }, [setIsListening, setTranscript, showToast]);

  const startListening = useCallback(
    (onComplete?: (text: string) => void) => {
      if (!sessionRef.current) {
        showToast("مرورگر شما از قابلیت تشخیص صدا پشتیبانی نمی‌کند.", "error");

        return;
      }

      sessionRef.current.start(onComplete);
    },
    [showToast],
  );

  const stopListening = useCallback(() => {
    sessionRef.current?.stop();
  }, []);

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
  };
};
