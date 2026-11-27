"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { hash, reducedMotion as systemReducedMotion } from "./kit";

export type GrainToggleSize = "sm" | "md" | "lg";

export interface GrainToggleEffectProps {
  value: boolean;
  size?: GrainToggleSize;
  onColor?: string;
  offColor?: string;
  reducedMotion?: boolean;
  className?: string;
}

const SIZE_CONFIG: Record<
  GrainToggleSize,
  {
    trackW: number;
    trackH: number;
    thumb: number;
    pad: number;
    radius: number;
    thumbRadius: number;
  }
> = {
  sm: { trackW: 44, trackH: 24, thumb: 18, pad: 3, radius: 7, thumbRadius: 5 },
  md: { trackW: 44, trackH: 24, thumb: 18, pad: 3, radius: 7, thumbRadius: 5 },
  lg: { trackW: 50, trackH: 28, thumb: 20, pad: 4, radius: 8, thumbRadius: 6 },
};

/**
 * Non-interactive Dissolve visual toggle indicator preserving the dashboard's
 * 44x24 px square-track geometry with an 18x18 px rounded-square thumb and
 * subtle canvas grain burst on state change.
 */
export function GrainToggleEffect({
  value,
  size = "sm",
  onColor = "var(--dissolve-primary, var(--accent3))",
  offColor = "var(--dissolve-surface, var(--input))",
  reducedMotion = false,
  className,
}: GrainToggleEffectProps) {
  const cfg = SIZE_CONFIG[size] ?? SIZE_CONFIG.sm;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const trackRef = useRef<HTMLSpanElement | null>(null);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (prevValueRef.current === value) return;
    prevValueRef.current = value;

    if (reducedMotion || systemReducedMotion()) return;
    const canvas = canvasRef.current;
    const track = trackRef.current;
    if (!canvas || !track) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pad = 10;
    const w = cfg.trackW + pad * 2;
    const h = cfg.trackH + pad * 2;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    const resolvedColor = getComputedStyle(track).backgroundColor || "#ededed";
    const startX = pad + (value ? cfg.pad + cfg.thumb / 2 : cfg.trackW - cfg.pad - cfg.thumb / 2);
    const endX = pad + (value ? cfg.trackW - cfg.pad - cfg.thumb / 2 : cfg.pad + cfg.thumb / 2);
    const cy = pad + cfg.trackH / 2;

    const grainCount = 18;
    const duration = 260;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = resolvedColor;

      for (let i = 0; i < grainCount; i++) {
        const h1 = hash(i, 3);
        const h2 = hash(i, 7) - 0.5;
        const localT = Math.min(1, Math.max(0, (t - h1 * 0.25) / 0.75));
        const ease = 1 - (1 - localT) ** 3;
        const arc = Math.sin(Math.PI * localT);
        const px = startX + (endX - startX) * ease + (h1 - 0.5) * 6 * arc;
        const py = cy + h2 * (cfg.thumb * 0.9) * arc;
        const alpha = (1 - localT) * 0.7;
        if (alpha <= 0.01) continue;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(px, py, 1.3 + h1 * 1.1 * (1 - localT * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, w, h);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reducedMotion, cfg.pad, cfg.thumb, cfg.trackH, cfg.trackW]);

  const travelX = cfg.trackW - cfg.thumb - cfg.pad * 2;

  return (
    <span
      ref={trackRef}
      aria-hidden="true"
      dir="ltr"
      className={cn(
        "relative inline-flex shrink-0 items-center pointer-events-none select-none border transition-colors",
        reducedMotion ? "duration-0" : "duration-200",
        value ? "border-transparent" : "border-border-color/80",
        className,
      )}
      style={{
        width: `${cfg.trackW}px`,
        height: `${cfg.trackH}px`,
        borderRadius: `${cfg.radius}px`,
        backgroundColor: value ? onColor : offColor,
      }}
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute -inset-[10px]"
        style={{
          width: `${cfg.trackW + 20}px`,
          height: `${cfg.trackH + 20}px`,
        }}
      />
      <span
        className={cn(
          "relative block shadow-xs",
          reducedMotion
            ? "transition-none"
            : "transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
        )}
        style={{
          width: `${cfg.thumb}px`,
          height: `${cfg.thumb}px`,
          borderRadius: `${cfg.thumbRadius}px`,
          backgroundColor: value
            ? "var(--dissolve-primary-foreground, var(--accent3-foreground))"
            : "var(--dissolve-foreground, var(--text-primary))",
          opacity: value ? 1 : 0.82,
          transform: `translate3d(${value ? cfg.pad + travelX : cfg.pad}px, 0, 0)`,
        }}
      />
    </span>
  );
}
