import { debugLog } from "@/lib/debug";
import { audioContextManager } from "./context";
import { SoundManager } from "./SoundManager";

export const soundManager = new SoundManager();

// UI sounds may react to clicks, but ambient music is never auto-started.
// Only AudioSection's explicit playback control can call toggleAmbient/startAmbient.
if (typeof window !== "undefined") {
  const handleGestureUnlock = () => {
    audioContextManager.unlock();
  };

  window.addEventListener("pointerdown", handleGestureUnlock, { capture: true, passive: true });
  window.addEventListener("touchstart", handleGestureUnlock, { capture: true, passive: true });
  window.addEventListener("keydown", handleGestureUnlock, { capture: true, passive: true });

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        audioContextManager.markNeedsReprime();
      }
    });
  }

  window.addEventListener(
    "click",
    (event) => {
      const target = event.target;

      if (!(target instanceof Element)) return;

      const interactive = target.closest("button, [role='button'], a");

      if (!interactive) return;

      const isToggle =
        interactive.classList.contains("switch-toggle") || interactive.closest(".switch-toggle");

      if (!isToggle) soundManager.playClick();
    },
    { capture: true },
  );

  window.addEventListener("unhandledrejection", (event) => {
    debugLog.error("Runtime", "Unhandled promise rejection.", event.reason);
  });

  window.addEventListener("error", (event) => {
    debugLog.error("Runtime", "Uncaught browser error.", {
      message: event.message,
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
      error: event.error,
    });
  });
}
