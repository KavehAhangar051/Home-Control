import { cn, disabled } from "@/lib/utils";

export type ButtonVariant =
  | "default"
  | "accent"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "link";

export type ButtonSize =
  | "default"
  | "xs"
  | "sm"
  | "lg"
  | "icon"
  | "icon-xs"
  | "icon-sm"
  | "icon-lg";

const variants: Record<ButtonVariant, string> = {
  default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
  accent:
    "bg-accent3 text-accent3-foreground shadow-xs hover:bg-accent3-dark focus-visible:ring-accent3/40",
  secondary: "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
  outline:
    "border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  destructive:
    "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
  link: "text-primary underline-offset-4 hover:underline",
};

const sizes: Record<ButtonSize, string> = {
  default: "h-9 px-4 py-2 has-[>svg]:ps-3.5 has-[>svg]:pe-4",
  xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:ps-1.5 has-[>svg]:pe-2",
  sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:ps-2.5 has-[>svg]:pe-3",
  lg: "h-10 rounded-md px-6 has-[>svg]:ps-5 has-[>svg]:pe-6",
  icon: "size-9",
  "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
  "icon-sm": "size-8",
  "icon-lg": "size-10",
};

const tapScale = "active:not-disabled:scale-[0.97]";

export interface ButtonVariantsOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  static?: boolean;
  className?: string;
}

export function buttonVariants({
  variant = "default",
  size = "default",
  static: isStatic = false,
  className,
}: ButtonVariantsOptions = {}): string {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[scale,transform,background-color,color,border-color,box-shadow,opacity] duration-150 ease-[var(--ease-out)] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
    disabled,
    !isStatic && variant !== "link" && tapScale,
    variants[variant],
    sizes[size],
    className,
  );
}
