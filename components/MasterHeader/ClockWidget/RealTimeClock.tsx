import { useEffect, useRef, useState } from "react";
import { Clock } from "@/components/ui/hugeicons";

export default function RealTimeClock({
  time,
  className,
}: {
  time: Date | null;
  className?: string;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [isParentHovered, setIsParentHovered] = useState(false);
  const hasTime = time !== null;

  useEffect(() => {
    if (!hasTime) return;
    const svgEl = svgRef.current;

    if (!svgEl) return;

    const hoverTarget =
      svgEl.closest<HTMLElement>("[data-animate-icon-parent]") ?? svgEl.parentElement;

    if (!hoverTarget) return;

    const handlePointerEnter = (e: PointerEvent) => {
      if (e.pointerType !== "touch") {
        setIsParentHovered(true);
      }
    };

    const handlePointerLeave = () => {
      setIsParentHovered(false);
    };

    hoverTarget.addEventListener("pointerenter", handlePointerEnter, { passive: true });
    hoverTarget.addEventListener("pointerleave", handlePointerLeave, { passive: true });

    return () => {
      hoverTarget.removeEventListener("pointerenter", handlePointerEnter);
      hoverTarget.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [hasTime]);

  if (!time) {
    return <Clock className={className} />;
  }

  const hours = time.getHours();
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();

  const hourRotation = (hours % 12) * 30 + minutes * 0.5 + (isParentHovered ? 30 : 0);
  const minuteRotation = minutes * 6 + seconds * 0.1 + (isParentHovered ? 360 : 0);

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line
        x1="12"
        y1="12"
        x2="12"
        y2="7"
        style={{
          transform: `rotate(${hourRotation}deg)`,
          transformOrigin: "12px 12px",
          transition: "transform 0.55s cubic-bezier(0.2, 0, 0, 1)",
        }}
      />
      <line
        x1="12"
        y1="12"
        x2="12"
        y2="4"
        style={{
          transform: `rotate(${minuteRotation}deg)`,
          transformOrigin: "12px 12px",
          transition: "transform 0.55s cubic-bezier(0.2, 0, 0, 1)",
        }}
      />
    </svg>
  );
}
