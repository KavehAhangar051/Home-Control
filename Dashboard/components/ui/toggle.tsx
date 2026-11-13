"use client";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { cn } from "@/lib/utils";
import {
  type ToggleSize,
  type ToggleVariant,
  type ToggleVariantsProps,
  toggleVariants,
} from "./toggle-variants";

export type { ToggleSize, ToggleVariant, ToggleVariantsProps };

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: Omit<TogglePrimitive.Props, "className"> & ToggleVariantsProps) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle };
