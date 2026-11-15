import { useCallback, useEffect, useRef } from "react";
import { debugLog } from "@/lib/debug";
import { useIoTStore } from "./useIoTStore";

interface SpeechRecognitionResultEvent {
  results: {
    length: number;
    [index: number]: {
      [alternativeIndex: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSpeechRecognitionErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case "not-allowed":
    case "service-not-allowed":
      return "دسترسی به میکروفون مسدود است. لطفاً مجوز میکروفون را فعال کنید.";
    case "audio-capture":
      return "میکروفونی روی دستگاه یافت نشد.";
    case "no-speech":
      return "صدایی دریافت نشد. لطفاً دوباره امتحان کنید.";
    case "network":
      return "خطا در ارتباط سرویس تشخیص گفتار.";
    default:
      return "خطا در تشخیص فرمان صوتی.";
  }
}

function resolveSpeechRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;

  // SAFETY: SpeechRecognition and webkitSpeechRecognition are optional browser speech API constructors
  return (
    (window as Window & { SpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ||
    (window as Window & { webkitSpeechRecognition?: SpeechRecognitionConstructor })
      .webkitSpeechRecognition
  );
}

function extractTranscriptText(event: SpeechRecognitionResultEvent): string {
  const parts: string[] = [];

  for (let i = 0; i < event.results.length; ++i) {
    const segment = event.results[i][0]?.transcript?.trim();

    if (segment) parts.push(segment);
  }

  return parts.join(" ");
}

function safelyAbortRecognition(recognition: SpeechRecognitionInstance, phase: string): void {
  try {
    recognition.abort?.();
  } catch (error) {
    debugLog.warn("VoiceCommand", `SpeechRecognition abort skipped during ${phase}.`, error);
  }
}

export const useVoiceCommand = () => {
  const isListening = useIoTStore((s) => s.isListening);
  const setIsListening = useIoTStore((s) => s.setIsListening);
  const transcript = useIoTStore((s) => s.voiceTranscript);
  const setTranscript = useIoTStore((s) => s.setVoiceTranscript);
  const showToast = useIoTStore((s) => s.showToast);

  const transcriptRef = useRef("");
  const hasErrorRef = useRef(false);
  const sessionIdRef = useRef(0);
  const activeSessionIdRef = useRef(0);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onCommandCompleteRef = useRef<((text: string) => void) | null>(null);

  useEffect(() => {
    const SpeechRecognition = resolveSpeechRecognitionConstructor();

    if (!SpeechRecognition) {
      if (typeof window !== "undefined") {
        console.warn("Speech recognition is not supported in this browser.");
      }

      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "fa-IR";

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      if (activeSessionIdRef.current !== sessionIdRef.current) return;

      const fullTranscript = extractTranscriptText(event);

      if (fullTranscript) {
        setTranscript(fullTranscript);
        transcriptRef.current = fullTranscript;
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (activeSessionIdRef.current !== sessionIdRef.current) return;

      console.error("Speech recognition error", event.error);
      hasErrorRef.current = true;
      transcriptRef.current = "";
      onCommandCompleteRef.current = null;
      setTranscript("");
      setIsListening(false);

      if (event.error !== "aborted") {
        showToast(getSpeechRecognitionErrorMessage(event.error), "error");
      }
    };

    recognition.onend = () => {
      if (activeSessionIdRef.current !== sessionIdRef.current) return;

      setIsListening(false);

      const finalCallback = onCommandCompleteRef.current;
      const finalTranscript = transcriptRef.current;
      const hadError = hasErrorRef.current;

      onCommandCompleteRef.current = null;
      hasErrorRef.current = false;
      transcriptRef.current = "";
      setTranscript("");

      if (!hadError && finalTranscript && finalCallback) {
        finalCallback(finalTranscript);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      sessionIdRef.current += 1;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      safelyAbortRecognition(recognition, "unmount");
      recognitionRef.current = null;
    };
  }, [setIsListening, setTranscript, showToast]);

  const startListening = useCallback(
    (onComplete?: (text: string) => void) => {
      if (!recognitionRef.current) {
        showToast("مرورگر شما از قابلیت تشخیص صدا پشتیبانی نمی‌کند.", "error");

        return;
      }

      const nextSessionId = sessionIdRef.current + 1;
      sessionIdRef.current = nextSessionId;
      activeSessionIdRef.current = nextSessionId;

      setTranscript("");
      transcriptRef.current = "";
      hasErrorRef.current = false;
      onCommandCompleteRef.current = onComplete ?? null;

      if (useIoTStore.getState().isListening) {
        safelyAbortRecognition(recognitionRef.current, "restart");
      }

      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error(e);
        onCommandCompleteRef.current = null;
        setIsListening(false);
        showToast("شروع ضبط صدا ناموفق بود. لطفاً دوباره تلاش کنید.", "error");
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
