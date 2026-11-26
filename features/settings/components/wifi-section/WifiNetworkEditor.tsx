import { useEffect, useRef, useState } from "react";
import { Check } from "@/components/ui/hugeicons-groups/controls";
import { X } from "@/components/ui/hugeicons-groups/shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getUtf8ByteLength, type WifiCredentialErrors } from "./wifiValidation";

interface Props {
  tempSsid: string;
  setTempSsid: (val: string) => void;
  tempPassword: string;
  setTempPassword: (val: string) => void;
  errors: WifiCredentialErrors;
  onSave: () => void;
  onCancel: () => void;
}

export function WifiNetworkEditor({
  tempSsid,
  setTempSsid,
  tempPassword,
  setTempPassword,
  errors,
  onSave,
  onCancel,
}: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const ssidInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const ssidBytes = getUtf8ByteLength(tempSsid.trim());
  const passwordBytes = getUtf8ByteLength(tempPassword);

  useEffect(() => {
    if (errors.ssid) {
      ssidInputRef.current?.focus();
    } else if (errors.password) {
      passwordInputRef.current?.focus();
    }
  }, [errors.ssid, errors.password]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h4 className="text-sm font-bold text-text-primary">اطلاعات اتصال به روتر</h4>
        <p className="text-xs leading-5 text-text-secondary">
          نام و رمز شبکه‌ای را وارد کنید که می‌خواهید ESP32 از طریق آن به شبکهٔ محلی وصل شود؛ این اطلاعات با نام و رمز اکسس‌پوینت راه‌اندازی متفاوت است.
        </p>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="wifi-network-ssid" className="text-sm font-bold">
            نام شبکه Wi-Fi (SSID)
          </Label>
          <span className="text-xs tabular-nums text-text-muted">{ssidBytes}/۳۲ بایت</span>
        </div>
        <Input
          id="wifi-network-ssid"
          ref={ssidInputRef}
          name="wifi-network-ssid"
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={32}
          value={tempSsid}
          onChange={(event) => setTempSsid(event.target.value)}
          placeholder="نام شبکه"
          className="h-11 bg-card-bg-solid text-base sm:text-sm"
          dir="auto"
          aria-describedby="wifi-network-ssid-help"
          error={errors.ssid}
        />
        <p id="wifi-network-ssid-help" className="text-xs leading-5 text-text-muted">
          نامی را دقیقاً مطابق نام Wi-Fi روتر وارد کنید. پس از حذف فاصله‌های ابتدا و انتها، حداکثر ۳۲ بایت UTF-8 مجاز است.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="wifi-network-password" className="text-sm font-bold">
            رمز عبور شبکه
          </Label>
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            className="min-h-11 rounded-lg px-3 text-xs font-semibold text-accent3 hover:bg-accent3/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3"
            aria-label={showPassword ? "مخفی کردن رمز عبور شبکه" : "نمایش رمز عبور شبکه"}
            aria-pressed={showPassword}
          >
            {showPassword ? "پنهان کردن" : "نمایش رمز"}
          </button>
        </div>
        <Input
          id="wifi-network-password"
          ref={passwordInputRef}
          name="wifi-network-password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={63}
          value={tempPassword}
          onChange={(event) => setTempPassword(event.target.value)}
          className="h-11 bg-card-bg-solid text-base sm:text-sm"
          dir="ltr"
          aria-describedby="wifi-network-password-help"
          error={errors.password}
        />
        <p id="wifi-network-password-help" className="text-xs leading-5 text-text-muted">
          این رمز برای ورود ESP32 به روتر استفاده می‌شود. اگر شبکه باز است، فیلد را خالی بگذارید؛ در غیر این صورت رمز باید ۸ تا ۶۳ بایت باشد.
          <span className="ms-1 tabular-nums">({passwordBytes}/۶۳ بایت)</span>
        </p>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onSave}
          className="flex-1 min-h-11 rounded-xl bg-accent3 p-2.5 text-accent3-foreground shadow-xs transition-colors hover:bg-accent3-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 focus-visible:ring-offset-2"
        >
          <span className="flex items-center justify-center gap-2 text-sm font-bold">
            <Check aria-hidden="true" className="size-4" />
            ذخیره شبکه
          </span>
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-border-color bg-card-bg-solid px-4 text-sm font-semibold text-text-secondary transition-colors hover:border-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3"
        >
          <X aria-hidden="true" className="size-4" />
          لغو
        </button>
      </div>
    </div>
  );
}
