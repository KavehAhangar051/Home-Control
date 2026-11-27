"use client";

import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { clamp, reducedMotion, vibrate } from "./kit";

export type ElasticSliderSize = "sm" | "md" | "lg";

export interface ElasticSliderProps {
  label?: string;
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  onValueCommit?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  size?: ElasticSliderSize;
  formatValue?: (value: number) => string;
  formatValueText?: (value: number) => string;
  icon?: ReactNode | ((props: { color: string; size: number }) => ReactNode);
  showTicks?: boolean;
  showValue?: boolean;
  haptics?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

const SIZE_METRICS: Record<ElasticSliderSize, { height: string; text: string; icon: number }> = {
  sm: { height: "h-8", text: "text-xs", icon: 14 },
  md: { height: "h-10", text: "text-xs sm:text-sm", icon: 16 },
  lg: { height: "h-12", text: "text-sm", icon: 18 },
};

function snapToStep(raw: number, min: number, max: number, step: number): number {
  if (max <= min) return min;
  const safeStep = step > 0 ? step : 1;
  const steps = Math.round((raw - min) / safeStep);
  const precision = Math.max(0, (String(safeStep).split(".")[1] || "").length);
  const snapped = Number((min + steps * safeStep).toFixed(precision));
  return clamp(snapped, min, max);
}

/**
 * Controlled/uncontrolled ElasticSlider value input using --dissolve-* tokens,
 * fill-boundary text inversion, overscroll rubber-band stretch, RTL-aware drag,
 * and full keyboard/ARIA slider semantics.
 */
export function ElasticSlider({
  label,
  value: controlledValue,
  defaultValue = 0,
  onValueChange,
  onValueCommit,
  min = 0,
  max = 100,
  step = 1,
  size = "md",
  formatValue,
  formatValueText,
  icon,
  showTicks = true,
  showValue = true,
  haptics = true,
  disabled = false,
  className,
  "aria-label": ariaLabel,
}: ElasticSliderProps) {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(() =>
    snapToStep(defaultValue, min, max, step),
  );
  const currentValue = isControlled
    ? snapToStep(controlledValue, min, max, step)
    : snapToStep(internalValue, min, max, step);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const activePointerId = useRef<number | null>(null);
  const lastCommittedRef = useRef(currentValue);
  const [stretch, setStretch] = useState({ x: 0, scaleX: 1, scaleY: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [isRtlLayout, setIsRtlLayout] = useState(true);

  useEffect(() => {
    const node = trackRef.current;
    if (!node) return;
    setIsRtlLayout(getComputedStyle(node).direction === "rtl");
  }, []);

  const range = Math.max(1e-6, max - min);
  const ratio = clamp((currentValue - min) / range, 0, 1);
  const pct = ratio * 100;
  const metrics = SIZE_METRICS[size] ?? SIZE_METRICS.md;

  const commitIfNeeded = useCallback(
    (nextVal: number) => {
      if (!isControlled) setInternalValue(nextVal);
      if (nextVal !== lastCommittedRef.current) {
        lastCommittedRef.current = nextVal;
        onValueChange?.(nextVal);
        if (haptics && (nextVal === min || nextVal === max)) {
          vibrate(6);
        }
      }
    },
    [haptics, isControlled, max, min, onValueChange],
  );

  const computeFromClientX = useCallback(
    (clientX: number) => {
      const node = trackRef.current;
      if (!node) return { value: currentValue, overscroll: 0 };

      const rect = node.getBoundingClientRect();
      if (rect.width <= 0) return { value: currentValue, overscroll: 0 };

      const isRtl = getComputedStyle(node).direction === "rtl";
      const rawRatio = isRtl
        ? (rect.right - clientX) / rect.width
        : (clientX - rect.left) / rect.width;

      let overscroll = 0;
      if (rawRatio < 0) overscroll = rawRatio;
      else if (rawRatio > 1) overscroll = rawRatio - 1;

      const clampedRatio = clamp(rawRatio, 0, 1);
      const nextValue = snapToStep(min + clampedRatio * range, min, max, step);

      return { value: nextValue, overscroll: isRtl ? -overscroll : overscroll };
    },
    [currentValue, max, min, range, step],
  );

  const updateStretchFromOverscroll = useCallback((overscroll: number) => {
    if (reducedMotion() || Math.abs(overscroll) < 0.005) {
      setStretch((prev) =>
        prev.x === 0 && prev.scaleX === 1 && prev.scaleY === 1
          ? prev
          : { x: 0, scaleX: 1, scaleY: 1 },
      );
      return;
    }

    const damped = Math.sign(overscroll) * Math.min(10, Math.abs(overscroll) * 28);
    const sx = 1 + Math.min(0.035, Math.abs(overscroll) * 0.12);
    const sy = 1 - Math.min(0.05, Math.abs(overscroll) * 0.15);
    setStretch({ x: damped, scaleX: sx, scaleY: sy });
  }, []);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button > 0) return;
    event.preventDefault();
    const node = trackRef.current;
    node?.focus();
    node?.setPointerCapture?.(event.pointerId);
    activePointerId.current = event.pointerId;
    setIsDragging(true);
    lastCommittedRef.current = currentValue;

    const { value: nextVal, overscroll } = computeFromClientX(event.clientX);
    commitIfNeeded(nextVal);
    updateStretchFromOverscroll(overscroll);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || activePointerId.current !== event.pointerId) return;
    const { value: nextVal, overscroll } = computeFromClientX(event.clientX);
    commitIfNeeded(nextVal);
    updateStretchFromOverscroll(overscroll);
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== event.pointerId) return;
    activePointerId.current = null;
    setIsDragging(false);
    setStretch({ x: 0, scaleX: 1, scaleY: 1 });
    const { value: finalVal } = computeFromClientX(event.clientX);
    commitIfNeeded(finalVal);
    onValueCommit?.(finalVal);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const isRtl = trackRef.current ? getComputedStyle(trackRef.current).direction === "rtl" : false;
    const dir = isRtl ? -1 : 1;
    const bigStep = Math.max(step, (max - min) / 10);

