class AudioContextManager {
  private audioCtx: AudioContext | null = null;
  private resumePromise: Promise<void> | null = null;
  private primed = false;

  private ensureContext(): AudioContext | null {
    if (this.audioCtx && this.audioCtx.state === "closed") {
      this.audioCtx = null;
      this.primed = false;
    }

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

    return this.audioCtx;
  }

  private primeHardwareOutput(ctx: AudioContext): void {
    if (this.primed) return;

    try {
      const silentBuffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      const source = ctx.createBufferSource();
      source.buffer = silentBuffer;
      source.connect(ctx.destination);
      source.start(0);
      source.onended = () => {
        source.disconnect();
      };
      this.primed = true;
    } catch {
      // Ignore hardware priming failures before user gesture unlock
    }
  }

  private resumeContext(ctx: AudioContext): Promise<void> {
    if (ctx.state === "running") {
      this.primeHardwareOutput(ctx);

      return Promise.resolve();
    }

    if (!this.resumePromise) {
      this.resumePromise = ctx
        .resume()
        .then(() => {
          if (ctx.state === "running") {
            this.primeHardwareOutput(ctx);
          }
        })
        .catch(() => {
          // Browsers may reject resume outside a user gesture
        })
        .finally(() => {
          this.resumePromise = null;
        });
    }

    return this.resumePromise;
  }

  /**
   * Synchronously unlocks and warms up the Web Audio hardware stream on touch/pointer gestures
   * so subsequent click/toggle tones play immediately without MIUI/Android wake-up clipping.
   */
  public unlock(): void {
    const ctx = this.ensureContext();

    if (!ctx) return;

    if (ctx.state === "running") {
      this.primeHardwareOutput(ctx);

      return;
    }

    void this.resumeContext(ctx);
  }

  /**
   * Marks the hardware output for re-priming after the page returns from background sleep.
   */
  public markNeedsReprime(): void {
    this.primed = false;
  }

  /**
   * Executes a synth scheduling callback only once the AudioContext is actively running,
   * preventing short tones from being scheduled at stale timestamps while suspended.
   */
  public runWithContext(callback: (ctx: AudioContext) => void): void {
    const ctx = this.ensureContext();

    if (!ctx) return;

    if (ctx.state === "running") {
      callback(ctx);

      return;
    }

    void this.resumeContext(ctx).then(() => {
      if (this.audioCtx === ctx && ctx.state === "running") {
        callback(ctx);
      }
    });
  }

  public getContext(): AudioContext | null {
    const ctx = this.ensureContext();

    if (ctx && ctx.state !== "running") {
      void this.resumeContext(ctx);
    }

    return ctx;
  }
}

export const audioContextManager = new AudioContextManager();
