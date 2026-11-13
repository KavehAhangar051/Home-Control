"use client";

import type React from "react";
import { forwardRef } from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";

export interface CursorSvgProps {
  innerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Visual SVG representation of the custom pointer with 3D tilt, rotation, and spring scaling.
 * Adapts automatically between dark mode (white pointer) and light mode (black pointer).
 */
export const CursorSvg = forwardRef<HTMLDivElement, CursorSvgProps>(function CursorSvg(
  { innerRef },
  ref,
) {
  const isDark = useIoTStore((s) => s.isDark);

  return (
    <div
      ref={ref}
      className="fixed top-0 left-0 pointer-events-none z-[9999] hidden sm:block opacity-0 [backface-visibility:hidden]"
      style={{
        transform: "translate3d(-100px, -100px, 0)",
        transition: "opacity 0.16s cubic-bezier(0.16, 1, 0.3, 1)",
        viewTransitionName: "custom-cursor",
      }}
      aria-hidden="true"
    >
      <div
        ref={innerRef}
        className="[backface-visibility:hidden]"
        style={{
          transformOrigin: "9px 2.86px",
          marginLeft: "-9px",
          marginTop: "-2.86px",
          transition: "transform 0.16s cubic-bezier(0.16, 1, 0.3, 1)",
          transform: "perspective(600px) rotateX(0deg) rotateY(0deg) rotateZ(0deg) scale(1)",
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 28 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={
            isDark
              ? "drop-shadow-[0_4px_12px_rgba(0,0,0,0.65)]"
              : "drop-shadow-[0_3px_8px_rgba(0,0,0,0.22)]"
          }
        >
          <title>Custom Cursor</title>
          <path
            d="M4.093 2.502a1.08 1.08 0 0 1 1.405-1.405l20.407 8.163a1.08 1.08 0 0 1 .032 1.996l-8.547 4.274-4.274 8.547a1.08 1.08 0 0 1-1.996-.032L4.093 2.502Z"
            fill="url(#cursor-gradient)"
            stroke={isDark ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.9)"}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <defs>
            <linearGradient
              id="cursor-gradient"
              x1="2"
              y1="2"
              x2="20"
              y2="20"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor={isDark ? "#ffffff" : "#0a0a0a"} />
              <stop offset="0.65" stopColor={isDark ? "#e5e5e5" : "#171717"} />
              <stop offset="1" stopColor={isDark ? "#a3a3a3" : "#262626"} />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
});
