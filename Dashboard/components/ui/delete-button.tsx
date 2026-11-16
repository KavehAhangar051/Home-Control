"use client";
// ui.devigner.cc/components/delete-button

import { Loader2 } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import * as React from "react";
import { SPRING_LAYOUT, SPRING_PRESS, SPRING_SWAP } from "@/lib/ease";
import { cn } from "@/lib/utils";

/** Lid pivot, in the glyph's own 24px units. */
const LID_HINGE = "9.244px 7.147px";
const LID_OPEN = -20.57;

/** Offsets the swung lid, both in the glyph's own 24px units, so they scale
 *  with the icon rather than the viewport. Sideways drift off the hinge... */
const LID_RECENTER = -2;

/** ...and clearance over the bin's rim. */
const LID_LIFT = -1.25;

const BIN =
  "M18.834 8.5l-.46 6.9c-.177 2.654-.266 3.981-1.13 4.79-.866.81-2.196.81-4.857.81h-.773c-2.661 0-3.992 0-4.857-.81-.865-.809-.953-2.136-1.13-4.79l-.46-6.9";

const TICKS = "M9.5 11l.5 5M14.5 11l-.5 5";
const CHECK = "M5.5 12.6 9.7 17 18.5 7";
const CLOSE = "M7.7 7.7 16.3 16.3M16.3 7.7 7.7 16.3";

/** Seconds for one glyph to draw on or retract. Linear: a pen moves at a
 *  constant speed, and an ease-out swallows the tail of the stroke. */
const DRAW = 0.32;
const DRAW_EASE = "linear" as const;

/** Overlap between the outgoing and incoming glyph of a swap. */
const HANDOFF = 0.14;

/** Grace period before the spinner fades in, so a fast delete never flashes it. */
const PENDING_DELAY = 0.12;

export type DeleteButtonStatus = "idle" | "armed" | "pending" | "done";

export type DeleteButtonSize = "xs" | "sm" | "default";

const SIZE_METRICS = {
  xs: {
    radius: 11,
    inset: 2,
    shellPadding: "p-0.5",
    tile: "size-6",
    pill: "h-6 gap-1 px-1.5",
    action: "size-5",
    trash: "size-3.5",
    spinner: "size-3.5",
    doneCheck: "size-4",
    actionGlyph: "size-3",
    notch: "h-2.5 w-1.5",
    notchOffset: "-left-1",
    notchOffsetLeft: "-right-1",
  },
  sm: {
    radius: 15,
    inset: 3,
    shellPadding: "p-0.5",
    tile: "size-8",
    pill: "h-8 gap-1.5 px-2",
    action: "size-6",
    trash: "size-4",
    spinner: "size-4",
    doneCheck: "size-4",
    actionGlyph: "size-3.5",
    notch: "h-3 w-1.5",
    notchOffset: "-left-1",
    notchOffsetLeft: "-right-1",
  },
  default: {
    radius: 24,
    inset: 4,
    shellPadding: "p-1",
    tile: "size-12",
    pill: "h-12 gap-2.5 px-3",
    action: "size-8",
    trash: "size-6",
    spinner: "size-5.5",
    doneCheck: "size-6",
    actionGlyph: "size-5",
    notch: "h-4 w-2",
    notchOffset: "-left-1.5",
    notchOffsetLeft: "-right-1.5",
  },
} as const;

const glyph = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

interface UseControllableStateOptions<T> {
  value?: T;
  defaultValue: T;
  onValueChange?: (next: T) => void;
}

