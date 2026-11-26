"use client";

import { type RefObject, useEffect } from "react";
import { getDisplayDpr, snapToDevicePixel } from "@/lib/gpuDisplay";
import { lookupCursorLerpAlpha } from "@/lib/gpuLut";
import { checkClickable, checkHoveringText } from "./utils/cursor-detection";

export interface CursorElementsRef {
  cursorRef: RefObject<HTMLDivElement | null>;
  innerRef: RefObject<HTMLDivElement | null>;
  enabled?: boolean;
}

/**
 * Attaches a native-refresh-rate requestAnimationFrame kinematic LERP loop for the custom cursor.
 * Uses a precomputed dt->alpha LUT and physical-pixel DPR snapping so 60Hz, 120Hz, 144Hz, and
 * 240Hz displays share identical feel with zero main-thread Math.pow overhead and zero per-frame
 * CSS transition cancellations.
 *
 * @param {CursorElementsRef} refs - Direct DOM references to cursor container and inner 3D shell.
 */
export function useHardwareCursorListeners({
  cursorRef,
  innerRef,
  enabled = true,
}: CursorElementsRef) {
  useEffect(() => {
    if (!enabled) return;

    let isVisible = false;
    let isMouseDown = false;
    let isClickable = false;
    let isHoveringText = false;
    let isScrolling = false;
    let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

    let targetX = -100;
    let targetY = -100;
    let currentX = -100;
    let currentY = -100;

    // Smooth 3D secondary-motion state driven directly in the native-FPS LUT loop
    // (eliminates 60-240Hz CSS transition cancellation/re-creation on innerRef).
    let currentRotX = 0;
    let currentRotY = 0;
    let currentRotZ = 0;
    let currentScale = 1;
    let targetRotX = 0;
    let targetRotY = 0;
    let targetRotZ = 0;
    let targetScale = 1;

    let rafId: number | null = null;
    let isLoopRunning = false;
    let lastFrameTs = 0;
    let lastCursorX = Number.NaN;
    let lastCursorY = Number.NaN;
    let cachedDpr = getDisplayDpr();

    // Cache previous written transform state to prevent redundant CSS string allocation
    let prevRotX = -999;
    let prevRotY = -999;
    let prevRotZ = -999;
    let prevScale = -999;

    const refreshInnerTargets = (velX = 0) => {
      targetRotX = isMouseDown ? 20 : 0;
      targetRotY = isMouseDown ? -20 : 0;
      const rawTilt = Math.max(-12, Math.min(12, velX * 0.32));
      const dynamicTilt = ((rawTilt * 10) | 0) / 10;

      targetRotZ = isHoveringText ? 14 : isClickable ? -6 : dynamicTilt;
      targetScale = isClickable ? (isMouseDown ? 1.02 : 1.14) : isMouseDown ? 0.9 : 1;
    };

    const writeInnerTransform = (rotX: number, rotY: number, rotZ: number, scale: number) => {
      const inner = innerRef.current;

      if (!inner) return;

      const qx = Math.round(rotX * 20) / 20;
      const qy = Math.round(rotY * 20) / 20;
      const qz = Math.round(rotZ * 20) / 20;
      const qs = Math.round(scale * 1000) / 1000;

      if (qx === prevRotX && qy === prevRotY && qz === prevRotZ && qs === prevScale) {
        return;
      }

      prevRotX = qx;
      prevRotY = qy;
      prevRotZ = qz;
      prevScale = qs;

      inner.style.transform = `perspective(600px) rotateX(${qx}deg) rotateY(${qy}deg) rotateZ(${qz}deg) scale3d(${qs},${qs},1)`;
    };

    const animate = (now: number) => {
      const dt = lastFrameTs > 0 ? Math.min(64, Math.max(1, now - lastFrameTs)) : 16.6667;
      lastFrameTs = now;

      const dx = targetX - currentX;
      const dy = targetY - currentY;

      // Frame-rate-independent kinematic interpolation via O(1) LUT
      const alpha = lookupCursorLerpAlpha(dt);
      // During an active pointer interaction, the custom cursor is the visible
      // input surface: keep it on the hardware pointer so sliders and other
      // pointer-driven controls share one coordinate instead of chasing a lagging cursor.
      const positionAlpha = isMouseDown ? 1 : alpha;
      currentX += dx * positionAlpha;
      currentY += dy * positionAlpha;

      const cursor = cursorRef.current;

      if (cursor) {
        const rx = snapToDevicePixel(currentX, cachedDpr);
        const ry = snapToDevicePixel(currentY, cachedDpr);

        if (rx !== lastCursorX || ry !== lastCursorY) {
          lastCursorX = rx;
          lastCursorY = ry;
          cursor.style.transform = `translate3d(${rx}px,${ry}px,0)`;
        }
      }

      // Apply subtle dynamic velocity tilt during free motion
      if (!isMouseDown && !isClickable && !isHoveringText) {
        refreshInnerTargets(dx);
      }

      const dRotX = targetRotX - currentRotX;
      const dRotY = targetRotY - currentRotY;
      const dRotZ = targetRotZ - currentRotZ;
      const dScale = targetScale - currentScale;

      currentRotX += dRotX * alpha;
      currentRotY += dRotY * alpha;
      currentRotZ += dRotZ * alpha;
      currentScale += dScale * alpha;

      writeInnerTransform(currentRotX, currentRotY, currentRotZ, currentScale);

      // Keep loop running only while cursor position OR 3D tilt/scale is still settling
      const distSq = dx * dx + dy * dy;
      const is3DSettling =
        Math.abs(dRotX) > 0.05 ||
        Math.abs(dRotY) > 0.05 ||
        Math.abs(dRotZ) > 0.05 ||
        Math.abs(dScale) > 0.001;

      if (distSq > 0.005 || is3DSettling) {
        rafId = requestAnimationFrame(animate);
      } else {
        currentX = targetX;
        currentY = targetY;
        currentRotX = targetRotX;
        currentRotY = targetRotY;
        currentRotZ = targetRotZ;
        currentScale = targetScale;
        isLoopRunning = false;
        lastFrameTs = 0;
        rafId = null;

        if (cursor) {
          const rx = snapToDevicePixel(targetX, cachedDpr);
          const ry = snapToDevicePixel(targetY, cachedDpr);

          if (rx !== lastCursorX || ry !== lastCursorY) {
            lastCursorX = rx;
            lastCursorY = ry;
            cursor.style.transform = `translate3d(${rx}px,${ry}px,0)`;
          }
        }

        refreshInnerTargets(0);
        writeInnerTransform(targetRotX, targetRotY, targetRotZ, targetScale);
      }
    };

    const startLoop = () => {
      if (document.hidden || isLoopRunning) return;

      isLoopRunning = true;
      lastFrameTs = 0;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(animate);
    };

    const onResize = () => {
      cachedDpr = getDisplayDpr();
    };

    const setHardwareCursorHidden = (hidden: boolean) => {
      document.body.classList.toggle("dashboard-custom-cursor-active", hidden);
    };

    const hideCustomCursor = () => {
      isVisible = false;
      isLoopRunning = false;
      lastFrameTs = 0;

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      if (cursorRef.current) cursorRef.current.style.opacity = "0";
      setHardwareCursorHidden(false);
    };

    const onPointerMove = (e: PointerEvent) => {
      setHardwareCursorHidden(true);
      if (isVisible && targetX === e.clientX && targetY === e.clientY) return;

      targetX = e.clientX;
      targetY = e.clientY;

      if (!isVisible) {
        isVisible = true;
        currentX = targetX;
        currentY = targetY;
        const cursor = cursorRef.current;

        if (cursor) {
          const rx = snapToDevicePixel(targetX, cachedDpr);
          const ry = snapToDevicePixel(targetY, cachedDpr);
          cursor.style.opacity = "1";
          cursor.style.transform = `translate3d(${rx}px,${ry}px,0)`;
          lastCursorX = rx;
          lastCursorY = ry;
        }
      }

      startLoop();
    };

    const onPointerLeave = hideCustomCursor;

    const onPointerEnter = (e: PointerEvent) => {
      setHardwareCursorHidden(true);
      isVisible = true;
      targetX = e.clientX;
      targetY = e.clientY;
      currentX = targetX;
      currentY = targetY;
      const cursor = cursorRef.current;

      if (cursor) {
        const rx = snapToDevicePixel(targetX, cachedDpr);
        const ry = snapToDevicePixel(targetY, cachedDpr);
        cursor.style.opacity = "1";
        cursor.style.transform = `translate3d(${rx}px,${ry}px,0)`;
        lastCursorX = rx;
        lastCursorY = ry;
      }

      startLoop();
    };

    const onPointerDown = () => {
      isMouseDown = true;
      refreshInnerTargets();
      startLoop();
    };

    const onPointerUp = () => {
      isMouseDown = false;
      refreshInnerTargets();
      startLoop();
    };

    const onMouseOver = (e: MouseEvent) => {
      if (isScrolling) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      const clickable = checkClickable(target);
      const textHover = checkHoveringText(target, clickable);

      if (clickable !== isClickable || textHover !== isHoveringText) {
        isClickable = clickable;
        isHoveringText = textHover;
        refreshInnerTargets();
        startLoop();
      }
    };

    const onScroll = () => {
      if (!isScrolling) {
        isScrolling = true;
        isClickable = false;
        isHoveringText = false;
        refreshInnerTargets();
        startLoop();
      }

      if (scrollTimeout !== null) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        isScrolling = false;
        scrollTimeout = null;
      }, 100);
    };

    const onWindowBlur = () => hideCustomCursor();

    const onVisibilityChange = () => {
      if (document.hidden) {
        hideCustomCursor();
        if (rafId !== null) cancelAnimationFrame(rafId);
        rafId = null;
        isLoopRunning = false;

        return;
      }

      if (isVisible) startLoop();
    };

    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("blur", onWindowBlur);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave, { passive: true });
    document.addEventListener("pointerenter", onPointerEnter, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    document.addEventListener("mouseover", onMouseOver, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("blur", onWindowBlur);
      setHardwareCursorHidden(false);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("pointerenter", onPointerEnter);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("mouseover", onMouseOver);
      window.removeEventListener("scroll", onScroll);

      if (scrollTimeout !== null) clearTimeout(scrollTimeout);
    };
  }, [cursorRef, innerRef, enabled]);
}
