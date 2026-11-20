"use client";

import { useEffect, useRef, useState } from "react";
import { WebGL2LutRenderer } from "@/lib/gpu/webgl2-lut-renderer";
import type { Lut3D } from "@/lib/gpu/lut3d";

interface GpuLutImageProps {
  imageSrc: string;
  alt: string;
  lut: Lut3D;
  intensity?: number;
  className?: string;
}

/**
 * Displays an image with an optional WebGL2 LUT pass.
 * The original image remains visible if hardware WebGL2 is unavailable or lost.
 */
export function GpuLutImage({
  imageSrc,
  alt,
  lut,
  intensity = 1,
  className = "",
}: GpuLutImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGL2LutRenderer | null>(null);
  const drawRef = useRef<() => void>(() => {});
  const lutRef = useRef(lut);
  const intensityRef = useRef(intensity);
  const [ready, setReady] = useState(false);

  lutRef.current = lut;
  intensityRef.current = intensity;

  useEffect(() => {
    const container = containerRef.current;
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!container || !image || !canvas) return;

    let renderer: WebGL2LutRenderer | null = null;
    let disposed = false;

    const draw = () => {
      if (
        disposed ||
        document.hidden ||
        !renderer ||
        !image.complete ||
        image.naturalWidth === 0
      ) {
        return;
      }

      const bounds = container.getBoundingClientRect();
      renderer.resize(bounds.width, bounds.height, window.devicePixelRatio);
      if (renderer.render(image, lutRef.current, intensityRef.current)) {
        setReady(true);
      }
    };

    const initialize = () => {
      if (disposed || renderer) return;
      try {
        renderer = new WebGL2LutRenderer(canvas);
        rendererRef.current = renderer;
        setReady(false);
        draw();
      } catch {
        renderer = null;
        rendererRef.current = null;
        setReady(false);
      }
    };

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      renderer?.dispose();
      renderer = null;
      rendererRef.current = null;
      setReady(false);
    };

    const handleContextRestored = () => {
      initialize();
      draw();
    };

    drawRef.current = draw;
    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(draw)
        : null;
    resizeObserver?.observe(container);

    const handleWindowResize = () => draw();
    const handleVisibilityChange = () => {
      if (!document.hidden) draw();
    };

    if (!resizeObserver) {
      window.addEventListener("resize", handleWindowResize, { passive: true });
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    initialize();
    if (image.complete) draw();

    return () => {
      disposed = true;
      drawRef.current = () => {};
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleWindowResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      renderer?.dispose();
      rendererRef.current = null;
    };
  }, [imageSrc]);

  useEffect(() => {
    drawRef.current();
  }, [lut, intensity]);

  return (
    <div ref={containerRef} className={`relative isolate overflow-hidden ${className}`}>
      <img
        ref={imageRef}
        src={imageSrc}
        alt={alt}
        crossOrigin="anonymous"
        decoding="async"
        onLoad={() => drawRef.current()}
        className="block h-full w-full object-cover"
      />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-200 ${ready ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}
