import type * as React from "react";
import { cn } from "@/lib/utils";

type GridCols =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | "auto-sm"
  | "auto-md"
  | "auto-lg"
  | "container-2"
  | "container-3";

type GridGap = "none" | "sm" | "md" | "lg" | "xl" | "fluid-sm" | "fluid-md" | "fluid-lg";

type ContainerSize = "sm" | "md" | "lg" | "xl" | "2xl" | "full";

const gridColClasses: Record<GridCols, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
  6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
  "auto-sm": "grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))]",
  "auto-md": "grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))]",
  "auto-lg": "grid-cols-[repeat(auto-fit,minmax(min(100%,22rem),1fr))]",
  "container-2": "grid-cols-1 @md:grid-cols-2",
  "container-3": "grid-cols-1 @sm:grid-cols-2 @xl:grid-cols-3",
};

const gridGapClasses: Record<GridGap, string> = {
  none: "gap-0",
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
  xl: "gap-8",
  "fluid-sm": "gap-fluid-sm",
  "fluid-md": "gap-fluid-md",
  "fluid-lg": "gap-fluid-lg",
};

const containerSizeClasses: Record<ContainerSize, string> = {
  sm: "max-w-screen-sm",
  md: "max-w-screen-md",
  lg: "max-w-screen-lg",
  xl: "max-w-screen-xl",
  "2xl": "max-w-screen-2xl",
  full: "max-w-full",
};

export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: GridCols;
  gap?: GridGap;
  ref?: React.Ref<HTMLDivElement>;
}

/** Responsive CSS Grid layout primitive with standardized column, auto-fit, and fluid gap variants. */
export function Grid({ className, cols = 3, gap = "md", ref, ...props }: GridProps) {
  return (
    <div
      ref={ref}
      data-slot="grid"
      className={cn("grid min-w-0", gridColClasses[cols], gridGapClasses[gap], className)}
      {...props}
    />
  );
}

export interface ResponsiveGridProps extends React.HTMLAttributes<HTMLDivElement> {
  minItemWidth?: string;
  gap?: string;
  ref?: React.Ref<HTMLDivElement>;
}

/** Intrinsic auto-fit CSS Grid primitive that wraps items automatically without media queries. */
export function ResponsiveGrid({
  className,
  minItemWidth = "16rem",
  gap = "var(--space-fluid-md)",
  style,
  ref,
  ...props
}: ResponsiveGridProps) {
  return (
    <div
      ref={ref}
      data-slot="responsive-grid"
      className={cn("grid min-w-0", className)}
      style={{
        gridTemplateColumns: `repeat(auto-fit, minmax(min(${minItemWidth}, 100%), 1fr))`,
        gap,
        ...style,
      }}
      {...props}
    />
  );
}

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: ContainerSize;
  ref?: React.Ref<HTMLDivElement>;
}

/** Responsive centered container primitive with @container query context and standardized max-width breakpoints. */
export function Container({ className, size = "xl", ref, ...props }: ContainerProps) {
  return (
    <div
      ref={ref}
      data-slot="container"
      className={cn(
        "@container mx-auto w-full min-w-0 px-fluid-sm sm:px-6 lg:px-8",
        containerSizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}
