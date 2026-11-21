import * as React from "react";
import { cn, disabled } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  wrapperClassName?: string;
  ref?: React.Ref<HTMLInputElement>;
}

/**
 * Accessible form input primitive styled with semantic Tailwind v4 tokens.
 */
export function Input({
  className,
  wrapperClassName,
  type = "text",
  error,
  id,
  ref,
  ...props
}: InputProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className={cn("relative w-full", wrapperClassName)}>
      <input
        id={inputId}
        ref={ref}
        type={type}
        data-slot="input"
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? errorId : props["aria-describedby"]}
        className={cn(
          "flex h-10 w-full rounded-xl border border-border-color bg-bg-main px-3 py-2 text-sm text-text-primary transition-[border-color,background-color] duration-150 placeholder:text-text-muted focus-visible:outline-none focus-visible:border-accent3 focus-visible:ring-2 focus-visible:ring-accent3/25",
          disabled,
          error &&
            "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/25",
          className,
        )}
        {...props}
      />
      {error && (
        <p id={errorId} className="mt-1.5 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
