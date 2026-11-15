import type * as React from "react";
import { cn } from "@/lib/utils";

type GridCols = 1 | 2 | 3 | 4 | 5 | 6;
type GridGap = "none" | "sm" | "md" | "lg" | "xl";
type ContainerSize = "sm" | "md" | "lg" | "xl" | "2xl" | "full";

const gridColClasses: Record<GridCols, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
  6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
};

const gridGapClasses: Record<GridGap, string> = {
  none: "gap-0",
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
  xl: "gap-8",
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

/** Responsive CSS Grid layout primitive with standardized column and gap variants. */
export function Grid({ className, cols = 3, gap = "md", ref, ...props }: GridProps) {
  return (
    <div
      ref={ref}
      data-slot="grid"
      className={cn("grid", gridColClasses[cols], gridGapClasses[gap], className)}
      {...props}
    />
  );
}

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: ContainerSize;
  ref?: React.Ref<HTMLDivElement>;
}

/** Responsive centered container primitive with standardized max-width breakpoints. */
export function Container({ className, size = "xl", ref, ...props }: ContainerProps) {
  return (
    <div
      ref={ref}
      data-slot="container"
      className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", containerSizeClasses[size], className)}
      {...props}
    />
  );
}
