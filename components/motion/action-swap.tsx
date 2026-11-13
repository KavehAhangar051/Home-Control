"use client";

/**
 * @file components/motion/action-swap.tsx
 * @description Motion-animated action swap components for icons, labels, and cycle buttons.
 */

import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useState } from "react";
import { SPRING_PRESS } from "@/lib/ease";
import { cn } from "@/lib/utils";
import type {
  ActionSwapButtonProps,
  ActionSwapIconProps,
  ActionSwapItem,
  ActionSwapTextProps,
} from "./action-swap-types";
import {
  CASCADE_LETTER_VARIANTS,
  CASCADE_STAGGER,
  type CoreAnimation,
  ICON_VARIANTS,
  SIZE_CLASS,
  TEXT_VARIANTS,
  VARIANT_CLASS,
} from "./action-swap-variants";

export type {
  ActionSwapAnimation,
  ActionSwapButtonProps,
  ActionSwapButtonSize,
  ActionSwapButtonVariant,
  ActionSwapIconProps,
  ActionSwapItem,
  ActionSwapTextProps,
} from "./action-swap-types";

function isStringText(val: unknown): val is string {
  return Object.prototype.toString.call(val) === "[object String]";
}

/**
 * Text element with animated transitions for label swaps.
 *
 * @param {ActionSwapTextProps} props - Component properties.
 * @returns {React.JSX.Element} Animated label text.
 */
function ActionSwapText({ value, children, animation = "blur", className }: ActionSwapTextProps) {
  const reduce = useReducedMotion();
  const label = isStringText(children) ? children : null;
  const cascade = animation === "cascade" && label !== null && !reduce;
  const coreAnimation: CoreAnimation = animation === "cascade" ? "roll" : animation;

  const cascadeChars =
    cascade && label
      ? Array.from(label, (char, pos) => ({
          id: `${value}-${pos}-${char}`,
          char,
          delay: pos * CASCADE_STAGGER,
        }))
      : [];

  return (
    <span
      className={cn(
        "relative -my-[0.08em] inline-block max-w-full whitespace-nowrap py-[0.08em] align-bottom",
        className,
      )}
      style={{
        clipPath: "inset(0 -999px)",
        WebkitClipPath: "inset(0 -999px)",
      }}
    >
      <span aria-hidden className="invisible inline-block whitespace-nowrap">
        {cascade
          ? cascadeChars.map((item) => (
              <span key={item.id} className="inline-block whitespace-pre">
                {item.char}
              </span>
            ))
          : children}
      </span>

      {cascade && label && <span className="sr-only">{label}</span>}

      <AnimatePresence initial={false} mode="wait">
        {cascade ? (
          <m.span
            key={`cascade-${value}`}
            aria-hidden
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute start-0 top-[0.08em] inline-flex whitespace-nowrap"
          >
            {cascadeChars.map((item) => (
              <m.span
                key={item.id}
                custom={item.delay}
                variants={CASCADE_LETTER_VARIANTS}
                className="inline-block whitespace-pre"
              >
                {item.char}
              </m.span>
            ))}
          </m.span>
        ) : (
          <m.span
            key={`${coreAnimation}-${value}`}
            variants={TEXT_VARIANTS[coreAnimation]}
            initial={reduce ? false : "initial"}
            animate={reduce ? { opacity: 1, filter: "blur(0px)", scale: 1, y: 0 } : "animate"}
            exit={reduce ? undefined : "exit"}
            className="absolute start-0 top-[0.08em] inline-block max-w-full truncate"
          >
            {children}
          </m.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/**
 * Icon container rendering smooth animated transitions between icon states.
 *
 * @param {ActionSwapIconProps} props - Icon wrapper properties.
 * @returns {React.JSX.Element} Animated icon container.
 */
export function ActionSwapIcon({
  value,
  children,
  animation = "blur",
  className,
}: ActionSwapIconProps) {
  const reduce = useReducedMotion();
  const coreAnimation: CoreAnimation = animation === "cascade" ? "roll" : animation;

  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center overflow-hidden", className)}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <m.span
          key={`${animation}-${value}`}
          aria-hidden
          variants={ICON_VARIANTS[coreAnimation]}
          initial={reduce ? false : "initial"}
          animate={reduce ? { opacity: 1, filter: "blur(0px)", scale: 1, y: 0 } : "animate"}
          exit={reduce ? undefined : "exit"}
          className="col-start-1 row-start-1 inline-flex items-center justify-center"
        >
          {children}
        </m.span>
      </AnimatePresence>
    </span>
  );
}

function getActionSwapAccessibleLabel(
  activeItem: ActionSwapItem,
  iconOnly: boolean,
): string | undefined {
  if (activeItem.ariaLabel) return activeItem.ariaLabel;

  return iconOnly && isStringText(activeItem.label) ? activeItem.label : undefined;
}

/**
 * Interactive button that smoothly cycles through a list of action items.
 *
 * @param {ActionSwapButtonProps} props - Cycle button properties.
 * @returns {React.JSX.Element | null} Animated interactive button.
 */
export function ActionSwapButton({
  items,
  value,
  defaultValue,
  onValueChange,
  variant = "secondary",
  size = "md",
  animation = "blur",
  iconOnly: iconOnlyProp,
  cycle = true,
  className,
  disabled,
  onClick,
  ...rest
}: ActionSwapButtonProps) {
  const iconOnly = iconOnlyProp ?? size === "icon";
  const reduce = useReducedMotion();
  const [internalValue, setInternalValue] = useState(defaultValue ?? items[0]?.id);
  const currentValue = value ?? internalValue;

  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.id === currentValue),
  );

  const activeItem = items[activeIndex] ?? items[0];

  if (!activeItem) return null;

  const hasIcon = items.some((item) => item.icon);
  const nextItem = cycle ? items[(activeIndex + 1) % items.length] : undefined;
  const accessibleLabel = getActionSwapAccessibleLabel(activeItem, iconOnly);
  const tapMotion = reduce || disabled ? undefined : { scale: 0.96 };

  return (
    <m.button
      type="button"
      disabled={disabled}
      whileTap={tapMotion}
      transition={SPRING_PRESS}
      className={cn(
        "inline-flex items-center justify-center overflow-hidden font-medium transition-colors",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        className,
      )}
      aria-label={accessibleLabel}
      onClick={(event) => {
        onClick?.(event);

        if (event.defaultPrevented || disabled || !nextItem) return;

        if (value === undefined) setInternalValue(nextItem.id);
        onValueChange?.(nextItem.id, nextItem);
      }}
      {...rest}
    >
      {hasIcon && (
        <ActionSwapIcon value={activeItem.id} animation={animation} className="h-4 w-4">
          {activeItem.icon ?? null}
        </ActionSwapIcon>
      )}
      {!iconOnly && (
        <ActionSwapText value={activeItem.id} animation={animation}>
          {activeItem.label}
        </ActionSwapText>
      )}
    </m.button>
  );
}
