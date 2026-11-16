import { cn } from "@/lib/utils";

export type ToggleVariant = "default" | "outline";

export type ToggleSize = "default" | "sm" | "lg";

const toggleVariantMap: Record<ToggleVariant, string> = {
  default: "bg-transparent",
  outline: "border border-input bg-transparent hover:bg-muted",
};

const toggleSizeMap: Record<ToggleSize, string> = {
  default: "h-8 min-w-8 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
  sm: "h-7 min-w-7 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
  lg: "h-9 min-w-9 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
};

export interface ToggleVariantsProps {
  variant?: ToggleVariant;
  size?: ToggleSize;
  className?: string;
}

export function toggleVariants({
  variant = "default",
  size = "default",
  className,
}: ToggleVariantsProps = {}) {
  return cn(
    "group/toggle inline-flex items-center justify-center gap-1 rounded-lg text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow] outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-pressed:bg-muted data-[state=on]:bg-muted dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    toggleVariantMap[variant],
    toggleSizeMap[size],
    className,
  );
}
