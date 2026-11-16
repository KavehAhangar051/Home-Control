import type * as React from "react";
import { cn } from "@/lib/utils";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  ref?: React.Ref<HTMLLabelElement>;
}

/**
 * Accessible form label primitive paired with Input and Peer controls.
 */
export function Label({ className, ref, ...props }: LabelProps) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: Reusable Label primitive accepts htmlFor or wraps control
    <label
      ref={ref}
      data-slot="label"
      className={cn(
        "block text-xs font-semibold leading-none text-text-primary peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className,
      )}
      {...props}
    />
  );
}
