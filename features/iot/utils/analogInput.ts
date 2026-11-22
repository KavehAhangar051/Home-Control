/**
 * Domain utilities, presets, and hardware constraints for ESP32 ADC1 (`analog_input`) segments.
 * Mirrors the firmware contract defined in ANALOG_INPUT_SPEC.md.
 */

export const ANALOG_INPUT_TYPE = "analog_input" as const;

/** Hardware-enforced ADC1 GPIO pins (ADC2 pins conflict with WiFi and are rejected by firmware). */
export const ADC1_ALLOWED_PINS: readonly number[] = [32, 33, 34, 35, 36, 39];

export const ADC1_ALLOWED_PIN_SET: ReadonlySet<number> = new Set(ADC1_ALLOWED_PINS);

/** Input-only ADC1 pins without internal pull-up/down resistors (ideal for analog sensors). */
export const ADC_INPUT_ONLY_PINS: ReadonlySet<number> = new Set([34, 35, 36, 39]);

export const MIN_ADC_RESOLUTION = 8;
export const MAX_ADC_RESOLUTION = 12;
export const DEFAULT_ADC_RESOLUTION = 12;

export const MIN_ADC_SAMPLE_INTERVAL_MS = 50;
export const MAX_ADC_SAMPLE_INTERVAL_MS = 60000;
export const DEFAULT_ADC_SAMPLE_INTERVAL_MS = 500;

export const MIN_ADC_DELTA_THRESHOLD = 1;
export const DEFAULT_ADC_DELTA_THRESHOLD = 40;

export const DEFAULT_ADC_HIGH_THRESHOLD = 0;
export const DEFAULT_ADC_LOW_THRESHOLD = 0;

export const ADC_REFERENCE_VOLTAGE = 3.3;

export const RULE_TRIGGER_DOUBLE_CLICK = -1 as const;
export const RULE_ANALOG_VALUE_UNSET = -1 as const;
export const DEFAULT_DOUBLE_CLICK_WINDOW_MS = 400;
export const MAX_ANALOG_RANGE_RULES = 6;
export const ANALOG_RANGE_TRIGGER_ENTER = 0 as const;
export const ANALOG_RANGE_TRIGGER_EXIT = 1 as const;
export const DEFAULT_ANALOG_HYSTERESIS_12BIT = 30;
export const DEFAULT_ANALOG_HYSTERESIS_8BIT = 5;
export const DIGITAL_HOLD_TIME_VALUES = [0, -1, 3, 5, 10] as const;

export interface AnalogInputSegmentOptions {
  adcResolution?: number;
  adcSampleIntervalMs?: number;
  adcDeltaThreshold?: number;
  adcHighThreshold?: number;
  adcLowThreshold?: number;
}

export interface NormalizedAnalogInputConfig {
  adcResolution: number;
  adcSampleIntervalMs: number;
  adcDeltaThreshold: number;
  adcHighThreshold: number;
  adcLowThreshold: number;
}

export interface AnalogInputPreset {
  id: "potentiometer" | "ldr" | "soil_ntc";
  label: string;
  description: string;
  config: NormalizedAnalogInputConfig;
}

export const ANALOG_INPUT_PRESETS: readonly AnalogInputPreset[] = [
  {
    id: "potentiometer",
    label: "پتانسیومتر / دیمر دستی",
    description: "پاسخ سریع بدون آستانه",
    config: {
      adcResolution: 12,
      adcSampleIntervalMs: 150,
      adcDeltaThreshold: 20,
      adcHighThreshold: 0,
      adcLowThreshold: 0,
    },
  },
  {
    id: "ldr",
    label: "سنسور نور (LDR)",
    description: "روشنایی خودکار با هیسترزیس",
    config: {
      adcResolution: 12,
      adcSampleIntervalMs: 1000,
      adcDeltaThreshold: 60,
      adcHighThreshold: 2800,
      adcLowThreshold: 2200,
    },
  },
  {
    id: "soil_ntc",
    label: "رطوبت خاک / دما (NTC)",
    description: "نمونه‌برداری آرام با هیسترزیس",
    config: {
      adcResolution: 12,
      adcSampleIntervalMs: 2000,
      adcDeltaThreshold: 50,
      adcHighThreshold: 2500,
      adcLowThreshold: 2000,
    },
  },
] as const;

/** Returns true when a segment type string represents an ESP32 ADC1 analog input. */
export function isAnalogInputType(type?: string | null): boolean {
  return type === ANALOG_INPUT_TYPE;
}

/** Returns true when a segment record is an ADC1 analog input. */
export function isAnalogInputSegment(segment?: { type?: string } | null): boolean {
  return Boolean(segment && isAnalogInputType(segment.type));
}

/** Returns true when a segment record is a digital input (`type === "input"`). */
export function isDigitalInputSegment(segment?: { type?: string } | null): boolean {
  return Boolean(segment && segment.type === "input");
}

/** Returns true when a segment type is read-only (digital `input` or analog `analog_input`). */
export function isReadOnlyInputType(type?: string | null): boolean {
  return type === "input" || isAnalogInputType(type);
}

/** Returns true when a segment record is read-only and must not receive write commands. */
export function isReadOnlyInputSegment(segment?: { type?: string } | null): boolean {
  return Boolean(segment && isReadOnlyInputType(segment.type));
}

/** Checks whether a GPIO pin is one of the 6 firmware-allowed ESP32 ADC1 channels. */
export function isValidAdc1Pin(pin: number | string): boolean {
  const num = typeof pin === "number" ? pin : Number.parseInt(pin.trim(), 10);

  return Number.isInteger(num) && ADC1_ALLOWED_PIN_SET.has(num);
}

