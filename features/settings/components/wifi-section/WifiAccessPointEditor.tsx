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
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 id="wifi-ap-heading" className="text-sm font-bold text-text-primary">
          اکسس‌پوینت راه‌اندازی (AP)
        </h3>
        <p className="text-xs leading-5 text-text-secondary">
          این شبکه برای اتصال مستقیم به ESP32 هنگام راه‌اندازی است. برای بازگشت به تنظیم پیش‌فرض دستگاه، هر دو فیلد را خالی بگذارید.
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="esp-ap-ssid">نام شبکه (SSID)</Label>
          <span className="text-xs tabular-nums text-text-muted">{ssidByteLength}/۳۲ بایت</span>
        </div>
        <Input
          id="esp-ap-ssid"
          name="esp-ap-ssid"
          type="text"
          dir="auto"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={32}
          disabled={isSaving}
          value={ssid}
          onChange={(event) => onSsidChange(event.target.value)}
          placeholder="Achaemenid-XXXXXX"
          aria-describedby="esp-ap-ssid-help"
          error={hasAttemptedSave ? errors.ssid : undefined}
        />
        <p id="esp-ap-ssid-help" className="text-xs leading-5 text-text-muted">
          نام شبکه پس از حذف فاصله‌های ابتدا و انتها، حداکثر ۳۲ بایت UTF-8 است.
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="esp-ap-password">رمز عبور اکسس‌پوینت</Label>
          <button
            type="button"
            onClick={onTogglePassword}
            disabled={isSaving}
            className="min-h-11 rounded-lg px-3 text-xs font-semibold text-accent3 hover:bg-accent3/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3"
            aria-label={showPassword ? "مخفی کردن رمز اکسس‌پوینت" : "نمایش رمز اکسس‌پوینت"}
            aria-pressed={showPassword}
          >
            {showPassword ? "پنهان کردن" : "نمایش رمز"}
          </button>
        </div>
        <Input
          id="esp-ap-password"
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
          aria-describedby="esp-ap-password-help"
          error={hasAttemptedSave ? errors.password : undefined}
        />
        <p id="esp-ap-password-help" className="text-xs leading-5 text-text-muted">
          رمز سفارشی باید ۸ تا ۶۳ بایت UTF-8 باشد.
          <span className="ms-1 tabular-nums">({passwordByteLength}/۶۳ بایت)</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-color/70 pt-3">
        <button
          type="button"
          onClick={onResetToDefault}
          disabled={isSaving}
          className="min-h-11 rounded-lg px-3 text-xs font-semibold text-text-secondary transition-colors hover:bg-card-hover-bg hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3"
        >
          بازگشت به پیش‌فرض دستگاه
        </button>
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
