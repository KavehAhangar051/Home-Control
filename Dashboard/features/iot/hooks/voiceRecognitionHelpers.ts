import { debugLog } from "@/lib/debug";

export interface SpeechRecognitionResultEvent {
  results: {
    length: number;
    [index: number]: {
      [alternativeIndex: number]: {
        transcript: string;
      };
    };
  };
}

export interface SpeechRecognitionErrorEvent {
  error: string;
}

export interface SpeechRecognitionInstance {
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

export type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

export function getSpeechRecognitionErrorMessage(errorCode: string): string {
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

export function resolveSpeechRecognitionConstructor(
  win?: Partial<
    Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    }
  >,
): SpeechRecognitionConstructor | undefined {
  const target = win ?? (typeof window !== "undefined" ? window : undefined);

  if (!target) return undefined;

  // SAFETY: SpeechRecognition and webkitSpeechRecognition are optional browser speech API constructors
  return (
    (target as { SpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ||
    (target as { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition
  );
}

export function extractTranscriptText(event: SpeechRecognitionResultEvent): string {
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

export interface VoiceRecognitionSessionDeps {
  createRecognition: () => SpeechRecognitionInstance | null;
  getIsListening: () => boolean;
  setIsListening: (listening: boolean) => void;
  setTranscript: (text: string) => void;
  showToast: (msg: string, type: "success" | "error") => void;
}

/**
 * Headless voice recognition session controller with generation-based stale-callback guarding.
 */
export function createVoiceRecognitionSession(deps: VoiceRecognitionSessionDeps) {
  let transcriptBuffer = "";
  let hasError = false;
  let sessionId = 0;
  let activeSessionId = 0;
  let onCommandComplete: ((text: string) => void) | null = null;
  let recognition: SpeechRecognitionInstance | null = null;

  const init = () => {
    const instance = deps.createRecognition();

    if (!instance) {
      return false;
    }

    instance.continuous = true;
    instance.interimResults = true;
    instance.lang = "fa-IR";

    instance.onresult = (event) => {
      if (activeSessionId !== sessionId) return;

      const fullTranscript = extractTranscriptText(event);

      if (fullTranscript) {
        deps.setTranscript(fullTranscript);
        transcriptBuffer = fullTranscript;
      }
    };

    instance.onerror = (event) => {
      if (activeSessionId !== sessionId) return;

      console.error("Speech recognition error", event.error);
      hasError = true;
      transcriptBuffer = "";
      onCommandComplete = null;
      deps.setTranscript("");
      deps.setIsListening(false);

      if (event.error !== "aborted") {
        deps.showToast(getSpeechRecognitionErrorMessage(event.error), "error");
      }
    };

    instance.onend = () => {
      if (activeSessionId !== sessionId) return;

      deps.setIsListening(false);

      const finalCallback = onCommandComplete;
      const finalTranscript = transcriptBuffer;
      const hadError = hasError;

      onCommandComplete = null;
      hasError = false;
      transcriptBuffer = "";
      deps.setTranscript("");

      if (!hadError && finalTranscript && finalCallback) {
        finalCallback(finalTranscript);
      }
    };

    recognition = instance;

    return true;
  };

  const start = (onComplete?: (text: string) => void) => {
    if (!recognition) {
      deps.showToast("مرورگر شما از قابلیت تشخیص صدا پشتیبانی نمی‌کند.", "error");

      return false;
    }

    const nextSessionId = sessionId + 1;
    sessionId = nextSessionId;

    if (deps.getIsListening()) {
      safelyAbortRecognition(recognition, "restart");
    }

    activeSessionId = nextSessionId;
    deps.setTranscript("");
    transcriptBuffer = "";
    hasError = false;
    onCommandComplete = onComplete ?? null;

    try {
      recognition.start();
      deps.setIsListening(true);

      return true;
    } catch (e) {
      console.error(e);
      onCommandComplete = null;
      deps.setIsListening(false);
      deps.showToast("شروع ضبط صدا ناموفق بود. لطفاً دوباره تلاش کنید.", "error");

      return false;
    }
  };

  const stop = () => {
    if (!recognition) return;

    try {
      recognition.stop();
    } catch (e) {
      console.error(e);
    }
  };

  const dispose = () => {
    sessionId += 1;

    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      safelyAbortRecognition(recognition, "unmount");
      recognition = null;
    }
  };

  return { init, start, stop, dispose };
}
