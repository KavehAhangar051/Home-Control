import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Save } from "@/components/ui/hugeicons-groups/controls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getUtf8ByteLength, type WifiCredentialErrors } from "./wifiValidation";

interface Props {
  title: string;
  tempSsid: string;
  setTempSsid: (val: string) => void;
  tempPassword: string;
  setTempPassword: (val: string) => void;
  errors: WifiCredentialErrors;
  onSave: () => void;
  onCancel: () => void;
}

export function WifiNetworkEditor({
  title,
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
    <div className="@container space-y-4 py-4">
      <h4 className="text-sm font-semibold text-text-primary">{title}</h4>

      <div className="grid grid-cols-1 gap-x-6 gap-y-5 @lg:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <div className="flex min-h-8 items-center justify-between gap-3">
            <Label htmlFor="wifi-network-ssid" className="min-w-0 text-sm font-bold">
              نام شبکه (SSID)
            </Label>
            <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-text-secondary">
              {ssidBytes}/۳۲ بایت
            </span>
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
            aria-invalid={Boolean(errors.ssid) || undefined}
            aria-describedby={errors.ssid ? "wifi-network-ssid-error" : "wifi-network-ssid-help"}
          />
          <div className="min-h-10 pt-1">
            {errors.ssid ? (
              <p id="wifi-network-ssid-error" className="text-xs leading-5 text-destructive" role="alert">
                {errors.ssid}
              </p>
            ) : (
              <p id="wifi-network-ssid-help" className="text-xs leading-5 text-text-secondary">
                حداکثر ۳۲ بایت UTF-8.
              </p>
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-2">
          <div className="flex min-h-8 items-center justify-between gap-3">
            <Label htmlFor="wifi-network-password" className="min-w-0 text-sm font-bold">
              رمز عبور شبکه
            </Label>
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              className="min-h-8 shrink-0 rounded-md px-2 text-xs font-semibold text-accent3 hover:bg-accent3/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3"
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
            aria-invalid={Boolean(errors.password) || undefined}
            aria-describedby={
              errors.password ? "wifi-network-password-error" : "wifi-network-password-help"
            }
          />
          <div className="min-h-10 pt-1">
            {errors.password ? (
              <p
                id="wifi-network-password-error"
                className="text-xs leading-5 text-destructive"
                role="alert"
              >
                {errors.password}
              </p>
            ) : (
              <p id="wifi-network-password-help" className="text-xs leading-5 text-text-secondary">
                برای شبکهٔ بدون رمز، خالی بگذارید؛ در غیر این صورت ۸ تا ۶۳ بایت.
                <span className="ms-1 tabular-nums">({passwordBytes}/۶۳)</span>
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} className="min-h-11">
          لغو
        </Button>
        <Button type="button" variant="accent" onClick={onSave} className="min-h-11">
          <Save className="size-4" aria-hidden="true" />
          ذخیره شبکه
        </Button>
      </div>
    </div>
  );
}
