"use client";

/**
 * @file components/motion/expandable-tabs.tsx
 * @description Icon dock/tab bar where the active tab expands into a labelled pill and an upward
 * spring-morphing panel reveals contextual actions. Adapted from beui.dev Expandable Tabs + Dock
 * for RTL, LazyMotion (`m.*`), lite-tier performance stepping, and viewport clamping.
 */

import { AnimatePresence, m, type PanInfo, useReducedMotion, type Variants } from "motion/react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { EASE_OUT, SPRING_LAYOUT } from "@/lib/ease";
import { triggerHaptic } from "@/lib/haptics";
import { useMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  type BoxSize,
  computeActiveTabWidth,
  computeClosedShellSize,
  computeMaxActiveTabWidth,
  computeTargetShellSize,
  EXPANDABLE_TABS_METRICS,
} from "./expandable-tabs-layout";

export const expandableTabsMessages = {
  label: "نوار ناوبری سریع",
};

export type ExpandableTabsMessages = typeof expandableTabsMessages;

export type ExpandableTabsItem = {
  id: string;
  /** String label — shown inside the active tab pill and used as the accessible name. */
  label: string;
  icon: ReactNode;
  /** Panel shown above the dock bar when this tab is open. */
  content: ReactNode;
};

export type ExpandableTabsClassNames = {
  root?: string;
  panel?: string;
  bar?: string;
  tab?: string;
  activeTab?: string;
  icon?: string;
  label?: string;
  pill?: string;
};

export interface ExpandableTabsProps {
  items: ExpandableTabsItem[];
  /** Currently open panel tab id, or null for the closed (bar-only) Dock state. */
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (id: string | null) => void;
  /**
   * Optional custom click interceptor for tabs (e.g., direct navigation when tapping Home
   * from another section before opening its quick panel).
   */
  onTabClick?: (id: string) => void;
  /**
   * Currently active route/section id highlighted with a gliding Dock pill when all panels are closed.
   */
  activeNavId?: string | null;
  /** Optional trailing Dock controls (e.g. DockSeparator + Voice Command button) inside the bar. */
  trailing?: ReactNode;
  dir?: "rtl" | "ltr";
  className?: string;
  classNames?: ExpandableTabsClassNames;
  labels?: Partial<ExpandableTabsMessages>;
}

const SHELL_SPRING = { type: "spring", duration: 0.5, bounce: 0.06 } as const;
const TAB_CHANGE_SPRING = { type: "spring", duration: 0.42, bounce: 0.04 } as const;
const LABEL_OPEN = { type: "spring", duration: 0.34, bounce: 0.03 } as const;
const LABEL_CLOSE = { duration: 0.14, ease: EASE_OUT } as const;
const CONTENT_SPRING = { type: "spring", duration: 0.42, bounce: 0.06 } as const;

const CONTENT_VARIANTS: Variants = {
  enter: { y: -8, scale: 0.98, opacity: 0 },
  center: { y: 0, scale: 1, opacity: 1 },
  exit: {
    y: -6,
    scale: 0.98,
    opacity: 0,
    transition: { duration: 0.08, ease: EASE_OUT },
  },
};

const REDUCED_CONTENT_VARIANTS: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: {
    opacity: 0,
    transition: { duration: 0.08, ease: EASE_OUT },
  },
};

function sameSize(a: BoxSize | null | undefined, b: BoxSize | null | undefined): boolean {
  return a?.width === b?.width && a?.height === b?.height;
}

function sameWidths(a: Record<string, number>, b: Record<string, number>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  if (aKeys.length !== bKeys.length) return false;

  return aKeys.every((key) => a[key] === b[key]);
}

function useElementSize(activeKey: string | null) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<BoxSize | null>(null);

  const measure = useCallback(() => {
    const el = ref.current;

    if (!el) return;

    const next = { width: Math.ceil(el.offsetWidth), height: Math.ceil(el.offsetHeight) };
    setSize((current) => (sameSize(current, next) ? current : next));
  }, []);

  useLayoutEffect(() => {
    void activeKey;
    measure();
  }, [activeKey, measure]);

  useEffect(() => {
    const el = ref.current;

    if (!el || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(measure);
    observer.observe(el);

    return () => observer.disconnect();
  }, [measure]);

  return [ref, size] as const;
}

function useElementWidth() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  const measure = useCallback(() => {
    const el = ref.current;
    const next = el ? Math.ceil(el.offsetWidth) : 0;
    setWidth((current) => (current === next ? current : next));
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const el = ref.current;

    if (!el || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(measure);
    observer.observe(el);

    return () => observer.disconnect();
  }, [measure]);

  return [ref, width] as const;
}

