/**
 * @file lib/gpuLut.ts
 * @description Precomputed typed-array Lookup Tables (LUTs) that replace repetitive CPU math
 * (gamma pow, hex formatting, palette ramps, hue-to-RGB, Gaussian slider wave crests,
 * frame-rate-independent exponential decay, cubic easing, and cubic Bezier Bernstein basis)
 * with O(1) table lookups across 60Hz–360Hz displays.
 */

export interface ThemeSurfacePalette {
  readonly deepest: string;
  readonly bg: string;
  readonly card: string;
  readonly cardSolid: string;
  readonly cardHover: string;
  readonly border: string;
}

export interface CubicBezierCurve {
  startX: number;
  startY: number;
  control1X: number;
  control1Y: number;
  control2X: number;
  control2Y: number;
  endX: number;
  endY: number;
}

export interface Point2D {
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// 1. Hex Byte LUT (0..255 -> "00".."ff")
// ---------------------------------------------------------------------------

export const HEX_BYTE_LUT: readonly string[] = Array.from({ length: 256 }, (_, i) =>
  i < 16 ? `0${i.toString(16)}` : i.toString(16),
);

/** O(1) clamped byte-to-2-digit-hex lookup without per-call string padding or radix math. */
export function byteToHex(value: number): string {
  const idx = value <= 0 ? 0 : value >= 255 ? 255 : Math.round(value);

  return HEX_BYTE_LUT[idx];
}

// ---------------------------------------------------------------------------
// 2. WCAG 2.1 sRGB -> Linear Luminance LUT (eliminates Math.pow(..., 2.4))
// ---------------------------------------------------------------------------

export const SRGB_TO_LINEAR_LUT: Float32Array = (() => {
  const table = new Float32Array(256);

  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    table[i] = c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }

  return table;
})();

/** Computes WCAG 2.1 relative luminance from 8-bit RGB channels using the sRGB gamma LUT. */
export function lookupRelativeLuminance(r: number, g: number, b: number): number {
  const ri = r <= 0 ? 0 : r >= 255 ? 255 : r | 0;
  const gi = g <= 0 ? 0 : g >= 255 ? 255 : g | 0;
  const bi = b <= 0 ? 0 : b >= 255 ? 255 : b | 0;

  return (
    0.2126 * SRGB_TO_LINEAR_LUT[ri] +
    0.7152 * SRGB_TO_LINEAR_LUT[gi] +
    0.0722 * SRGB_TO_LINEAR_LUT[bi]
  );
}

// ---------------------------------------------------------------------------
// 3. Dark & Light Surface Palette LUTs (0..100 darkness / whiteness steps)
// ---------------------------------------------------------------------------

function buildDarkPaletteEntry(blackness: number): ThemeSurfacePalette {
  const t = (100 - blackness) / 100;
  const bgVal = Math.round(8 + t * 40);
  const deepestVal = Math.max(6, bgVal - 5);
  const cardVal = bgVal + 5;
  const hoverVal = bgVal + 15;
  const borderVal = bgVal + 19;

  const deepest = `#${HEX_BYTE_LUT[deepestVal]}${HEX_BYTE_LUT[deepestVal]}${HEX_BYTE_LUT[deepestVal + 1]}`;
  const bg = `#${HEX_BYTE_LUT[bgVal]}${HEX_BYTE_LUT[bgVal]}${HEX_BYTE_LUT[bgVal + 1]}`;
  const cardSolid = `#${HEX_BYTE_LUT[cardVal]}${HEX_BYTE_LUT[cardVal]}${HEX_BYTE_LUT[cardVal + 2]}`;
  const cardHover = `#${HEX_BYTE_LUT[hoverVal]}${HEX_BYTE_LUT[hoverVal]}${HEX_BYTE_LUT[hoverVal + 2]}`;
  const border = `#${HEX_BYTE_LUT[borderVal]}${HEX_BYTE_LUT[borderVal]}${HEX_BYTE_LUT[borderVal + 3]}`;

  return { deepest, bg, card: cardSolid, cardSolid, cardHover, border };
}

