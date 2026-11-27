"use client";

import { Eye, EyeOff } from "lucide-react";
import type { ChangeEventHandler, RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface WifiPasswordInputProps {
  id: string;
  name: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  showPassword: boolean;
  onTogglePassword: () => void;
  maxLength?: number;
  autoComplete?: string;
  dir?: "ltr" | "rtl" | "auto";
  placeholder?: string;
  className?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

export function WifiPasswordInput({
  id,
  name,
  inputRef,
  value,
  onChange,
  showPassword,
  onTogglePassword,
  maxLength = 63,
  autoComplete = "new-password",
  dir = "ltr",
  placeholder,
  className,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: WifiPasswordInputProps) {
  return (
    <div className="relative" dir={dir}>
      <Input
        id={id}
        ref={inputRef}
        name={name}
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={onChange}
        maxLength={maxLength}
        autoComplete={autoComplete}
        autoCapitalize="none"
        spellCheck={false}
        dir={dir}
        placeholder={placeholder}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        className={cn("pe-12 font-mono", className)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onTogglePassword}
        aria-label={showPassword ? "پنهان کردن رمز عبور" : "نمایش رمز عبور"}
        aria-pressed={showPassword}
        className="absolute inset-y-0 end-0 my-auto h-11 w-11 rounded-s-none text-text-secondary hover:bg-transparent hover:text-text-primary"
      >
        {showPassword ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
      </Button>
    </div>
  );
}
