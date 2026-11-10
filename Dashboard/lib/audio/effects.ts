import { audioContextManager } from "./context";

interface ToneConfig {
  type?: OscillatorType;
  freqStart: number;
  freqEnd?: number;
  startTime?: number;
  duration: number;
  peakGain: number;
  attackTime?: number;
}

/**
 * Deep helper to schedule an audio tone with an envelope on an AudioContext.
 * Hides node creation, oscillator configuration, gain ramp calculation, and lifecycle cleanup.
 */
function playTone(ctx: AudioContext, config: ToneConfig) {
  const t = config.startTime ?? ctx.currentTime;
  const attack = config.attackTime ?? 0.01;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = config.type || "sine";
  osc.frequency.setValueAtTime(config.freqStart, t);
  if (config.freqEnd !== undefined && config.freqEnd !== config.freqStart) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, config.freqEnd), t + config.duration);
  }

  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(config.peakGain, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.001, t + config.duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + config.duration);
}

export function playClickSynth() {
  const ctx = audioContextManager.getContext();
  if (!ctx) return;
  playTone(ctx, {
    freqStart: 800,
    freqEnd: 300,
    duration: 0.02,
    peakGain: 0.05,
    attackTime: 0.005,
  });
}

export function playToggleOnSynth() {
  const ctx = audioContextManager.getContext();
  if (!ctx) return;
  playTone(ctx, { freqStart: 400, freqEnd: 800, duration: 0.08, peakGain: 0.06, attackTime: 0.01 });
}

export function playToggleOffSynth() {
  const ctx = audioContextManager.getContext();
  if (!ctx) return;
  playTone(ctx, { freqStart: 800, freqEnd: 400, duration: 0.08, peakGain: 0.06, attackTime: 0.01 });
}

export function playSuccessSynth() {
  const ctx = audioContextManager.getContext();
  if (!ctx) return;
  const t = ctx.currentTime;
  playTone(ctx, { freqStart: 400, startTime: t, duration: 0.15, peakGain: 0.04, attackTime: 0.02 });
  playTone(ctx, {
    freqStart: 600,
    startTime: t + 0.1,
    duration: 0.15,
    peakGain: 0.04,
    attackTime: 0.02,
  });
}

export function playErrorSynth() {
  const ctx = audioContextManager.getContext();
  if (!ctx) return;
  playTone(ctx, {
    type: "sawtooth",
    freqStart: 150,
    freqEnd: 100,
    duration: 0.2,
    peakGain: 0.05,
    attackTime: 0.02,
  });
}