function buildLightPaletteEntry(whiteness: number): ThemeSurfacePalette {
  const t = whiteness / 100;
  const r = Math.round(234 + t * 21);
  const g = Math.round(234 + t * 21);
  const b = Math.round(236 + t * 19);

  const deepestR = Math.max(226, r - 6);
  const deepestG = Math.max(226, g - 6);
  const deepestB = Math.max(228, b - 4);

  const cardVal = Math.min(255, Math.round(250 + t * 5));
  const hoverR = Math.max(224, r - 6);
  const hoverG = Math.max(224, g - 6);
  const hoverB = Math.max(226, b - 5);

  const borderR = Math.max(206, r - 22);
  const borderG = Math.max(206, g - 22);
  const borderB = Math.max(210, b - 21);

  const cardByte = HEX_BYTE_LUT[cardVal];
  const deepest = `#${HEX_BYTE_LUT[deepestR]}${HEX_BYTE_LUT[deepestG]}${HEX_BYTE_LUT[deepestB]}`;
  const bg = `#${HEX_BYTE_LUT[r]}${HEX_BYTE_LUT[g]}${HEX_BYTE_LUT[b]}`;
  const card = `#${cardByte}${cardByte}${cardByte}`;
  const cardHover = `#${HEX_BYTE_LUT[hoverR]}${HEX_BYTE_LUT[hoverG]}${HEX_BYTE_LUT[hoverB]}`;
  const border = `#${HEX_BYTE_LUT[borderR]}${HEX_BYTE_LUT[borderG]}${HEX_BYTE_LUT[borderB]}`;

  return { deepest, bg, card, cardSolid: card, cardHover, border };
}

export const DARK_PALETTE_LUT: readonly ThemeSurfacePalette[] = Array.from(
  { length: 101 },
  (_, i) => buildDarkPaletteEntry(i),
);

export const LIGHT_PALETTE_LUT: readonly ThemeSurfacePalette[] = Array.from(
  { length: 101 },
  (_, i) => buildLightPaletteEntry(i),
);

/** O(1) dark surface palette lookup for blackness in 0..100. */
export function lookupDarkPalette(blackness = 70): ThemeSurfacePalette {
  const idx = blackness <= 0 ? 0 : blackness >= 100 ? 100 : Math.round(blackness);

  return DARK_PALETTE_LUT[idx];
}

/** O(1) light surface palette lookup for whiteness in 0..100. */
export function lookupLightPalette(whiteness = 70): ThemeSurfacePalette {
  const idx = whiteness <= 0 ? 0 : whiteness >= 100 ? 100 : Math.round(whiteness);

  return LIGHT_PALETTE_LUT[idx];
}

// ---------------------------------------------------------------------------
// 4. Hue -> Pure RGB Sector LUT (361 degrees x 3 normalized channels)
// ---------------------------------------------------------------------------

export const HUE_RGB_LUT: Float32Array = (() => {
  const table = new Float32Array(361 * 3);

  for (let deg = 0; deg <= 360; deg++) {
    const sector = (deg % 360) / 60;
    const f = (n: number) => {
      const k = (n + sector) % 6;

      return 1 - Math.max(0, Math.min(k, 4 - k, 1));
    };

    const offset = deg * 3;
    table[offset] = f(5);
    table[offset + 1] = f(3);
    table[offset + 2] = f(1);
  }

  return table;
})();

/** Fast LUT-backed HSV -> 8-bit RGB conversion avoiding per-frame modulo/branching. */
export function lookupHsvToRgb(
  h: number,
  s: number,
  v: number,
): { r: number; g: number; b: number } {
  const wrapped = ((h % 360) + 360) % 360;
  const lo = wrapped | 0;
  const hi = lo < 360 ? lo + 1 : 0;
  const frac = wrapped - lo;

  const loIdx = lo * 3;
  const hiIdx = hi * 3;

  const hr = HUE_RGB_LUT[loIdx] + (HUE_RGB_LUT[hiIdx] - HUE_RGB_LUT[loIdx]) * frac;
  const hg = HUE_RGB_LUT[loIdx + 1] + (HUE_RGB_LUT[hiIdx + 1] - HUE_RGB_LUT[loIdx + 1]) * frac;
  const hb = HUE_RGB_LUT[loIdx + 2] + (HUE_RGB_LUT[hiIdx + 2] - HUE_RGB_LUT[loIdx + 2]) * frac;

  const sat = s / 100;
  const val255 = (v / 100) * 255;

  return {
    r: Math.round(val255 * (1 - sat + sat * hr)),
    g: Math.round(val255 * (1 - sat + sat * hg)),
    b: Math.round(val255 * (1 - sat + sat * hb)),
  };
}

// ---------------------------------------------------------------------------
// 5. WaveSlider Gaussian Bell Crest LUT (spread = 2.6 bars)
// ---------------------------------------------------------------------------