/** Clamps ADC resolution to the hardware-supported 8..12 bit range (default 12). */
export function clampAdcResolution(resolution?: number | null): number {
  if (resolution === undefined || resolution === null || !Number.isFinite(resolution)) {
    return DEFAULT_ADC_RESOLUTION;
  }

  return Math.min(MAX_ADC_RESOLUTION, Math.max(MIN_ADC_RESOLUTION, Math.round(resolution)));
}

/** Computes maximum ADC readout `(1 << resolution) - 1` for a given bit resolution. */
export function getAdcMaxValue(resolution?: number | null): number {
  const res = clampAdcResolution(resolution);

  return (1 << res) - 1;
}

/** Clamps a raw ADC reading into `0..maxValue` for the given resolution. */
export function clampAdcValue(value: number, resolution?: number | null): number {
  const maxVal = getAdcMaxValue(resolution);

  if (!Number.isFinite(value)) return 0;

  return Math.min(maxVal, Math.max(0, Math.round(value)));
}

/** Clamps ADC sampling interval to `50..60000` ms (default `500`). */
export function clampAdcSampleInterval(intervalMs?: number | null): number {
  if (intervalMs === undefined || intervalMs === null || !Number.isFinite(intervalMs)) {
    return DEFAULT_ADC_SAMPLE_INTERVAL_MS;
  }

  return Math.min(
    MAX_ADC_SAMPLE_INTERVAL_MS,
    Math.max(MIN_ADC_SAMPLE_INTERVAL_MS, Math.round(intervalMs)),
  );
}

/** Clamps ADC delta threshold into `1..maxValue` (default `40`). */
export function clampAdcDeltaThreshold(delta?: number | null, resolution?: number | null): number {
  const maxVal = getAdcMaxValue(resolution);

  if (delta === undefined || delta === null || !Number.isFinite(delta)) {
    return Math.min(maxVal, DEFAULT_ADC_DELTA_THRESHOLD);
  }

  return Math.min(maxVal, Math.max(MIN_ADC_DELTA_THRESHOLD, Math.round(delta)));
}

/**
 * Enforces the Schmitt-Trigger threshold invariant:
 * `0 <= adcLowThreshold <= adcHighThreshold <= maxValue`, and when `adcHighThreshold === 0`,
 * `adcLowThreshold` is forced to `0` (comparator & rule engine disabled).
 */
export function normalizeAdcThresholds(
  highThreshold?: number | null,
  lowThreshold?: number | null,
  resolution?: number | null,
): { adcHighThreshold: number; adcLowThreshold: number } {
  const maxVal = getAdcMaxValue(resolution);
  const rawHigh =
    highThreshold === undefined || highThreshold === null || !Number.isFinite(highThreshold)
      ? DEFAULT_ADC_HIGH_THRESHOLD
      : Math.round(highThreshold);
  const adcHighThreshold = Math.min(maxVal, Math.max(0, rawHigh));

  if (adcHighThreshold === 0) {
    return { adcHighThreshold: 0, adcLowThreshold: 0 };
  }

  const rawLow =
    lowThreshold === undefined || lowThreshold === null || !Number.isFinite(lowThreshold)
      ? DEFAULT_ADC_LOW_THRESHOLD
      : Math.round(lowThreshold);
  const adcLowThreshold = Math.min(adcHighThreshold, Math.max(0, rawLow));

  return { adcHighThreshold, adcLowThreshold };
}

/** Normalizes all ADC1 configuration fields into valid firmware ranges. */
export function normalizeAnalogInputConfig(
  options?: AnalogInputSegmentOptions | null,
): NormalizedAnalogInputConfig {
  const adcResolution = clampAdcResolution(options?.adcResolution);
  const adcSampleIntervalMs = clampAdcSampleInterval(options?.adcSampleIntervalMs);
  const adcDeltaThreshold = clampAdcDeltaThreshold(options?.adcDeltaThreshold, adcResolution);
  const { adcHighThreshold, adcLowThreshold } = normalizeAdcThresholds(
    options?.adcHighThreshold,
    options?.adcLowThreshold,
    adcResolution,
  );

  return {
    adcResolution,
    adcSampleIntervalMs,
    adcDeltaThreshold,
    adcHighThreshold,
    adcLowThreshold,
  };
}

/** Converts a raw ADC value to a whole percentage `0..100`. */
export function adcValueToPercent(value: number, resolution?: number | null): number {
  const maxVal = getAdcMaxValue(resolution);
  const clamped = clampAdcValue(value, resolution);

  return Math.round((clamped / maxVal) * 100);
}

/** Converts a raw ADC value to an approximate voltage string `0.00..3.30` (3.3V reference). */
export function adcValueToVoltage(value: number, resolution?: number | null): string {
  const maxVal = getAdcMaxValue(resolution);
  const clamped = clampAdcValue(value, resolution);

  return ((clamped / maxVal) * ADC_REFERENCE_VOLTAGE).toFixed(2);
}

/** Computes maximum valid hysteresis `floor(maxAdcValue / 2)` for a given resolution. */
export function getMaxAnalogHysteresis(resolution?: number | null): number {
  return Math.floor(getAdcMaxValue(resolution) / 2);
}

/** Returns resolution-aware suggested default hysteresis (`5` for 8-bit, `30` for 12-bit). */
export function getSuggestedAnalogHysteresis(resolution?: number | null): number {
  const res = clampAdcResolution(resolution);

  if (res <= 8) return DEFAULT_ANALOG_HYSTERESIS_8BIT;
  if (res <= 10) return 15;

  return DEFAULT_ANALOG_HYSTERESIS_12BIT;
}
