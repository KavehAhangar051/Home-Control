import { useCallback, useEffect, useRef } from "react";
import { useIoTStore } from "./useIoTStore";

export const useVoiceCommand = () => {
  const isListening = useIoTStore((s) => s.isListening);
  const setIsListening = useIoTStore((s) => s.setIsListening);
  const transcript = useIoTStore((s) => s.voiceTranscript);
  const setTranscript = useIoTStore((s) => s.setVoiceTranscript);
  const showToast = useIoTStore((s) => s.showToast);

  const transcriptRef = useRef("");
  const recognitionRef = useRef<any>(null);
  const onCommandCompleteRef = useRef<((text: string) => void) | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // SAFETY: SpeechRecognition and webkitSpeechRecognition are optional browser speech API constructors
    const SpeechRecognition =
      (window as Window & { SpeechRecognition?: any }).SpeechRecognition ||
      (window as Window & { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Speech recognition is not supported in this browser.");

      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "fa-IR"; // Support Persian

    recognition.onresult = (event: any) => {
      let fullTranscript = "";

      for (let i = 0; i < event.results.length; ++i) {
        fullTranscript += event.results[i][0].transcript;
      }

      if (fullTranscript) {
        setTranscript(fullTranscript);
        transcriptRef.current = fullTranscript;
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);

      if (transcriptRef.current && onCommandCompleteRef.current) {
        onCommandCompleteRef.current(transcriptRef.current);
      }

      transcriptRef.current = "";
      setTranscript("");
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;

      try {
        recognition.abort?.();
      } catch {}

      recognitionRef.current = null;
    };
  }, [setIsListening, setTranscript]);

  const startListening = useCallback(
    (onComplete?: (text: string) => void) => {
      setTranscript("");
      transcriptRef.current = "";
      onCommandCompleteRef.current = onComplete ?? null;

      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsListening(true);
        } catch (e) {
          console.error(e);
        }
      } else {
        showToast("مرورگر شما از قابلیت تشخیص صدا پشتیبانی نمی‌کند.", "error");
      }
    },
    [setIsListening, setTranscript, showToast],
  );

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error(e);
      }
    }
    // We don't set isListening to false here, we wait for the onend event
    // to guarantee we receive the final result before showing the notification
  }, []);

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
  };
};