function useControllableState<T>({
  value,
  defaultValue,
  onValueChange,
}: UseControllableStateOptions<T>): [T, (next: T) => void] {
  const [internal, setInternal] = React.useState<T>(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : internal;

  const setValue = React.useCallback(
    (next: T) => {
      if (!controlled) setInternal(next);
      onValueChange?.(next);
    },
    [controlled, onValueChange],
  );

  return [current, setValue];
}

interface DrawnPathProps {
  show: boolean;
  d: string;
  reverse?: boolean;
}

function DrawnPath({ show, d, reverse = false }: DrawnPathProps) {
  const reduced = Boolean(useReducedMotion());

  const drawing = {
    duration: DRAW,
    ease: DRAW_EASE,
    delay: show ? HANDOFF : 0,
  };

  return (
    <m.path
      d={d}
      initial={false}
      animate={{
        pathLength: show || reduced ? 1 : 0,
        pathOffset: reverse && !show && !reduced ? 1 : 0,
        opacity: show ? 1 : 0,
      }}
      transition={
        reduced
          ? { duration: 0.15 }
          : {
              pathLength: drawing,
              pathOffset: drawing,
              opacity: { duration: 0, delay: show ? HANDOFF : DRAW },
            }
      }
    />
  );
}

interface TrashGlyphProps {
  show: boolean;
  open: boolean;
  mirror?: boolean;
  className?: string;
}

function TrashGlyph({ show, open, mirror = false, className = "size-6" }: TrashGlyphProps) {
  return (
    <svg
      {...glyph}
      aria-hidden="true"
      // The lid pivots out of the 24-unit box; SVG roots clip by default.
      className={cn(
        "col-start-1 row-start-1 overflow-visible",
        className,
        // The glyph is symmetric, so a flip is the whole mirror: lid opens
        // toward the actions whichever side they sit on.
        mirror && "-scale-x-100",
      )}
      strokeWidth={1.75}
    >
      <DrawnPath show={show} reverse d={BIN} />
      <DrawnPath show={show} d={TICKS} />
      <m.g
        style={{ transformOrigin: LID_HINGE }}
        animate={{
          rotate: open ? LID_OPEN : 0,
          x: open ? LID_RECENTER : 0,
          y: open ? LID_LIFT : 0,
        }}
        transition={SPRING_SWAP}
      >
        <DrawnPath show={show} d="M3.5 6h17" />
        <DrawnPath
          show={show}
          d="M6.5 6h.11a2 2 0 0 0 1.83-1.32l.034-.103.097-.291c.083-.249.125-.373.18-.479a1.5 1.5 0 0 1 1.094-.788C9.962 3 10.093 3 10.355 3h3.29c.262 0 .393 0 .51.019a1.5 1.5 0 0 1 1.094.788c.055.106.097.23.18.479l.097.291A2 2 0 0 0 17.5 6"
        />
      </m.g>
    </svg>
  );
}

interface CheckGlyphProps {
  show?: boolean;
  className?: string;
}

function CheckGlyph({ show = true, className = "size-5" }: CheckGlyphProps) {
  return (
    <svg {...glyph} aria-hidden="true" className={className} strokeWidth={2.5}>
      <DrawnPath show={show} d={CHECK} />
    </svg>
  );
}

const MotionSpinner = m.create(Loader2);

interface SpinnerGlyphProps {
  show: boolean;
  className?: string;
}

function SpinnerGlyph({ show, className = "size-5.5" }: SpinnerGlyphProps) {
  return (
    <MotionSpinner
      aria-hidden
      className={cn("col-start-1 row-start-1", className)}
      strokeWidth={2.5}
      style={{ transformOrigin: "50% 50%" }}
      initial={false}
      animate={{ rotate: show ? 360 : 0, opacity: show ? 1 : 0 }}
      transition={{
        rotate: show ? { duration: 0.9, ease: "linear", repeat: Infinity } : { duration: 0 },
        opacity: { duration: 0.15, delay: show ? PENDING_DELAY : 0 },
      }}
    />
  );
}

interface CloseGlyphProps {
  className?: string;
}

function CloseGlyph({ className = "size-5" }: CloseGlyphProps) {
  return (
    <svg {...glyph} aria-hidden="true" className={className} strokeWidth={2.5}>
      <DrawnPath show d={CLOSE} />
    </svg>
  );
}

/** React's drag, animation, and error handlers collide with Motion's and DeleteButton's own. */
type DivProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration"
  | "onError"
>;

export interface DeleteButtonClassNames {
  root?: string;
  tile?: string;
  confirmation?: string;
}

export interface DeleteButtonSlotProps {
  root?: Pick<React.HTMLAttributes<HTMLDivElement>, "id" | "title">;
}

export interface DeleteConfirmationRenderProps {
  status: DeleteButtonStatus;
}

export interface DeleteButtonProps extends DivProps {
  /** Return a promise and the tile waits on it: spinner, then tick, or back to
   *  the trash if it rejects. */
  onConfirm?: (() => void) | (() => Promise<void>);
  /** Controlled confirmation state. */
  status?: DeleteButtonStatus;
  /** Initial confirmation state when uncontrolled. */
  defaultStatus?: DeleteButtonStatus;
  /** Fires whenever the confirmation state requests a transition. */
  onStatusChange?: (status: DeleteButtonStatus) => void;
  /** Cancel, Escape, or a second press on the tile. */
  onCancel?: () => void;
  /** Handles a rejected `onConfirm`. Without it the rejection is re-thrown. */
  onError?: (error: Error) => void;
  /** Tile's accessible name, open or closed. */
  label?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Announced, and the tile's label, while a returned promise runs. */
  pendingLabel?: string;
  /** Announced, and the tile's label, once the delete has landed. */
  doneLabel?: string;
  /** ms the tick holds before returning to the trash. 0 keeps the tick. */
  resetAfter?: number;
  /** Actions sit right of the trash by default; `left` flips them. Mutually
   *  exclusive, an explicit `right` wins. */
  left?: boolean;
  right?: boolean;
  size?: DeleteButtonSize;
  disabled?: boolean;
  /** Custom content rendered beside the preset confirmation actions. */
  renderConfirmation?: (props: DeleteConfirmationRenderProps) => React.ReactNode;
  classNames?: DeleteButtonClassNames;
  slotProps?: DeleteButtonSlotProps;
}

interface ActionButtonProps extends React.ComponentProps<typeof m.button> {
  label: string;
  delay: number;
  focusOnMount?: boolean;
}

function ActionButton({
  label,
  delay,
  focusOnMount = false,
  className,
  children,
  ...rest
}: ActionButtonProps) {
  const reduced = Boolean(useReducedMotion());
  const scale = reduced ? 1 : 0.9;
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (focusOnMount) {
      buttonRef.current?.focus({ preventScroll: true });
    }
  }, [focusOnMount]);

  return (
    <m.button
      ref={buttonRef}
      type="button"
      aria-label={label}
      initial={{ opacity: 0, scale }}
      animate={{ opacity: 1, scale: 1, transition: { ...SPRING_SWAP, delay } }}
      exit={{ opacity: 0, scale }}
      whileTap={{ scale: 0.97, transition: SPRING_PRESS }}
      transition={SPRING_SWAP}
      className={cn(
        "inline-grid shrink-0 cursor-pointer place-items-center rounded-full bg-background text-foreground shadow-sm ring-1 ring-border/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
      {...rest}
    >
      {children}
    </m.button>
  );
}

async function awaitDeletePromise(
  result: Promise<void>,
  phaseRef: React.RefObject<DeleteButtonStatus>,
  transitionPhase: (next: DeleteButtonStatus) => void,
  onError?: (error: Error) => void,
) {
  try {
    await result;

    if (phaseRef.current === "pending") transitionPhase("done");
  } catch (error) {
    if (phaseRef.current === "pending") transitionPhase("idle");

    if (onError) {
      onError(error instanceof Error ? error : new Error(String(error)));

      return;
    }

    throw error;
  }
}

function runDeleteConfirm({
  onConfirm,
  onError,
  phaseRef,
  transitionPhase,
}: {
  onConfirm?: () => void | Promise<void>;
  onError?: (error: Error) => void;
  phaseRef: React.RefObject<DeleteButtonStatus>;
  transitionPhase: (next: DeleteButtonStatus) => void;
}) {
  let result: void | Promise<void>;

  try {
    result = onConfirm?.();
  } catch (error) {
    transitionPhase("idle");

    if (onError) {
      onError(error instanceof Error ? error : new Error(String(error)));

      return;
    }

    throw error;
  }

  if (!(result instanceof Promise)) {
    transitionPhase("done");

    return;
  }

  transitionPhase("pending");
  void awaitDeletePromise(result, phaseRef, transitionPhase, onError);
}

function getTileToneClass(activePhase: DeleteButtonStatus, armed: boolean): string {
  if (activePhase === "done") return "text-emerald-500";

  return armed ? "text-red-500" : "text-muted-foreground hover:text-red-500";
}

function getTileLabel(
  busy: boolean,
  activePhase: DeleteButtonStatus,
  pendingLabel: string,
  doneLabel: string,
  label: string,
): string {
  if (busy) return pendingLabel;

  return activePhase === "done" ? doneLabel : label;
}

export function DeleteButton({
  onConfirm,
  status,
  defaultStatus = "idle",
  onStatusChange,
  onCancel,
  onError,
  label = "حذف",
  confirmLabel = "تایید حذف",
  cancelLabel = "انصراف",
  pendingLabel = "در حال حذف",
  doneLabel = "حذف شد",
  resetAfter = 1400,
  left = false,
  right = false,
  size = "default",
  disabled = false,
  renderConfirmation,
  classNames,
  slotProps,
  className,
  style,
  ...rest
}: DeleteButtonProps) {
  const [phase, setPhase] = useControllableState({
    value: status,
    defaultValue: defaultStatus,
    onValueChange: onStatusChange,
  });

  const phaseRef = React.useRef(phase);

  React.useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const transitionPhase = React.useCallback(
    (next: DeleteButtonStatus) => {
      phaseRef.current = next;
      setPhase(next);
    },
    [setPhase],
  );

  const metrics = SIZE_METRICS[size];
  const innerRadius = metrics.radius - metrics.inset;
  const onLeft = left && !right;
  const reduced = Boolean(useReducedMotion());
  const tile = React.useRef<HTMLButtonElement>(null);
  const pillId = React.useId();

  // Derive active phase from disabled prop without an extra effect render.
  const activePhase: DeleteButtonStatus = disabled ? "idle" : phase;
  const armed = activePhase === "armed";
  const busy = activePhase === "pending";
  const tileLabel = getTileLabel(busy, activePhase, pendingLabel, doneLabel, label);
  const tileTone = getTileToneClass(activePhase, armed);

  // Closing unmounts whatever inside the pill had focus; take it back or it
  // lands on <body>.
  const close = () => {
    transitionPhase("idle");
    tile.current?.focus({ preventScroll: true });
    onCancel?.();
  };

  const transitionPhaseRef = React.useRef(transitionPhase);

  React.useEffect(() => {
    transitionPhaseRef.current = transitionPhase;
  }, [transitionPhase]);

  // The cleanup stops a stale timer closing a pill that was just reopened.
  React.useEffect(() => {
    if (activePhase !== "done" || resetAfter <= 0) return;

    const id = setTimeout(() => transitionPhaseRef.current("idle"), resetAfter);

    return () => clearTimeout(id);
  }, [activePhase, resetAfter]);

  return (
    <m.div
      {...slotProps?.root}
      dir="ltr"
      layout={!reduced}
      transition={SPRING_LAYOUT}
      data-status={activePhase}
      className={cn(
        "relative inline-flex w-fit items-center bg-background text-foreground shadow-sm ring-1 ring-border/80",
        metrics.shellPadding,
        onLeft && "flex-row-reverse",
        disabled && "pointer-events-none opacity-60",
        classNames?.root,
        className,
      )}
      style={{ borderRadius: metrics.radius, ...style }}
      {...rest}
      onKeyDown={(e) => {
        rest.onKeyDown?.(e);

        if (e.key !== "Escape" || !armed) return;
        e.stopPropagation();
        close();
      }}
    >
      <span aria-live="polite" className="sr-only">
        {busy ? pendingLabel : phase === "done" ? doneLabel : ""}
      </span>
      <m.button
        ref={tile}
        type="button"
        layout={!reduced}
        transition={SPRING_LAYOUT}
        aria-label={tileLabel}
        aria-expanded={armed}
        aria-controls={armed ? pillId : undefined}
        aria-busy={busy}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();

          if (disabled || busy || activePhase === "done") return;

          if (armed) return close();
          transitionPhase("armed");
        }}
        whileTap={{ scale: 0.94, transition: SPRING_PRESS }}
        style={{ borderRadius: innerRadius }}
        className={cn(
          "relative grid shrink-0 cursor-pointer place-items-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          metrics.tile,
          tileTone,
          classNames?.tile,
        )}
      >
        <TrashGlyph
          show={activePhase === "idle" || armed}
          open={armed && !reduced}
          mirror={onLeft}
          className={metrics.trash}
        />
        <SpinnerGlyph show={busy} className={metrics.spinner} />
        <CheckGlyph
          show={activePhase === "done"}
          className={cn("col-start-1 row-start-1", metrics.doneCheck)}
        />
      </m.button>

      <AnimatePresence mode="popLayout">
        {armed && (
          <m.div
            key="actions"
            id={pillId}
            layout={!reduced}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={SPRING_SWAP}
            style={{ borderRadius: innerRadius }}
            className={cn(
              "relative flex items-center bg-secondary",
              metrics.pill,
              onLeft && "flex-row-reverse",
              classNames?.confirmation,
            )}
          >
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute top-1/2 -translate-y-1/2 bg-secondary",
                metrics.notch,
                onLeft
                  ? cn(metrics.notchOffsetLeft, "[clip-path:polygon(0_0,100%_50%,0_100%)]")
                  : cn(metrics.notchOffset, "[clip-path:polygon(100%_0,0_50%,100%_100%)]"),
              )}
            />
            {renderConfirmation?.({ status: activePhase })}
            <ActionButton
              label={confirmLabel}
              delay={0}
              onClick={(e) => {
                e.stopPropagation();

                if (activePhase !== "armed") return;
                // Confirming unmounts the pill along with this button; the
                // tile has to claim focus first or it lands on <body>.
                tile.current?.focus({ preventScroll: true });

                runDeleteConfirm({ onConfirm, onError, phaseRef, transitionPhase });
              }}
              className={cn(metrics.action, "text-red-500")}
            >
              <CheckGlyph className={metrics.actionGlyph} />
            </ActionButton>
            <ActionButton
              label={cancelLabel}
              delay={reduced ? 0 : 0.07}
              focusOnMount
              onClick={(e) => {
                e.stopPropagation();

                if (activePhase !== "armed") return;
                close();
              }}
              className={metrics.action}
            >
              <CloseGlyph className={metrics.actionGlyph} />
            </ActionButton>
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  );
}
