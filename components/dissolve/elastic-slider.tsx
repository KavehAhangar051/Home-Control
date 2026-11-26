"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { soundManager } from "@/lib/audio";

type SliderSize = "sm" | "md";

type SliderIconProps = {
  color: string;
  size: number;
};

export type ElasticSliderPart =
  | "root"
  | "track"
  | "canvas"
  | "label"
  | "labelInverse"
  | "icon"
  | "value"
  | "valueInverse";

export interface ElasticSliderProps {
  label: string;
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  onValueCommit?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  size?: SliderSize;
  showValue?: boolean;
  formatValue?: (value: number) => string;
  icon?: (props: SliderIconProps) => ReactNode;
  disabled?: boolean;
  className?: string;
  partClassNames?: Partial<Record<ElasticSliderPart, string>>;
}

type DragState = {
  pointerId: number;
  startX: number;
  startValue: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function roundToStep(value: number, min: number, max: number, step: number) {
  const precision = Math.min(
    8,
    Math.max(
      0,
      (String(min).split(".")[1] ?? "").length,
      (String(step).split(".")[1] ?? "").length,
    ),
  );
  const stepped = min + Math.round((value - min) / step) * step;
  return Number(clamp(stepped, min, max).toFixed(precision));
}

function rubberBand(distance: number, limit = 34) {
  const magnitude = Math.abs(distance);
  return Math.sign(distance) * (1 - 1 / (magnitude * 0.055 + 1)) * limit;
}

function RollingValue({ value }: { value: string }) {
  return (
    <span className="dissolve-elastic-value" aria-hidden="true">
      {Array.from(value).map((character, index) => {
        if (!/\d/.test(character)) {
          return <span key={`static-${index}`}>{character}</span>;
        }

        return (
          <span className="dissolve-elastic-digit" key={`digit-${index}`}>
            <span style={{ transform: `translateY(-${Number(character)}em)` }}>
              {Array.from({ length: 10 }, (_, digit) => (
                <span key={digit}>{digit}</span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

export function ElasticSlider({
  label,
  value,
  defaultValue = 50,
  onValueChange,
  onValueCommit,
  min = 0,
  max = 100,
  step = 1,
  size = "md",
  showValue = true,
  formatValue = (current) => String(current),
  icon,
  disabled = false,
  className,
  partClassNames,
}: ElasticSliderProps) {
  const safeMin = Number.isFinite(min) ? min : 0;
  const safeMax = Number.isFinite(max) && max > safeMin ? max : safeMin + 100;
  const safeStep = Number.isFinite(step) && step > 0 ? step : 1;
  const [internalValue, setInternalValue] = useState(() =>
    roundToStep(Number.isFinite(defaultValue) ? defaultValue : safeMin, safeMin, safeMax, safeStep),
  );
  const rawCurrentValue = value ?? internalValue;
  const currentValue = roundToStep(
    Number.isFinite(rawCurrentValue) ? rawCurrentValue : safeMin,
    safeMin,
    safeMax,
    safeStep,
  );
  const percentage = ((currentValue - safeMin) / (safeMax - safeMin)) * 100;
  const formattedValue = formatValue(currentValue);
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const stretchRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const sizeRef = useRef({ width: 1, height: size === "sm" ? 28 : 36 });
  const percentageRef = useRef(percentage);
  percentageRef.current = percentage;
  const colorsRef = useRef({ track: "#444444", fill: "#999999" });
  const valueRef = useRef(currentValue);
  valueRef.current = currentValue;

  const part = (name: SliderPart) => partClassNames?.[name] ?? "";

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const { width, height } = sizeRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const stretch = stretchRef.current;
    const scaleX = 1 + Math.abs(stretch) / Math.max(width, 1) * 0.65;
    const scaleY = 1 - Math.min(0.2, Math.abs(stretch) / 170);
    const anchorRight = stretch < 0;
    context.translate(anchorRight ? width : 0, height / 2);
    context.scale(scaleX, scaleY);
    context.translate(anchorRight ? -width : 0, -height / 2);

    const radius = height / 2;
    const { track: trackColor, fill: fillColor } = colorsRef.current;
    const drawRoundRect = (x: number, y: number, w: number, h: number, r: number) => {
      if (w <= 0) return;
      context.beginPath();
      context.roundRect(x, y, w, h, r);
      context.fill();
    };

    context.fillStyle = trackColor;
    drawRoundRect(0, 0, width, height, radius);
    context.fillStyle = fillColor;
    drawRoundRect(0, 0, width * (percentageRef.current / 100), height, radius);
  }, []);

  const requestDraw = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      draw();
    });
  }, [draw]);

  const emitValue = useCallback(
    (rawValue: number) => {
      const next = roundToStep(rawValue, safeMin, safeMax, safeStep);
      if (next === valueRef.current) return;
      valueRef.current = next;
      if (value === undefined) setInternalValue(next);
      onValueChange?.(next);

      const totalSteps = Math.floor((safeMax - safeMin) / safeStep);
      if (totalSteps <= 20 || next === safeMin || next === safeMax) {
        soundManager.playClick();
        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(4);
      }
    },
    [onValueChange, safeMax, safeMin, safeStep, value],
  );

  const valueFromPointer = useCallback(
    (event: PointerEvent<HTMLDivElement>, drag: DragState) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0) return;

      const rawPercent =
        ((drag.startValue - safeMin) / (safeMax - safeMin)) * 100
        + ((event.clientX - drag.startX) / rect.width) * 100;
      const clampedPercent = clamp(rawPercent, 0, 100);
      const overshoot = ((rawPercent - clampedPercent) / 100) * rect.width;
      stretchRef.current = rubberBand(overshoot);
      emitValue(safeMin + (clampedPercent / 100) * (safeMax - safeMin));
      requestDraw();
    },
    [emitValue, requestDraw, safeMax, safeMin],
  );

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) return;
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;

    const initialPercent = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const initialValue = roundToStep(
      safeMin + initialPercent * (safeMax - safeMin),
      safeMin,
      safeMax,
      safeStep,
    );
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startValue: initialValue,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    emitValue(initialValue);
    stretchRef.current = 0;
    requestDraw();
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    valueFromPointer(event, drag);
  };

  const settleStretch = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    let velocity = 0;
    const animate = () => {
      const displacement = stretchRef.current;
      velocity += -displacement * 0.19 - velocity * 0.28;
      stretchRef.current = Math.abs(displacement + velocity) < 0.12 ? 0 : displacement + velocity;
      draw();
      if (stretchRef.current !== 0) frameRef.current = requestAnimationFrame(animate);
      else frameRef.current = null;
    };
    frameRef.current = requestAnimationFrame(animate);
  }, [draw]);

  const finishPointer = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    onValueCommit?.(valueRef.current);
    settleStretch();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const largeStep = Math.max(safeStep, (safeMax - safeMin) / 10);
    let next: number | null = null;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = currentValue + (event.shiftKey ? largeStep : safeStep);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = currentValue - (event.shiftKey ? largeStep : safeStep);
        break;
      case "PageUp":
        next = currentValue + largeStep;
        break;
      case "PageDown":
        next = currentValue - largeStep;
        break;
      case "Home":
        next = safeMin;
        break;
      case "End":
        next = safeMax;
        break;
      default:
        return;
    }
    event.preventDefault();
    emitValue(clamp(next, safeMin, safeMax));
    onValueCommit?.(roundToStep(clamp(next, safeMin, safeMax), safeMin, safeMax, safeStep));
  };

  useEffect(() => {
    const node = trackRef.current;
    if (!node) return;
    const measure = () => {
      const rect = node.getBoundingClientRect();
      sizeRef.current = { width: rect.width || 1, height: size === "sm" ? 28 : 36 };
      const styles = getComputedStyle(node);
      colorsRef.current = {
        track: styles.getPropertyValue("--dissolve-surface").trim() || styles.getPropertyValue("--border-color").trim() || "#444444",
        fill: styles.getPropertyValue("--dissolve-primary").trim() || styles.getPropertyValue("--accent3").trim() || "#999999",
      };
      draw();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    const themeObserver = new MutationObserver(measure);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });
    return () => {
      observer.disconnect();
      themeObserver.disconnect();
    };
  }, [draw, size]);

  useEffect(() => {
    requestDraw();
  }, [requestDraw, currentValue]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  const fillStyle = { clipPath: `inset(0 ${100 - percentage}% 0 0)` };

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={safeMin}
      aria-valuemax={safeMax}
      aria-valuenow={currentValue}
      aria-valuetext={formattedValue}
      aria-disabled={disabled || undefined}
      data-disabled={disabled || undefined}
      data-size={size}
      dir="ltr"
      className={`dissolve-elastic-slider ${className ?? ""} ${part("root")}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      onKeyDown={handleKeyDown}
      style={{ touchAction: "pan-y" }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={`dissolve-elastic-slider__canvas ${part("canvas")} ${part("track")}`}
      />
      <span className={`dissolve-elastic-slider__label ${part("label")}`}>
        {icon && (
          <span className={part("icon")} aria-hidden="true">
            {icon({ color: "var(--dissolve-foreground)", size: size === "sm" ? 14 : 16 })}
          </span>
        )}
        <span>{label}</span>
      </span>
      <span
        aria-hidden="true"
        className={`dissolve-elastic-slider__label dissolve-elastic-slider__label--inverse ${part("labelInverse")}`}
        style={fillStyle}
      >
        {icon && (
          <span className={part("icon")} aria-hidden="true">
            {icon({ color: "var(--dissolve-primary-foreground)", size: size === "sm" ? 14 : 16 })}
          </span>
        )}
        <span>{label}</span>
      </span>
      {showValue && (
        <>
          <span className={`dissolve-elastic-slider__value ${part("value")}`}>
            <RollingValue value={formattedValue} />
          </span>
          <span
            aria-hidden="true"
            className={`dissolve-elastic-slider__value dissolve-elastic-slider__value--inverse ${part("valueInverse")}`}
            style={fillStyle}
          >
            <RollingValue value={formattedValue} />
          </span>
        </>
      )}
      <span className="sr-only">{label}: {formattedValue}</span>
    </div>
  );
}
