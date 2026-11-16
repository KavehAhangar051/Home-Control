"use client";

import { AnimatePresence, m } from "motion/react";
import { useEffect, useState } from "react";
import { ArrowUp } from "@/components/ui/hugeicons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { DURATION, EASE_IN, EASE_OUT, EXIT_DURATION } from "@/lib/ease";

export default function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);
  const activeGroupId = useIoTStore((s) => s.activeGroupId);
  const activeSegmentId = useIoTStore((s) => s.activeSegmentId);
  const isDragging = !!activeGroupId || !!activeSegmentId;

  // Set the top scroll coordinates
  const scrollToTop = () => {
    const scrollContainer = document.getElementById("dashboard-workspace-scroll");

    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    let rafId: number | null = null;
    const scrollContainer = document.getElementById("dashboard-workspace-scroll");

    const checkScroll = () => {
      rafId = null;
      const scrollTop = scrollContainer ? scrollContainer.scrollTop : window.scrollY;
      const shouldShow = scrollTop > 300;
      setIsVisible((prev) => (prev === shouldShow ? prev : shouldShow));
    };

    const toggleVisibility = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(checkScroll);
    };

    window.addEventListener("scroll", toggleVisibility, { passive: true });
    scrollContainer?.addEventListener("scroll", toggleVisibility, { passive: true });

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", toggleVisibility);
      scrollContainer?.removeEventListener("scroll", toggleVisibility);
    };
  }, []);

  return (
    <AnimatePresence>
      {isVisible && !isDragging && (
        <Tooltip>
          <TooltipTrigger
            render={
              <m.button
                initial={{ opacity: 0, scale: 0.9, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{
                  opacity: 0,
                  scale: 0.92,
                  y: 12,
                  transition: { duration: EXIT_DURATION.standard, ease: EASE_IN },
                }}
                transition={{ duration: DURATION.standard, ease: EASE_OUT }}
                whileTap={{ scale: 0.96 }}
                onClick={scrollToTop}
                className="fixed bottom-6 right-6 z-50 p-3 rounded-xl border border-border-color bg-card-hover-bg text-text-secondary hover:text-text-primary hover:bg-accent transition-[background-color,color,border-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] focus-ring group"
                aria-label="بازگشت به بالا"
              >
                <ArrowUp
                  strokeWidth={1.5}
                  className="size-5 group-hover:-translate-y-0.5 transition-transform duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]"
                />
              </m.button>
            }
          />
          <TooltipContent>بازگشت به بالا</TooltipContent>
        </Tooltip>
      )}
    </AnimatePresence>
  );
}
