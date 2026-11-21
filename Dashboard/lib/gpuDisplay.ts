/**
 * @file lib/gpuDisplay.ts
 * @description Native display resolution, devicePixelRatio (DPR), refresh-rate cadence probe,
 * and WebGL2 VRAM 3D LUT capability helpers. Runs a short one-shot rAF probe on mount/resize
 * (zero idle polling) so compositor transforms align 1:1 with physical display pixels at
 * 60Hz, 90Hz, 120Hz, 144Hz, 165Hz, 240Hz, or 360Hz.
 */

export type GpuRenderBackend = "webgl2" | "webgl" | "compositor";

export interface GpuDisplayProfile {
  dpr: number;
  logicalWidth: number;
  logicalHeight: number;
  physicalWidth: number;
  physicalHeight: number;
  screenPhysicalWidth: number;
  screenPhysicalHeight: number;
  refreshRateHz: number;
  backend: GpuRenderBackend;
  maxTextureSize: number;
  max3dTextureSize: number;
}

const STANDARD_REFRESH_RATES = [60, 75, 90, 120, 144, 165, 180, 240, 360] as const;

let cachedDpr = 1;
let cachedBackendCapability: {
  backend: GpuRenderBackend;
  maxTextureSize: number;
  max3dTextureSize: number;
} | null = null;

/** Snaps a raw measured Hz frequency to the closest standard display refresh rate. */
export function snapRefreshRateHz(rawHz: number): number {
  if (!Number.isFinite(rawHz) || rawHz <= 0) return 60;

  let closest: number = STANDARD_REFRESH_RATES[0];
  let bestDiff = Math.abs(rawHz - closest);

  for (let i = 1; i < STANDARD_REFRESH_RATES.length; i++) {
    const candidate = STANDARD_REFRESH_RATES[i];
    const diff = Math.abs(rawHz - candidate);

    if (diff < bestDiff) {
      bestDiff = diff;
      closest = candidate;
    }
  }

  return closest;
}

/** Reads and caches the active display `devicePixelRatio` safely in SSR or browser contexts. */
export function getDisplayDpr(): number {
  if (typeof window === "undefined") return 1;
  const raw = window.devicePixelRatio;
  cachedDpr = Number.isFinite(raw) && raw > 0 ? Math.min(4, raw) : 1;

  return cachedDpr;
}

/**
 * Aligns a CSS pixel coordinate to the nearest physical device pixel (`1 / dpr`).
 * Prevents integer-pixel micro-judder at 120Hz+ and keeps thin borders/text razor-sharp
 * across 1920x1080 (1x), 2x Retina, and 3x HiDPI displays.
 */
export function snapToDevicePixel(value: number, dpr = cachedDpr): number {
  const safeDpr = dpr > 0 ? dpr : 1;

  return Math.round(value * safeDpr) / safeDpr;
}

/**
 * Probes WebGL2 / WebGL VRAM texture limits once and immediately releases the probe context
 * so the dashboard never wastes persistent WebGL context slots.
 */
export function probeGpuVramCapability(): {
  backend: GpuRenderBackend;
  maxTextureSize: number;
  max3dTextureSize: number;
} {
  if (cachedBackendCapability) return cachedBackendCapability;

  if (typeof document === "undefined") {
    return { backend: "compositor", maxTextureSize: 0, max3dTextureSize: 0 };
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;

    const gl2 = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    });

    if (gl2) {
      const maxTextureSize = Number(gl2.getParameter(gl2.MAX_TEXTURE_SIZE)) || 0;
      const max3dTextureSize = Number(gl2.getParameter(gl2.MAX_3D_TEXTURE_SIZE)) || 0;
      gl2.getExtension("WEBGL_lose_context")?.loseContext();
      cachedBackendCapability = { backend: "webgl2", maxTextureSize, max3dTextureSize };

      return cachedBackendCapability;
    }

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      powerPreference: "high-performance",
    });

    if (gl) {
      const maxTextureSize = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 0;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      cachedBackendCapability = { backend: "webgl", maxTextureSize, max3dTextureSize: 0 };

      return cachedBackendCapability;
    }
  } catch {
    // Fallback cleanly to standard GPU compositor backend in restricted WebViews.
  }

  cachedBackendCapability = { backend: "compositor", maxTextureSize: 0, max3dTextureSize: 0 };

  return cachedBackendCapability;
}

/**
 * Uploads an RGBA8 3D color LUT texture directly into GPU VRAM (`TEXTURE_3D`) with
 * hardware trilinear filtering (`LINEAR`) for WebGL2 GPU-accelerated color grading surfaces.
 */
export function upload3dColorLutTexture(
  gl: WebGL2RenderingContext,
  size: number,
  rgbaData: Uint8Array,
): WebGLTexture | null {
  const tex = gl.createTexture();
  if (!tex) return null;

  gl.bindTexture(gl.TEXTURE_3D, tex);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
  gl.texImage3D(
    gl.TEXTURE_3D,
    0,
    gl.RGBA8,
    size,
    size,
    size,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    rgbaData,
  );
  gl.bindTexture(gl.TEXTURE_3D, null);

  return tex;
}

/** Reads the current native logical + physical display resolution snapshot. */
export function readDisplayProfile(refreshRateHz = 60): GpuDisplayProfile {
  const capability = probeGpuVramCapability();

  if (typeof window === "undefined") {
    return {
      dpr: 1,
      logicalWidth: 1920,
      logicalHeight: 1080,
      physicalWidth: 1920,
      physicalHeight: 1080,
      screenPhysicalWidth: 1920,
      screenPhysicalHeight: 1080,
      refreshRateHz,
      ...capability,
    };
  }

  const dpr = getDisplayDpr();
  const logicalWidth = Math.max(1, window.innerWidth);
  const logicalHeight = Math.max(1, window.innerHeight);
  const screenWidth = window.screen?.width || logicalWidth;
  const screenHeight = window.screen?.height || logicalHeight;

  return {
    dpr,
    logicalWidth,
    logicalHeight,
    physicalWidth: Math.round(logicalWidth * dpr),
    physicalHeight: Math.round(logicalHeight * dpr),
    screenPhysicalWidth: Math.round(screenWidth * dpr),
    screenPhysicalHeight: Math.round(screenHeight * dpr),
    refreshRateHz: snapRefreshRateHz(refreshRateHz),
    ...capability,
  };
}

/**
 * Runs a bounded one-shot `requestAnimationFrame` probe (~14 frames) to measure the display's
 * native refresh rate, then terminates immediately (0 idle CPU). Returns a cancellation handle.
 */
export function probeNativeRefreshRate(
  onResolved: (hz: number) => void,
  sampleFrames = 14,
): () => void {
  if (typeof window === "undefined" || typeof requestAnimationFrame === "undefined") {
    onResolved(60);

    return () => {};
  }

  let rafId: number | null = null;
  let lastTs = 0;
  let cancelled = false;
  const deltas: number[] = [];

  const tick = (ts: number) => {
    if (cancelled) return;

    if (lastTs > 0) {
      const dt = ts - lastTs;
      // Accept valid display intervals between ~2.2ms (450Hz) and 40ms (25Hz)
      if (dt >= 2.2 && dt <= 40) {
        deltas.push(dt);
      }
    }

    lastTs = ts;

    if (deltas.length >= sampleFrames) {
      rafId = null;
      deltas.sort((a, b) => a - b);
      const medianDt = deltas[deltas.length >> 1];
      onResolved(snapRefreshRateHz(1000 / medianDt));

      return;
    }

    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
}
