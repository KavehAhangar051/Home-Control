"use client";

import Image from "next/image";
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
  className = "aspect-video w-full",
}: GpuLutImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawRef = useRef<() => void>(() => {});
  const lutRef = useRef(lut);
  const intensityRef = useRef(intensity);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!container || !image || !canvas || image.getAttribute("src") !== imageSrc) return;

    let renderer: WebGL2LutRenderer | null = null;
    let disposed = false;
    setReady(false);

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
      if (bounds.width <= 0 || bounds.height <= 0) return;

      try {
        renderer.resize(bounds.width, bounds.height, window.devicePixelRatio);
        if (
          renderer.render(
            image,
            lutRef.current,
            image.naturalWidth,
            image.naturalHeight,
            intensityRef.current,
          )
        ) {
          setReady(true);
        }
      } catch {
        renderer.dispose();
        renderer = null;
        setReady(false);
      }
    };

    const initialize = () => {
      if (disposed || renderer) return;
      try {
        renderer = new WebGL2LutRenderer(canvas);

        setReady(false);
        draw();
      } catch {
        renderer = null;

        setReady(false);
      }
    };

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      renderer?.dispose();
      renderer = null;

      setReady(false);
    };

    const handleContextRestored = () => initialize();

    drawRef.current = draw;
    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(draw)
        : null;
    resizeObserver?.observe(container);

    const intersectionObserver =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              if (entries.some((entry) => entry.isIntersecting)) initialize();
            },
            { rootMargin: "160px" },
          )
        : null;
    intersectionObserver?.observe(container);

    const handleWindowResize = () => draw();
    const handleVisibilityChange = () => {
      if (!document.hidden) draw();
    };

    if (!resizeObserver) {
      window.addEventListener("resize", handleWindowResize, { passive: true });
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    if (!intersectionObserver) initialize();

    return () => {
      disposed = true;
      drawRef.current = () => {};
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      window.removeEventListener("resize", handleWindowResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      renderer?.dispose();
    };
  }, [imageSrc]);

  useEffect(() => {
    lutRef.current = lut;
    intensityRef.current = intensity;
    drawRef.current();
  }, [lut, intensity]);

  return (
    <div ref={containerRef} className={`relative isolate overflow-hidden ${className}`}>
      <Image
        ref={imageRef}
        crossOrigin="anonymous"
        src={imageSrc}
        alt={alt}
        fill
        sizes="100vw"
        unoptimized
        decoding="async"
        loading="lazy"
        onLoad={() => drawRef.current()}
        className="object-cover"
      />
      <canvas
        ref={canvasRef}
        className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-200 ${ready ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}