const WAVE_SPREAD = 2.6;
const WAVE_MAX_DISTANCE = 12;
const WAVE_LUT_STEPS = 240; // 0.05-bar resolution
const WAVE_INV_STEP = WAVE_LUT_STEPS / WAVE_MAX_DISTANCE;

export const WAVE_CREST_LUT: Float32Array = (() => {
  const table = new Float32Array(WAVE_LUT_STEPS + 1);
  const denom = 2 * WAVE_SPREAD * WAVE_SPREAD;

  for (let i = 0; i <= WAVE_LUT_STEPS; i++) {
    const d = i / WAVE_INV_STEP;
    table[i] = Math.exp(-(d * d) / denom);
  }

  return table;
})();

/** O(1) Gaussian bell lookup with linear interpolation for WaveSlider bars. */
export function lookupWaveCrest(distance: number): number {
  const d = distance < 0 ? -distance : distance;
  if (d >= WAVE_MAX_DISTANCE) return 0;

  const scaled = d * WAVE_INV_STEP;
  const idx = scaled | 0;
  if (idx >= WAVE_LUT_STEPS) return WAVE_CREST_LUT[WAVE_LUT_STEPS];

  const frac = scaled - idx;

  return WAVE_CREST_LUT[idx] + (WAVE_CREST_LUT[idx + 1] - WAVE_CREST_LUT[idx]) * frac;
}

// ---------------------------------------------------------------------------
// 6. Easing & Frame-Delta Physics LUTs (60Hz / 90Hz / 120Hz / 144Hz / 240Hz+)
// ---------------------------------------------------------------------------

const EASE_LUT_STEPS = 256;

export const EASE_OUT_CUBIC_LUT: Float32Array = (() => {
  const table = new Float32Array(EASE_LUT_STEPS + 1);

  for (let i = 0; i <= EASE_LUT_STEPS; i++) {
    const inv = 1 - i / EASE_LUT_STEPS;
    table[i] = 1 - inv * inv * inv;
  }

  return table;
})();

/** O(1) easeOutCubic lookup with linear interpolation for sub-frame 120Hz–360Hz precision. */
export function lookupEaseOutCubic(progress: number): number {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;

  const scaled = progress * EASE_LUT_STEPS;
  const idx = scaled | 0;
  const frac = scaled - idx;

  return EASE_OUT_CUBIC_LUT[idx] + (EASE_OUT_CUBIC_LUT[idx + 1] - EASE_OUT_CUBIC_LUT[idx]) * frac;
}

const DT_MAX_MS = 64;
const DT_LUT_STEPS = 256; // 0.25ms resolution (accurate up to 4000Hz)
const DT_INV_STEP = DT_LUT_STEPS / DT_MAX_MS;
const INERTIA_FRICTION_PER_60HZ_FRAME = 0.915;
const CURSOR_LERP_PER_60HZ_FRAME = 0.26;

export const ZOOM_ALPHA_LUT: Float32Array = (() => {
  const table = new Float32Array(DT_LUT_STEPS + 1);

  for (let i = 0; i <= DT_LUT_STEPS; i++) {
    const dt = i / DT_INV_STEP;
    table[i] = 1 - 0.001 ** (dt / 170);
  }

  return table;
})();

export const INERTIA_DECAY_LUT: Float32Array = (() => {
  const table = new Float32Array(DT_LUT_STEPS + 1);

  for (let i = 0; i <= DT_LUT_STEPS; i++) {
    const dt = i / DT_INV_STEP;
    table[i] = INERTIA_FRICTION_PER_60HZ_FRAME ** (dt / 16.6667);
  }

  return table;
})();

export const CURSOR_LERP_LUT: Float32Array = (() => {
  const table = new Float32Array(DT_LUT_STEPS + 1);

  for (let i = 0; i <= DT_LUT_STEPS; i++) {
    const dt = i / DT_INV_STEP;
    table[i] = 1 - (1 - CURSOR_LERP_PER_60HZ_FRAME) ** (dt / 16.6667);
  }

  return table;
})();

function sampleDtTable(table: Float32Array, dtMs: number): number {
  if (dtMs <= 0) return table[0];
  if (dtMs >= DT_MAX_MS) return table[DT_LUT_STEPS];

  const scaled = dtMs * DT_INV_STEP;
  const idx = scaled | 0;
  const frac = scaled - idx;

  return table[idx] + (table[idx + 1] - table[idx]) * frac;
}

