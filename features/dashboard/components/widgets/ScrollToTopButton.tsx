"use client";

import React, { useState, useEffect } from "react";
import { ArrowUp } from "@/components/ui/hugeicons";
import { AnimatePresence, motion } from "motion/react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";

export default function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);
  const activeGroupId = useIoTStore((s) => s.activeGroupId);
  const activeSegmentId = useIoTStore((s) => s.activeSegmentId);
  const isDragging = !!activeGroupId || !!activeSegmentId;

  // Show button when page is scrolled down
  const toggleVisibility = () => {
    if (window.scrollY > 300) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  };

  // Set the top scroll coordinates
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    window.addEventListener("scroll", toggleVisibility, { passive: true });
    return () => {
      window.removeEventListener("scroll", toggleVisibility);
    };
  }, []);

  return (
    <AnimatePresence>
      {isVisible && !isDragging && (
        <motion.button
          initial={{ opacity: 0, scale: 0.9, y: 12, filter: "blur(4px)" }}
          animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
          exit={{
            opacity: 0,
            y: 12,
            filter: "blur(4px)",
            transition: { duration: 0.15, ease: "easeOut" },
          }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.96 }}
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 p-3 rounded-full bg-[var(--accent3)] text-[var(--bg-main)] shadow-lg shadow-[var(--accent3-transparent)] hover:shadow-xl hover:shadow-[var(--accent3-medium)] transition-shadow duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--bg-main)] focus:ring-[var(--accent3)] group"
          aria-label="Scroll to top"
          title="بازگشت به بالا"
        >
          <ArrowUp
            strokeWidth={2}
            className="w-6 h-6 group-hover:-translate-y-0.5 transition-transform duration-200 ease-out"
          />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
