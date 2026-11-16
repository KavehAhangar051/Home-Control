class AudioContextManager {
  private audioCtx: AudioContext | null = null;

  public getContext(): AudioContext | null {
    if (!this.audioCtx && typeof window !== "undefined") {
      // SAFETY: webkitAudioContext is a legacy WebKit property on the window object
      const AudioContextClass =
        window.AudioContext ||
        ("webkitAudioContext" in window
          ? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
          : undefined);

      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }

    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }

    return this.audioCtx;
  }
}

export const audioContextManager = new AudioContextManager();