/** Frame-rate-independent focal zoom interpolation alpha via O(1) LUT. */
export function lookupZoomAlpha(dtMs: number): number {
  return sampleDtTable(ZOOM_ALPHA_LUT, dtMs);
}

/** Frame-rate-independent pan inertia velocity decay factor via O(1) LUT. */
export function lookupInertiaDecay(dtMs: number): number {
  return sampleDtTable(INERTIA_DECAY_LUT, dtMs);
}

/** Frame-rate-independent custom cursor kinematic LERP alpha via O(1) LUT. */
export function lookupCursorLerpAlpha(dtMs: number): number {
  return sampleDtTable(CURSOR_LERP_LUT, dtMs);
}

// ---------------------------------------------------------------------------
// 7. Cubic Bezier Bernstein Basis LUT & Equal-Arc-Length Resampler
// ---------------------------------------------------------------------------

const BEZIER_FINE_SAMPLES = 48;

/** Packed `[B0, B1, B2, B3]` Bernstein polynomial weights for `t = i / 48`. */
export const BEZIER_BASIS_LUT: Float32Array = (() => {
  const table = new Float32Array((BEZIER_FINE_SAMPLES + 1) * 4);

  for (let i = 0; i <= BEZIER_FINE_SAMPLES; i++) {
    const t = i / BEZIER_FINE_SAMPLES;
    const inv = 1 - t;
    const inv2 = inv * inv;
    const t2 = t * t;
    const offset = i * 4;

    table[offset] = inv2 * inv;
    table[offset + 1] = 3 * inv2 * t;
    table[offset + 2] = 3 * inv * t2;
    table[offset + 3] = t2 * t;
  }

  return table;
})();

/**
 * Samples a cubic Bezier curve into `outputSteps + 1` equal-arc-length points using
 * the precomputed Bernstein basis LUT so GPU-composited wire particles glide at constant speed.
 */
export function sampleEqualArcCubicBezier(
  curve: CubicBezierCurve,
  outputSteps = 24,
): readonly Point2D[] {
  const xs = new Float32Array(BEZIER_FINE_SAMPLES + 1);
  const ys = new Float32Array(BEZIER_FINE_SAMPLES + 1);
  const arcLengths = new Float32Array(BEZIER_FINE_SAMPLES + 1);

  for (let i = 0; i <= BEZIER_FINE_SAMPLES; i++) {
    const o = i * 4;
    const b0 = BEZIER_BASIS_LUT[o];
    const b1 = BEZIER_BASIS_LUT[o + 1];
    const b2 = BEZIER_BASIS_LUT[o + 2];
    const b3 = BEZIER_BASIS_LUT[o + 3];

    const px = b0 * curve.startX + b1 * curve.control1X + b2 * curve.control2X + b3 * curve.endX;
    const py = b0 * curve.startY + b1 * curve.control1Y + b2 * curve.control2Y + b3 * curve.endY;

    xs[i] = px;
    ys[i] = py;

    if (i > 0) {
      const dx = px - xs[i - 1];
      const dy = py - ys[i - 1];
      arcLengths[i] = arcLengths[i - 1] + Math.hypot(dx, dy);
    }
  }

  const totalLength = arcLengths[BEZIER_FINE_SAMPLES];
  const count = Math.max(2, outputSteps);
  const points: Point2D[] = new Array(count + 1);

  if (totalLength <= 0.001) {
    for (let k = 0; k <= count; k++) {
      points[k] = { x: curve.startX, y: curve.startY };
    }

    return points;
  }

  let fineCursor = 0;

  for (let k = 0; k <= count; k++) {
    const targetDist = (k / count) * totalLength;

    while (fineCursor < BEZIER_FINE_SAMPLES - 1 && arcLengths[fineCursor + 1] < targetDist) {
      fineCursor += 1;
    }

    const segStart = arcLengths[fineCursor];
    const segLen = arcLengths[fineCursor + 1] - segStart;
    const alpha = segLen > 0 ? (targetDist - segStart) / segLen : 0;

    points[k] = {
      x: Math.round((xs[fineCursor] + (xs[fineCursor + 1] - xs[fineCursor]) * alpha) * 100) / 100,
      y: Math.round((ys[fineCursor] + (ys[fineCursor + 1] - ys[fineCursor]) * alpha) * 100) / 100,
    };
  }

  return points;
}
