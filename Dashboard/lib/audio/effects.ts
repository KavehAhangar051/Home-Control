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

const MOBILE_GAIN_MULTIPLIER = 2.6;
const MOBILE_MAX_GAIN = 0.24;
const MOBILE_MIN_CLICK_DURATION = 0.036;
const MOBILE_LEAD_IN_SECONDS = 0.006;

function isMobileAudioDevice(): boolean {
  if (typeof window === "undefined") return false;

  const coarsePointer =
    typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;

  return coarsePointer || window.innerWidth < 768;
}

/**
 * Deep helper to schedule an audio tone with an envelope on a running AudioContext.
 * Calibrates gain and transient lead-in on mobile devices so phone speakers (e.g. MIUI/Redmi)
 * do not gate short low-amplitude UI tones, while leaving desktop gain unchanged.
 */
function playTone(ctx: AudioContext, config: ToneConfig) {
  const isMobile = isMobileAudioDevice();
  const leadIn = config.startTime === undefined && isMobile ? MOBILE_LEAD_IN_SECONDS : 0;
  const t = (config.startTime ?? ctx.currentTime) + leadIn;
  const duration = isMobile && config.duration < 0.03 ? MOBILE_MIN_CLICK_DURATION : config.duration;
  const attack = Math.min(config.attackTime ?? 0.01, duration * 0.4);
  const peakGain = isMobile
    ? Math.min(MOBILE_MAX_GAIN, config.peakGain * MOBILE_GAIN_MULTIPLIER)
    : config.peakGain;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = config.type || "sine";
  osc.frequency.setValueAtTime(config.freqStart, t);

  if (config.freqEnd !== undefined && config.freqEnd !== config.freqStart) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, config.freqEnd), t + duration);
  }

  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(peakGain, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
  osc.start(t);
  osc.stop(t + duration + 0.005);
}

export function playClickSynth() {
  audioContextManager.runWithContext((ctx) => {
    playTone(ctx, {
      freqStart: 800,
      freqEnd: 300,
      duration: 0.02,
      peakGain: 0.05,
      attackTime: 0.005,
    });
  });
}

export function playToggleOnSynth() {
  audioContextManager.runWithContext((ctx) => {
    playTone(ctx, {
      freqStart: 400,
      freqEnd: 800,
      duration: 0.08,
      peakGain: 0.06,
      attackTime: 0.01,
    });
  });
}

export function playToggleOffSynth() {
  audioContextManager.runWithContext((ctx) => {
    playTone(ctx, {
      freqStart: 800,
      freqEnd: 400,
      duration: 0.08,
      peakGain: 0.06,
      attackTime: 0.01,
    });
  });
}

export function playSuccessSynth() {
  audioContextManager.runWithContext((ctx) => {
    const isMobile = isMobileAudioDevice();
    const t = ctx.currentTime + (isMobile ? MOBILE_LEAD_IN_SECONDS : 0);
    playTone(ctx, {
      freqStart: 400,
      startTime: t,
      duration: 0.15,
      peakGain: 0.04,
      attackTime: 0.02,
    });
    playTone(ctx, {
      freqStart: 600,
      startTime: t + 0.1,
      duration: 0.15,
      peakGain: 0.04,
      attackTime: 0.02,
    });
  });
}

export function playErrorSynth() {
  audioContextManager.runWithContext((ctx) => {
    playTone(ctx, {
      type: "sawtooth",
      freqStart: 150,
      freqEnd: 100,
      duration: 0.2,
      peakGain: 0.05,
      attackTime: 0.02,
    });
  });
}
