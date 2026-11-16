import type * as React from "react";
import { type ButtonSize, type ButtonVariant, buttonVariants } from "./button-variants";

export type { ButtonSize, ButtonVariant, ButtonVariantsOptions } from "./button-variants";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  static?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}

export function Button({
  className,
  variant = "default",
  size = "default",
  static: isStatic = false,
  type = "button",
  ref,
  ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      type={type}
      className={buttonVariants({ variant, size, static: isStatic, className })}
      {...props}
    />
  );
}

Button.displayName = "Button";
