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
 * 240Hz displays share identical feel with zero main-thread Math.pow overhead.
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
    let rafId: number | null = null;
    let isLoopRunning = false;
    let lastFrameTs = 0;
    let lastCursorX = Number.NaN;
    let lastCursorY = Number.NaN;

    // Cache previous transform state to prevent redundant CSS string construction and DOM writes
    let prevRotX = -999;
    let prevRotY = -999;
    let prevRotZ = -999;
    let prevScale = -999;

    const updateInnerTransform = (velX = 0) => {
      const inner = innerRef.current;

      if (!inner) return;

      // 3D Secondary Feedback (Disney Squash/Anticipation & Follow-Through)
      const rotX = isMouseDown ? 20 : 0;
      const rotY = isMouseDown ? -20 : 0;
      const rawTilt = Math.max(-12, Math.min(12, velX * 0.32));
      const dynamicTilt = ((rawTilt * 10) | 0) / 10;

      const rotZ = isHoveringText ? 14 : isClickable ? -6 : dynamicTilt;
      const scale = isClickable ? (isMouseDown ? 1.02 : 1.14) : isMouseDown ? 0.9 : 1;

      // V8 Fast Path: Skip string allocation and style invalidation if values are identical
      if (rotX === prevRotX && rotY === prevRotY && rotZ === prevRotZ && scale === prevScale) {
        return;
      }

      prevRotX = rotX;
      prevRotY = rotY;
      prevRotZ = rotZ;
      prevScale = scale;

      inner.style.transform = `perspective(600px) rotateX(${rotX}deg) rotateY(${rotY}deg) rotateZ(${rotZ}deg) scale3d(${scale},${scale},1)`;
    };

    const animate = (now: number) => {
      const dt = lastFrameTs > 0 ? Math.min(64, Math.max(1, now - lastFrameTs)) : 16.6667;
      lastFrameTs = now;

      const dx = targetX - currentX;
      const dy = targetY - currentY;

      // Frame-rate-independent kinematic interpolation via O(1) LUT
      const alpha = lookupCursorLerpAlpha(dt);
      currentX += dx * alpha;
      currentY += dy * alpha;

      const cursor = cursorRef.current;

      if (cursor) {
        const dpr = getDisplayDpr();
        const rx = snapToDevicePixel(currentX, dpr);
        const ry = snapToDevicePixel(currentY, dpr);
        if (rx !== lastCursorX || ry !== lastCursorY) {
          lastCursorX = rx;
          lastCursorY = ry;
          cursor.style.transform = `translate3d(${rx}px,${ry}px,0)`;
        }
      }

      // Apply subtle dynamic velocity tilt during motion
      if (!isMouseDown && !isClickable && !isHoveringText) {
        updateInnerTransform(dx);
      }

      // Keep loop running only while cursor is still settling toward target
      const distSq = dx * dx + dy * dy;

      if (distSq > 0.005) {
        rafId = requestAnimationFrame(animate);
      } else {
        currentX = targetX;
        currentY = targetY;
        isLoopRunning = false;
        lastFrameTs = 0;
        rafId = null;
        if (cursor) {
          const dpr = getDisplayDpr();
          const rx = snapToDevicePixel(targetX, dpr);
          const ry = snapToDevicePixel(targetY, dpr);
          if (rx !== lastCursorX || ry !== lastCursorY) {
            lastCursorX = rx;
            lastCursorY = ry;
            cursor.style.transform = `translate3d(${rx}px,${ry}px,0)`;
          }
        }
        updateInnerTransform(0);
      }
    };

    const startLoop = () => {
      if (document.hidden || isLoopRunning) return;

      isLoopRunning = true;
      lastFrameTs = 0;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(animate);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (isVisible && targetX === e.clientX && targetY === e.clientY) return;

      targetX = e.clientX;
      targetY = e.clientY;

      if (!isVisible) {
        isVisible = true;
        currentX = targetX;
        currentY = targetY;
        const cursor = cursorRef.current;

        if (cursor) {
          const dpr = getDisplayDpr();
          const rx = snapToDevicePixel(targetX, dpr);
          const ry = snapToDevicePixel(targetY, dpr);
          cursor.style.opacity = "1";
          cursor.style.transform = `translate3d(${rx}px,${ry}px,0)`;
          lastCursorX = rx;
          lastCursorY = ry;
        }
      }

      startLoop();
    };

    const onPointerLeave = () => {
      isVisible = false;
      isLoopRunning = false;
      lastFrameTs = 0;

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      if (cursorRef.current) {
        cursorRef.current.style.opacity = "0";
      }
    };

    const onPointerEnter = (e: PointerEvent) => {
      isVisible = true;
      targetX = e.clientX;
      targetY = e.clientY;
      currentX = targetX;
      currentY = targetY;
      const cursor = cursorRef.current;

      if (cursor) {
        const dpr = getDisplayDpr();
        const rx = snapToDevicePixel(targetX, dpr);
        const ry = snapToDevicePixel(targetY, dpr);
        cursor.style.opacity = "1";
        cursor.style.transform = `translate3d(${rx}px,${ry}px,0)`;
        lastCursorX = rx;
        lastCursorY = ry;
      }

      startLoop();
    };

    const onPointerDown = () => {
      isMouseDown = true;
      updateInnerTransform();
    };

    const onPointerUp = () => {
      isMouseDown = false;
      updateInnerTransform();
    };

    const onMouseOver = (e: MouseEvent) => {
      if (isScrolling) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      const clickable = checkClickable(target);
      const textHover = checkHoveringText(target, clickable);

      if (clickable !== isClickable || textHover !== isHoveringText) {
        isClickable = clickable;
        isHoveringText = textHover;
        updateInnerTransform();
      }
    };

    const onScroll = () => {
      if (!isScrolling) {
        isScrolling = true;
        isClickable = false;
        isHoveringText = false;
        updateInnerTransform();
      }

      if (scrollTimeout !== null) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        isScrolling = false;
        scrollTimeout = null;
      }, 100);
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        if (rafId !== null) cancelAnimationFrame(rafId);
        rafId = null;
        isLoopRunning = false;
        return;
      }

      if (isVisible) startLoop();
    };

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