function useLabelWidths(items: ExpandableTabsItem[]) {
  const refs = useRef<Record<string, HTMLSpanElement | null>>({});
  const [widths, setWidths] = useState<Record<string, number>>({});

  const setLabelMeasureRef = useCallback(
    (id: string) => (node: HTMLSpanElement | null) => {
      refs.current[id] = node;
    },
    [],
  );

  const measure = useCallback(() => {
    const next: Record<string, number> = {};

    for (const item of items) {
      const node = refs.current[item.id];

      if (node) {
        next[item.id] = Math.ceil(node.offsetWidth);
      }
    }

    setWidths((current) => (sameWidths(current, next) ? current : next));
  }, [items]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(measure);

    for (const item of items) {
      const node = refs.current[item.id];

      if (node) {
        observer.observe(node);
      }
    }

    return () => observer.disconnect();
  }, [items, measure]);

  return { setLabelMeasureRef, widths };
}

function useViewportWidth(): number | null {
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update, { passive: true });

    return () => window.removeEventListener("resize", update);
  }, []);

  return width;
}

/**
 * Floating Dock + Expandable Tabs navigation surface.
 */
export function ExpandableTabs({
  items,
  value,
  defaultValue = null,
  onValueChange,
  onTabClick,
  activeNavId = null,
  trailing,
  dir = "rtl",
  className,
  classNames,
  labels,
}: ExpandableTabsProps) {
  const t = useMessages("expandableTabs", expandableTabsMessages, labels);
  const reduce = useReducedMotion();
  const pillLayoutId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportWidth = useViewportWidth();
  const [trailingRef, trailingWidth] = useElementWidth();
  const { setLabelMeasureRef, widths: labelWidths } = useLabelWidths(items);

  const controlled = value !== undefined;
  const [internal, setInternal] = useState<string | null>(defaultValue);
  const activeId = controlled ? value : internal;
  const active = items.find((item) => item.id === activeId) ?? null;
  const visualOpenId = active?.id ?? null;

  const [sizerRef, openContentSize] = useElementSize(visualOpenId);

  const setActive = useCallback(
    (next: string | null) => {
      if (!controlled) setInternal(next);
      onValueChange?.(next);
    },
    [controlled, onValueChange],
  );

  const onDismissPanel = useEffectEvent(() => {
    setActive(null);
  });

  // Outside pointer tap or Escape closes the open panel back down to the Dock bar.
  useEffect(() => {
    if (!visualOpenId) return;

    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        onDismissPanel();
      }
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onDismissPanel();
      }
    };

    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [visualOpenId]);

  const handlePanelDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (info.offset.y > 40 || info.velocity.y > 260) {
        triggerHaptic("tap");
        setActive(null);
      }
    },
    [setActive],
  );

  const { barHeight, tabWidth, panelDockGap, activePaddingStart, iconWidth, activePaddingEnd } =
    EXPANDABLE_TABS_METRICS;
  const effectiveTrailingWidth = trailing ? trailingWidth : 0;
  const closedSize = computeClosedShellSize(items.length, effectiveTrailingWidth);
  const openLabelWidth = visualOpenId ? (labelWidths[visualOpenId] ?? 0) : 0;
  const openDesiredTabWidth = visualOpenId ? computeActiveTabWidth(openLabelWidth) : tabWidth;

  const targetSize = computeTargetShellSize({
    isOpen: Boolean(active),
    contentSize: openContentSize,
    closedSize,
    activeTabWidth: openDesiredTabWidth,
    maxViewportWidth: viewportWidth,
  });

  const maxActiveTabWidth = computeMaxActiveTabWidth({
    shellWidth: targetSize.width,
    itemCount: items.length,
    trailingWidth: effectiveTrailingWidth,
  });

  const contentVariants = reduce ? REDUCED_CONTENT_VARIANTS : CONTENT_VARIANTS;

  return (
    <>
      <m.div
        ref={rootRef}
        dir={dir}
        initial={false}
        animate={{ width: targetSize.width, height: targetSize.height }}
        transition={reduce ? { duration: 0 } : SHELL_SPRING}
        style={{
          transformOrigin: "bottom center",
          willChange: "transform, width, height",
          backfaceVisibility: "hidden",
          contain: "layout style",
        }}
        className={cn(
          "relative max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-[26px] border border-border-color bg-card-bg-solid/95 shadow-2xl backdrop-blur-xl transform-gpu",
          className,
          classNames?.root,
        )}
      >
        {/* Invisible active-panel sizer drives smooth per-tab height & width morphing */}
        <div
          ref={sizerRef}
          aria-hidden="true"
          className={cn(
            "pointer-events-none invisible absolute start-0 top-0 w-max max-w-[calc(100vw-1.5rem-2px)] px-2.5 pt-2",
            classNames?.panel,
          )}
          style={{ paddingBottom: barHeight + panelDockGap }}
        >
          {active ? (
            <div className="w-max max-w-full">
              <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-border-color/80" />
              {active.content}
            </div>
          ) : null}
        </div>

        {/* Animated content viewport clipped cleanly above the bottom dock bar */}
        <div
          className={cn(
            "absolute inset-x-0 top-0 z-10 overflow-hidden px-2.5 pt-2",
            classNames?.panel,
          )}
          style={{ bottom: barHeight + panelDockGap }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {active ? (
              <m.div
                key={active.id}
                drag={reduce ? false : "y"}
                dragDirectionLock
                dragConstraints={{ top: 0, bottom: 110 }}
                dragElastic={{ top: 0.05, bottom: 0.25 }}
                dragSnapToOrigin
                onDragEnd={handlePanelDragEnd}
                variants={contentVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={reduce ? { duration: 0.14, ease: EASE_OUT } : CONTENT_SPRING}
                className="w-full touch-pan-x"
                style={{
                  transformOrigin: "top center",
                  willChange: "transform, opacity",
                  backfaceVisibility: "hidden",
                }}
              >
                <div
                  aria-hidden="true"
                  className="mx-auto mb-2 h-1 w-9 cursor-grab rounded-full bg-border-color/80 active:cursor-grabbing"
                />
                {active.content}
              </m.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Bottom Dock Tab Bar */}
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 z-20 flex w-full items-center justify-between gap-1 px-2 py-1.5 transition-colors duration-150",
            active && "border-t border-border-color/60",
            classNames?.bar,
          )}
          style={{ height: barHeight }}
        >
          <div
            role="tablist"
            aria-label={t("label")}
            aria-orientation="horizontal"
            className="flex min-w-0 flex-1 items-center justify-between gap-1"
          >
            {items.map((item) => {
              const isOpenTab = item.id === visualOpenId;
              const isCurrentRoute = !visualOpenId && item.id === activeNavId;
              const showPill = isOpenTab || isCurrentRoute;
              const labelWidth = labelWidths[item.id] ?? 0;
              const activeTabWidth = Math.min(computeActiveTabWidth(labelWidth), maxActiveTabWidth);
              const fittedLabelWidth = Math.max(
                0,
                Math.min(
                  labelWidth,
                  activeTabWidth - activePaddingStart - iconWidth - activePaddingEnd,
                ),
              );

              return (
                <m.button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={isOpenTab}
                  aria-current={item.id === activeNavId ? "page" : undefined}
                  aria-label={item.label}
                  onClick={() => {
                    if (onTabClick) {
                      onTabClick(item.id);

                      return;
                    }

                    setActive(isOpenTab ? null : item.id);
                  }}
                  layout={reduce ? false : "position"}
                  animate={{
                    width: isOpenTab ? activeTabWidth : tabWidth,
                  }}
                  transition={reduce ? { duration: 0 } : TAB_CHANGE_SPRING}
                  className={cn(
                    "relative isolate flex h-10 min-w-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[18px] px-2 text-xs font-medium outline-none select-none",
                    "focus-visible:ring-2 focus-visible:ring-accent3 focus-visible:ring-offset-1 focus-visible:ring-offset-card-bg-solid",
                    isOpenTab && "min-w-0 justify-start ps-3 pe-3.5",
                    showPill ? "text-text-primary" : "text-text-muted hover:text-text-primary",
                    classNames?.tab,
                    showPill && classNames?.activeTab,
                  )}
                >
                  {showPill ? (
                    <m.span
                      layoutId={pillLayoutId}
                      transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
                      style={{ willChange: "transform", backfaceVisibility: "hidden" }}
                      className={cn(
                        "absolute inset-0 -z-10 rounded-[18px] border border-sidebar-border/80 bg-sidebar-hover dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
                        classNames?.pill,
                      )}
                    />
                  ) : null}

                  <span
                    className={cn(
                      "grid shrink-0 place-items-center transition-colors duration-150",
                      item.id === activeNavId ? "text-accent3" : "text-current",
                      classNames?.icon,
                    )}
                  >
                    {item.icon}
                  </span>

                  <m.span
                    aria-hidden="true"
                    initial={false}
                    animate={{
                      width: isOpenTab ? fittedLabelWidth : 0,
                      opacity: isOpenTab ? 1 : 0,
                    }}
                    transition={reduce ? { duration: 0 } : isOpenTab ? LABEL_OPEN : LABEL_CLOSE}
                    className={cn(
                      "inline-block overflow-hidden whitespace-nowrap text-start",
                      classNames?.label,
                    )}
                  >
                    <span className="inline-block max-w-full truncate ps-1.5">{item.label}</span>
                  </m.span>
                </m.button>
              );
            })}
          </div>

          {trailing ? (
            <div ref={trailingRef} className="flex shrink-0 items-center gap-1">
              {trailing}
            </div>
          ) : null}
        </div>
      </m.div>

      {/* Off-screen measurement spans for exact Persian label pixel widths */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed start-0 top-0 -z-10 flex opacity-0"
      >
        {items.map((item) => (
          <span
            key={item.id}
            ref={setLabelMeasureRef(item.id)}
            className={cn(
              "inline-block whitespace-nowrap ps-1.5 text-xs font-medium leading-none",
              classNames?.label,
            )}
          >
            {item.label}
          </span>
        ))}
      </div>
    </>
  );
}
