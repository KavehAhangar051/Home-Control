import type { InputHTMLAttributes, Ref } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { View } from "@/components/animate-ui/icons/hugeicons/view";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  inputRef?: Ref<HTMLInputElement>;
  showPassword: boolean;
  onTogglePassword: () => void;
}

export function WifiPasswordInput({
  id,
  inputRef,
  showPassword,
  onTogglePassword,
  className,
  ...inputProps
}: Props) {
  return (
    <div className="relative" dir="ltr">
      <Input
        {...inputProps}
        id={id}
        ref={inputRef}
        type={showPassword ? "text" : "password"}
        className={className}
      />
      <TooltipProvider delay={450}>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                onClick={onTogglePassword}
                disabled={inputProps.disabled}
                className="absolute end-0 top-1/2 size-11 -translate-y-1/2 rounded-none bg-transparent p-0 text-text-secondary shadow-none hover:bg-transparent hover:text-text-primary active:scale-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent3"
                aria-label={showPassword ? "مخفی کردن رمز عبور" : "نمایش رمز عبور"}
                aria-controls={id}
                aria-pressed={showPassword}
              >
                <span className="relative inline-flex size-5 items-center justify-center">
                  <View className="size-5" aria-hidden="true" />
                  {!showPassword ? (
                    <span
                      className="absolute h-6 w-px rotate-45 bg-current"
                      aria-hidden="true"
                    />
                  ) : null}
                </span>
              </Button>
            }
          />
          <TooltipContent side="top">
            {showPassword ? "مخفی کردن رمز عبور" : "نمایش رمز عبور"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
