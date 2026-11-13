"use client";

import { AnimatePresence, m } from "motion/react";
import { useEffect, useState } from "react";
import { ArrowUp } from "@/components/ui/hugeicons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";

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
                  y: 12,
                  transition: { duration: 0.15, ease: "easeOut" },
                }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.96 }}
                onClick={scrollToTop}
                className="fixed bottom-6 right-6 z-50 p-3 rounded-full bg-[var(--accent3)] text-[var(--bg-main)] shadow-lg shadow-[var(--accent3-transparent)] hover:shadow-xl hover:shadow-[var(--accent3-medium)] transition-shadow duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--bg-main)] focus:ring-[var(--accent3)] group"
                aria-label="بازگشت به بالا"
              >
                <ArrowUp
                  strokeWidth={2}
                  className="w-6 h-6 group-hover:-translate-y-0.5 transition-transform duration-200 ease-out"
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