    let nextVal: number | null = null;
    switch (event.key) {
      case "ArrowRight":
        nextVal = snapToStep(currentValue + step * dir, min, max, step);
        break;
      case "ArrowLeft":
        nextVal = snapToStep(currentValue - step * dir, min, max, step);
        break;
      case "ArrowUp":
        nextVal = snapToStep(currentValue + step, min, max, step);
        break;
      case "ArrowDown":
        nextVal = snapToStep(currentValue - step, min, max, step);
        break;
      case "PageUp":
        nextVal = snapToStep(currentValue + bigStep, min, max, step);
        break;
      case "PageDown":
        nextVal = snapToStep(currentValue - bigStep, min, max, step);
        break;
      case "Home":
        nextVal = min;
        break;
      case "End":
        nextVal = max;
        break;
      default:
        return;
    }

    event.preventDefault();
    if (!isControlled) setInternalValue(nextVal);
    if (nextVal !== currentValue) {
      onValueChange?.(nextVal);
    }
    onValueCommit?.(nextVal);
  };

  useEffect(() => {
    lastCommittedRef.current = currentValue;
  }, [currentValue]);

  const formattedValue = formatValue ? formatValue(currentValue) : String(currentValue);
  const valueText = formatValueText ? formatValueText(currentValue) : formattedValue;

  const renderIcon = (color: string) => {
    if (!icon) return null;
    if (typeof icon === "function") {
      return icon({ color, size: metrics.icon });
    }
    return icon;
  };

  const renderContent = (inverted: boolean) => {
    const color = inverted
      ? "var(--dissolve-primary-foreground, var(--accent3-foreground))"
      : "var(--dissolve-foreground, var(--text-primary))";

    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-between gap-2 px-3 select-none",
          metrics.text,
        )}
        style={{ color }}
      >
        <span className="flex min-w-0 items-center gap-2 font-medium">
          {icon && <span className="shrink-0">{renderIcon(color)}</span>}
          {label && <span className="truncate">{label}</span>}
        </span>
        {showValue && (
          <span className="shrink-0 font-mono font-semibold tabular-nums" dir="ltr">
            {formattedValue}
          </span>
        )}
      </div>
    );
  };

  const tickSteps = showTicks ? [25, 50, 75] : [];

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel ?? label ?? "اسلایدر"}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={currentValue}
      aria-valuetext={valueText}
      aria-disabled={disabled || undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative w-full overflow-hidden rounded-xl border select-none touch-pan-y cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset",
        metrics.height,
        disabled && "pointer-events-none opacity-50",
        !isDragging && "transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
        className,
      )}
      style={{
        backgroundColor: "var(--dissolve-surface, var(--secondary))",
        borderColor: "var(--dissolve-border, var(--border-color))",
        transform: `translate3d(${stretch.x}px, 0, 0) scale(${stretch.scaleX}, ${stretch.scaleY})`,
      }}
    >
      {tickSteps.map((pos) => (
        <span
          key={pos}
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 size-1 -translate-y-1/2 rounded-full bg-text-muted/35"
          style={{ insetInlineStart: `${pos}%` }}
        />
      ))}

      {/* Base foreground text */}
      <div className="pointer-events-none relative z-10 h-full w-full">{renderContent(false)}</div>

      {/* Filled bar + fill-boundary inverted text */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 z-20 overflow-hidden",
          !isDragging && "transition-[clip-path] duration-150 ease-out",
        )}
        style={{
          backgroundColor: "var(--dissolve-primary, var(--accent3))",
          clipPath: isRtlLayout ? `inset(0 0 0 ${100 - pct}%)` : `inset(0 ${100 - pct}% 0 0)`,
        }}
      >
        <div className="h-full w-full" style={{ direction: "inherit" }}>
          {renderContent(true)}
        </div>
      </div>
    </div>
  );
}
