'use client';

/**
 * @file hooks/useDesktopSmoothScroll.ts
 * @description Custom React hook to dynamically load and manage Lenis smooth scrolling exclusively on desktop and laptop devices.
 */

import { useEffect, useRef } from 'react';
import { isDesktopOrLaptop } from '@/utils/deviceDetector';
import Lenis from 'lenis';

/**
 * Activates inertia-based smooth scrolling on desktop and laptop viewports via Lenis.
 * Automatically cleans up animations and instances on unmount or when transitioning to mobile screens.
 */
export function useDesktopSmoothScroll(): void {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    let animationFrameId: number | null = null;
    let isCancelled = false;

    const raf = (time: number) => {
      const lenis = lenisRef.current;

      if (!lenis) {
        animationFrameId = null;

        return;
      }

      lenis.raf(time);

      if (lenis.isScrolling) {
        animationFrameId = requestAnimationFrame(raf);
      } else {
        animationFrameId = null;
      }
    };

    const wakeLoop = () => {
      if (animationFrameId === null && !isCancelled && lenisRef.current) {
        animationFrameId = requestAnimationFrame(raf);
      }
    };

    /**
     * Initializes Lenis smooth scroll if environment is verified as desktop/laptop.
     */
    function initSmoothScroll() {
      if (!isDesktopOrLaptop()) {
        destroyLenis();

        return;
      }

      if (lenisRef.current) return;

      try {
        if (isCancelled) return;

        const lenis = new Lenis({
          duration: 1.2,
          easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          orientation: 'vertical',
          gestureOrientation: 'vertical',
          smoothWheel: true,
          touchMultiplier: 1,
        });

        lenisRef.current = lenis;
        lenis.on('scroll', wakeLoop);
        window.addEventListener('wheel', wakeLoop, { passive: true });
        window.addEventListener('touchmove', wakeLoop, { passive: true });
        window.addEventListener('keydown', wakeLoop, { passive: true });
      } catch (err) {
        console.error('Failed to initialize Lenis smooth scroll:', err);
      }
    }

    /**
     * Tears down active Lenis instance and animation loop.
     */
    function destroyLenis() {
      window.removeEventListener('wheel', wakeLoop);
      window.removeEventListener('touchmove', wakeLoop);
      window.removeEventListener('keydown', wakeLoop);

      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }

      if (lenisRef.current) {
        lenisRef.current.destroy();
        lenisRef.current = null;
      }
    }

    initSmoothScroll();

    let resizeTimeout: NodeJS.Timeout | null = null;

    const handleResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (!isDesktopOrLaptop()) {
          destroyLenis();
        } else if (!lenisRef.current) {
          initSmoothScroll();
        }
      }, 150);
    };

    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      isCancelled = true;

      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }

      if (resizeTimeout) clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
      destroyLenis();
    };
  }, []);
}
