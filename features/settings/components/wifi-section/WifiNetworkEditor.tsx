import { useEffect, useRef, useState } from "react";
import { Save } from "@/components/ui/hugeicons-groups/controls";
import { Button } from "@/components/ui/button";
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
    <div className="space-y-6">
      <div className="space-y-1">
        <h4 className="text-sm font-bold text-text-primary">اطلاعات اتصال به روتر</h4>
        <p className="text-xs leading-5 text-text-secondary">ESP32 با این اطلاعات به شبکهٔ محلی وصل می‌شود.</p>
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
          value={tempSsid}
          onChange={(event) => setTempSsid(event.target.value)}
          placeholder="نام شبکه"
          className="h-11 bg-card-bg-solid text-base sm:text-sm"
          dir="auto"
          aria-describedby="wifi-network-ssid-help"
          error={errors.ssid}
        />
        <p id="wifi-network-ssid-help" className="text-xs leading-5 text-text-muted">
          نام را مطابق تنظیمات روتر وارد کنید؛ حداکثر ۳۲ بایت UTF-8.
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
          رمز ورود به روتر است. برای شبکهٔ بدون رمز، این فیلد را خالی بگذارید؛ در غیر این صورت ۸ تا ۶۳ بایت.
          <span className="ms-1 tabular-nums">({passwordBytes}/۶۳ بایت)</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border-color/70 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="min-h-11">لغو</Button>
        <Button type="button" variant="accent" onClick={onSave} className="min-h-11">
          <Save className="size-4" aria-hidden="true" />
          ذخیره شبکه
        </Button>
      </div>
    </div>
  );
}
