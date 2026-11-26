import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Save } from "@/components/ui/hugeicons-groups/controls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WifiCredentialErrors } from "./wifiValidation";

interface Props {
  ssid: string;
  password: string;
  ssidByteLength: number;
  passwordByteLength: number;
  showPassword: boolean;
  hasAttemptedSave: boolean;
  isSaving: boolean;
  errors: WifiCredentialErrors;
  onSsidChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
  onResetToDefault: () => void;
  onCancel: () => void;
  onSave: () => void;
}

export function WifiAccessPointEditor({
  ssid,
  password,
  ssidByteLength,
  passwordByteLength,
  showPassword,
  hasAttemptedSave,
  isSaving,
  errors,
  onSsidChange,
  onPasswordChange,
  onTogglePassword,
  onResetToDefault,
  onCancel,
  onSave,
}: Props) {
  const ssidInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const ssidError = hasAttemptedSave ? errors.ssid : undefined;
  const passwordError = hasAttemptedSave ? errors.password : undefined;

  useEffect(() => {
    if (!hasAttemptedSave) return;

    if (errors.ssid) {
      ssidInputRef.current?.focus();
    } else if (errors.password) {
      passwordInputRef.current?.focus();
    }
  }, [errors.ssid, errors.password, hasAttemptedSave]);

  return (
    <div className="@container space-y-4">
      <div className="grid grid-cols-1 gap-x-6 gap-y-5 @lg:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <div className="flex min-h-11 items-center justify-between gap-3">
            <Label htmlFor="esp-ap-ssid" className="min-w-0 text-sm font-bold">
              نام شبکه (SSID)
            </Label>
            <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-text-secondary">
              {ssidByteLength}/۳۲ بایت
            </span>
          </div>
          <Input
            id="esp-ap-ssid"
            ref={ssidInputRef}
            name="esp-ap-ssid"
            type="text"
            dir="auto"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            disabled={isSaving}
            value={ssid}
            onChange={(event) => onSsidChange(event.target.value)}
            placeholder="Achaemenid-XXXXXX"
            className="h-11 bg-card-bg-solid text-base sm:text-sm"
            aria-invalid={Boolean(ssidError) || undefined}
            aria-describedby={ssidError ? "esp-ap-ssid-error" : "esp-ap-ssid-help"}
          />
          <div className="min-h-10 pt-1">
            {ssidError ? (
              <p id="esp-ap-ssid-error" className="text-xs leading-5 text-destructive" role="alert">
                {ssidError}
              </p>
            ) : (
              <p id="esp-ap-ssid-help" className="text-xs leading-5 text-text-secondary">
                حداکثر ۳۲ بایت UTF-8.
              </p>
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-2">
          <div className="flex min-h-11 items-center justify-between gap-3">
            <Label htmlFor="esp-ap-password" className="min-w-0 text-sm font-bold">
              رمز عبور اکسس‌پوینت
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onTogglePassword}
              disabled={isSaving}
              className="min-h-11 shrink-0 px-2 text-xs font-semibold text-accent3"
              aria-label={showPassword ? "مخفی کردن رمز اکسس‌پوینت" : "نمایش رمز اکسس‌پوینت"}
              aria-pressed={showPassword}
            >
              {showPassword ? "پنهان کردن" : "نمایش رمز"}
            </Button>
          </div>
          <Input
            id="esp-ap-password"
            ref={passwordInputRef}
            name="esp-ap-password"
            type={showPassword ? "text" : "password"}
            dir="ltr"
            autoComplete="new-password"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={63}
            disabled={isSaving}
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            placeholder="۸ تا ۶۳ بایت"
            className="h-11 bg-card-bg-solid text-base sm:text-sm"
            aria-invalid={Boolean(passwordError) || undefined}
            aria-describedby={
              passwordError ? "esp-ap-password-error" : "esp-ap-password-help"
            }
          />
          <div className="min-h-10 pt-1">
            {passwordError ? (
              <p
                id="esp-ap-password-error"
                className="text-xs leading-5 text-destructive"
                role="alert"
              >
                {passwordError}
              </p>
            ) : (
              <p id="esp-ap-password-help" className="text-xs leading-5 text-text-secondary">
                ۸ تا ۶۳ بایت UTF-8.
                <span className="ms-1 tabular-nums">({passwordByteLength}/۶۳)</span>
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-color/70 pt-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onResetToDefault}
          disabled={isSaving}
          className="h-auto min-h-11 whitespace-normal px-3 text-start text-xs font-semibold text-text-secondary"
        >
          بازگشت به پیش‌فرض دستگاه
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSaving}
            className="min-h-11"
          >
            لغو
          </Button>
          <Button
            type="button"
            variant="accent"
            onClick={onSave}
            disabled={isSaving}
            className="min-h-11"
          >
            <Save className="size-4" aria-hidden="true" />
            {isSaving ? "در حال ذخیره..." : "ذخیره اکسس‌پوینت"}
          </Button>
        </div>
      </div>
    </div>
  );
}
