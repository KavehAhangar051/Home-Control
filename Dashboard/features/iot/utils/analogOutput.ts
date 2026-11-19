/**
 * Domain utilities and hardware constraints for ESP32 LEDC PWM (`analog_output`) segments.
 * Mirrors the firmware contract defined in ANALOG_OUTPUT_SPEC.md.
 */

export const ANALOG_OUTPUT_TYPE = "analog_output" as const;
export const ANALOG_OUTPUT_ALIAS = "pwm_output" as const;

export const MIN_PWM_RESOLUTION = 8;
export const MAX_PWM_RESOLUTION = 12;
export const DEFAULT_PWM_RESOLUTION = 8;

export const MIN_PWM_FREQUENCY = 100;
export const MAX_PWM_FREQUENCY = 40000;
export const DEFAULT_PWM_FREQUENCY = 5000;

export const MAX_ANALOG_OUTPUT_VALUE = 4095;

export const PWM_WARNING_PINS: ReadonlySet<number> = new Set([0, 1, 3]);

export const RECOMMENDED_PWM_PINS: readonly number[] = [
  2, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33,
];

export interface AnalogSegmentOptions {
  pwmResolution?: number;
  pwmFrequency?: number;
  initialValue?: number;
}

/** Returns true when a segment type string represents an ESP32 LEDC PWM analog output. */
export function isAnalogOutputType(type?: string | null): boolean {
  return type === ANALOG_OUTPUT_TYPE || type === ANALOG_OUTPUT_ALIAS;
}

/** Returns true when a segment record is an analog PWM output. */
export function isAnalogOutputSegment(segment?: { type?: string } | null): boolean {
  return Boolean(segment && isAnalogOutputType(segment.type));
}

/** Clamps LEDC PWM resolution to the hardware-supported 8..12 bit range (default 8). */
export function clampPwmResolution(resolution?: number | null): number {
  if (resolution === undefined || resolution === null || !Number.isFinite(resolution)) {
    return DEFAULT_PWM_RESOLUTION;
  }

  return Math.min(MAX_PWM_RESOLUTION, Math.max(MIN_PWM_RESOLUTION, Math.round(resolution)));
}

/** Clamps LEDC PWM frequency to the hardware-supported 100..40000 Hz range (default 5000). */
export function clampPwmFrequency(frequency?: number | null): number {
  if (frequency === undefined || frequency === null || !Number.isFinite(frequency)) {
    return DEFAULT_PWM_FREQUENCY;
  }

  return Math.min(MAX_PWM_FREQUENCY, Math.max(MIN_PWM_FREQUENCY, Math.round(frequency)));
}

/** Computes maximum duty cycle `(1 << resolution) - 1` for a given bit resolution. */
export function getAnalogMaxDuty(resolution?: number | null): number {
  const res = clampPwmResolution(resolution);

  return (1 << res) - 1;
}

/** Clamps a raw PWM duty cycle value into `0..maxDuty` for the given resolution. */
export function clampAnalogValue(value: number, resolution?: number | null): number {
  const maxDuty = getAnalogMaxDuty(resolution);

  if (!Number.isFinite(value)) return 0;

  return Math.min(maxDuty, Math.max(0, Math.round(value)));
}

/** Converts a raw PWM duty value to a whole percentage `0..100`. */
export function analogDutyToPercent(value: number, resolution?: number | null): number {
  const maxDuty = getAnalogMaxDuty(resolution);
  const clamped = clampAnalogValue(value, resolution);

  return Math.round((clamped / maxDuty) * 100);
}

/** Converts a percentage `0..100` to the nearest integer PWM duty for the given resolution. */
export function percentToAnalogDuty(percent: number, resolution?: number | null): number {
  if (!Number.isFinite(percent)) return 0;

  const clampedPct = Math.min(100, Math.max(0, percent));
  const maxDuty = getAnalogMaxDuty(resolution);

  return Math.round((clampedPct / 100) * maxDuty);
}

/** Type guard checking whether a RuleAction specifies an explicit PWM duty (`0..4095`) instead of boolean mode (`-1` / null). */
export function hasExplicitAnalogTargetValue(targetValue?: number | null): targetValue is number {
  return typeof targetValue === "number" && Number.isFinite(targetValue) && targetValue >= 0;
}
