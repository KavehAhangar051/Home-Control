"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/ui/delete-button";
import { Edit2, Save } from "@/components/ui/hugeicons-groups/controls";
import { RefreshCw } from "@/components/ui/hugeicons-groups/shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { persistStoreConfigToCloudflare } from "@/features/iot/hooks/achaemenidState/core/buildEspConfig";
import type { WifiAccessPointConfig } from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { isCloudflareEnabled } from "@/features/iot/services/cloudflareService";
import { soundManager } from "@/lib/audio";
import { WifiPasswordInput } from "./WifiPasswordInput";
import {
  getUtf8ByteLength,
  validateWifiAccessPointCredentials,
  type WifiCredentialErrors,
} from "./wifiValidation";

interface WifiAccessPointEditorProps {
  tempSsid: string;
  setTempSsid: (val: string) => void;
  tempPassword: string;
  setTempPassword: (val: string) => void;
  errors: WifiCredentialErrors;
  isSaving: boolean;
  onResetDefault: () => void;
  onSave: () => void;
  onCancel: () => void;
}

function WifiAccessPointEditor({
  tempSsid,
  setTempSsid,
  tempPassword,
  setTempPassword,
  errors,
  isSaving,
  onResetDefault,
  onSave,
  onCancel,
}: WifiAccessPointEditorProps) {
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
    <div className="@container space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-text-primary">ویرایش مشخصات اکسس‌پوینت</h4>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onResetDefault}
          disabled={isSaving}
          className="min-h-11 gap-1.5 px-3 text-xs text-text-secondary hover:text-text-primary"
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          بازنشانی به پیش‌فرض دستگاه
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-5 @lg:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <div className="flex min-h-11 items-center justify-between gap-3">
            <Label htmlFor="wifi-ap-ssid" className="min-w-0 text-sm font-bold">
              نام شبکه (SSID) اکسس‌پوینت
            </Label>
            <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-text-secondary">
              {ssidBytes}/۳۲ بایت
            </span>
          </div>
          <Input
            id="wifi-ap-ssid"
            ref={ssidInputRef}
            name="wifi-ap-ssid"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={tempSsid}
            onChange={(event) => setTempSsid(event.target.value)}
            placeholder="خالی = نام پیش‌فرض دستگاه"
            className="h-11 bg-card-bg-solid text-base sm:text-sm"
            dir="auto"
            aria-invalid={Boolean(errors.ssid) || undefined}
            aria-describedby={errors.ssid ? "wifi-ap-ssid-error" : "wifi-ap-ssid-help"}
          />
          <div className="min-h-10 pt-1">
            {errors.ssid ? (
              <p
                id="wifi-ap-ssid-error"
                className="text-xs leading-5 text-destructive"
                role="alert"
              >
                {errors.ssid}
              </p>
            ) : (
              <p id="wifi-ap-ssid-help" className="text-xs leading-5 text-text-secondary">
                در صورت خالی بودن هر دو فیلد، نام پیش‌فرض مبتنی بر MAC استفاده می‌شود.
              </p>
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-2">
          <div className="flex min-h-11 items-center">
            <Label htmlFor="wifi-ap-password" className="text-sm font-bold">
              رمز عبور اکسس‌پوینت
            </Label>
          </div>
          <WifiPasswordInput
            id="wifi-ap-password"
            name="wifi-ap-password"
            inputRef={passwordInputRef}
            value={tempPassword}
            onChange={(event) => setTempPassword(event.target.value)}
            showPassword={showPassword}
            onTogglePassword={() => setShowPassword((visible) => !visible)}
            maxLength={63}
            autoComplete="new-password"
            dir="ltr"
            placeholder="حداقل ۸ کاراکتر"
            className="h-11 bg-card-bg-solid text-base sm:text-sm"
            aria-invalid={Boolean(errors.password) || undefined}
            aria-describedby={errors.password ? "wifi-ap-password-error" : "wifi-ap-password-help"}
          />
          <div className="min-h-10 pt-1">
            {errors.password ? (
              <p
                id="wifi-ap-password-error"
                className="text-xs leading-5 text-destructive"
                role="alert"
              >
                {errors.password}
              </p>
            ) : (
              <p id="wifi-ap-password-help" className="text-xs leading-5 text-text-secondary">
                برای نام سفارشی، رمز ۸ تا ۶۳ بایت الزامی است.
                <span className="ms-1 tabular-nums">({passwordBytes}/۶۳)</span>
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
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
  );
}

export function WifiAccessPointCard() {
  const wifiApConfig = useIoTStore((state) => state.wifiApConfig);
  const setWifiApConfig = useIoTStore((state) => state.setWifiApConfig);
  const showToast = useIoTStore((state) => state.showToast);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tempSsid, setTempSsid] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [errors, setErrors] = useState<WifiCredentialErrors>({});

  const hasCustomAp = Boolean(wifiApConfig?.ssid?.trim());

  const openEditor = () => {
    setTempSsid(wifiApConfig?.ssid ?? "");
    setTempPassword(wifiApConfig?.password ?? "");
    setErrors({});
    setIsEditing(true);
  };

  const closeEditor = () => {
    setErrors({});
    setIsEditing(false);
  };

  const persistApChange = async (
    nextConfig: WifiAccessPointConfig | null,
    keepEditorOpenOnFailure: boolean,
  ) => {
    const previousConfig = wifiApConfig;
    setWifiApConfig(nextConfig);

    if (!isCloudflareEnabled()) {
      showToast(
        nextConfig?.ssid
          ? "تنظیمات اکسس‌پوینت ذخیره شد."
          : "اکسس‌پوینت به حالت پیش‌فرض دستگاه بازنشانی شد.",
        "success",
      );
      if (keepEditorOpenOnFailure) closeEditor();
      return;
    }

    setIsSaving(true);
    try {
      const { result } = await persistStoreConfigToCloudflare({
        overrides: { wifiApConfig: nextConfig },
      });

      if (result.success) {
        if (keepEditorOpenOnFailure) closeEditor();
      } else {
        setWifiApConfig(previousConfig);
        showToast(result.message || "خطا در ذخیره تنظیمات اکسس‌پوینت در کلودفلر.", "error");
      }
    } catch {
      setWifiApConfig(previousConfig);
      showToast("خطا در ارتباط با سرور کلودفلر؛ تغییرات بازگردانی شد.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = () => {
    if (isSaving) return;
    soundManager.playClick();

    const validationErrors = validateWifiAccessPointCredentials({
      ssid: tempSsid,
      password: tempPassword,
    });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const trimmedSsid = tempSsid.trim();
    const nextConfig: WifiAccessPointConfig =
      !trimmedSsid && !tempPassword
        ? { ssid: "", password: "" }
        : { ssid: trimmedSsid, password: tempPassword };

    void persistApChange(nextConfig, true);
  };

  const handleClearToDefault = () => {
    if (isSaving) return;
    soundManager.playClick();
    void persistApChange({ ssid: "", password: "" }, false);
  };

  return (
    <section aria-labelledby="wifi-ap-heading" className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="space-y-1.5 lg:col-span-5 text-right">
        <h3 id="wifi-ap-heading" className="text-sm font-bold text-text-primary">
          اکسس‌پوینت راه‌اندازی (Provisioning AP)
        </h3>
        <p className="text-xs leading-5 text-text-secondary">
          هنگامی که ESP32 نتواند به شبکه‌های ذخیره‌شده متصل شود، با این مشخصات نقطه دسترسی محلی ایجاد
          می‌کند تا امکان تنظیم مجدد فراهم بماند.
        </p>
      </div>

      <div className="min-w-0 lg:col-span-7">
        {isEditing ? (
          <WifiAccessPointEditor
            tempSsid={tempSsid}
            setTempSsid={(val) => {
              setTempSsid(val);
              if (errors.ssid) setErrors((prev) => ({ ...prev, ssid: undefined }));
            }}
            tempPassword={tempPassword}
            setTempPassword={(val) => {
              setTempPassword(val);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            errors={errors}
            isSaving={isSaving}
            onResetDefault={() => {
              setTempSsid("");
              setTempPassword("");
              setErrors({});
            }}
            onSave={handleSave}
            onCancel={closeEditor}
          />
        ) : (
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-3 py-2">
            <div className="min-w-0 flex-1 space-y-1 text-right">
              <p className="truncate text-sm font-semibold text-text-primary">
                {hasCustomAp ? wifiApConfig?.ssid : "پیش‌فرض خودکار دستگاه (بر اساس آدرس MAC)"}
              </p>
              <p className="text-xs text-text-secondary">
                {hasCustomAp && wifiApConfig?.password
                  ? "رمز عبور سفارشی ذخیره شده است"
                  : "در حالت پیش‌فرض از شناسه و رمز کارخانه‌ای دستگاه استفاده می‌شود"}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={openEditor}
                disabled={isSaving}
                className="min-h-11 gap-1.5 px-3 text-xs"
                aria-label="ویرایش اکسس‌پوینت"
              >
                <Edit2 className="size-4" aria-hidden="true" />
                ویرایش
              </Button>

              {hasCustomAp && (
                <DeleteButton
                  size="sm"
                  cornerRadius={11}
                  resetAfter={0}
                  onConfirm={handleClearToDefault}
                  label="بازنشانی اکسس‌پوینت به پیش‌فرض"
                  className="min-h-11 min-w-11 shrink-0"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
