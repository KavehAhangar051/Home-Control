import * as React from "react";
import { cn, disabled } from "@/lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  wrapperClassName?: string;
  ref?: React.Ref<HTMLSelectElement>;
}

/**
 * Accessible form select primitive styled with semantic Tailwind v4 tokens.
 */
export function Select({
  className,
  wrapperClassName,
  error,
  id,
  ref,
  children,
  ...props
}: SelectProps) {
  const generatedId = React.useId();
  const selectId = id ?? generatedId;
  const errorId = `${selectId}-error`;

  return (
    <div className={cn("relative w-full", wrapperClassName)}>
      <select
        id={selectId}
        ref={ref}
        data-slot="select"
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? errorId : props["aria-describedby"]}
        className={cn(
          "flex h-10 w-full cursor-pointer rounded-xl border border-border-color bg-bg-main px-3 py-2 text-sm text-text-primary transition-[border-color,background-color] duration-150 focus-visible:outline-none focus-visible:border-accent3 focus-visible:ring-2 focus-visible:ring-accent3/25",
          disabled,
          error &&
            "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/25",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error && (
        <p id={errorId} className="mt-1.5 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
