import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check } from "@/components/ui/hugeicons-groups/controls";
import { persistStoreConfigToCloudflare } from "@/features/iot/hooks/achaemenidState/core/buildEspConfig";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { isCloudflareEnabled } from "@/features/iot/services/cloudflareService";
import { soundManager } from "@/lib/audio";
import { getUtf8ByteLength, validateWifiAccessPoint } from "./wifiValidation";
import { WifiAccessPointEditor } from "./WifiAccessPointEditor";

interface ApDraftOverrides {
  ssid?: string;
  password?: string;
}

export function WifiAccessPointCard() {
  const wifiApConfig = useIoTStore((state) => state.wifiApConfig);
  const setWifiApConfig = useIoTStore((state) => state.setWifiApConfig);
  const showToast = useIoTStore((state) => state.showToast);

  const [apDraft, setApDraft] = useState<ApDraftOverrides>({});
  const [isApEditing, setIsApEditing] = useState(false);
  const [isSavingAp, setIsSavingAp] = useState(false);
  const [isApSaved, setIsApSaved] = useState(false);
  const [hasAttemptedApSave, setHasAttemptedApSave] = useState(false);
  const [showApPassword, setShowApPassword] = useState(false);
  const savedResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (savedResetTimerRef.current !== null) {
        clearTimeout(savedResetTimerRef.current);
      }
    };
  }, []);

  const apSsid = apDraft.ssid ?? wifiApConfig?.ssid ?? "";
  const apPassword = apDraft.password ?? wifiApConfig?.password ?? "";
  const trimmedApSsid = apSsid.trim();
  const apErrors = validateWifiAccessPoint(apSsid, apPassword);
  const hasApErrors = Boolean(apErrors.ssid || apErrors.password);
  const isDefaultAccessPoint = !wifiApConfig?.ssid && !wifiApConfig?.password;

  function scheduleApSavedReset(): void {
    setIsApSaved(true);

    if (savedResetTimerRef.current !== null) {
      clearTimeout(savedResetTimerRef.current);
    }

    savedResetTimerRef.current = setTimeout(() => {
      savedResetTimerRef.current = null;
      setIsApSaved(false);
    }, 2000);
  }

  async function handleSaveAccessPoint(): Promise<void> {
    soundManager.playClick();
    setHasAttemptedApSave(true);

    if (hasApErrors) {
      showToast(apErrors.ssid || apErrors.password || "اطلاعات اکسس‌پوینت را بررسی کنید.", "error");
      return;
    }

    const nextApConfig = { ssid: trimmedApSsid, password: apPassword };
    const previousApConfig = wifiApConfig;
    setWifiApConfig(nextApConfig);
    setApDraft({});

    if (!isCloudflareEnabled()) {
      showToast("تنظیمات اکسس‌پوینت در حافظه داشبورد ذخیره شد.", "success");
      setIsApEditing(false);
      setHasAttemptedApSave(false);
      scheduleApSavedReset();
      return;
    }

    setIsSavingAp(true);

    try {
      const { result } = await persistStoreConfigToCloudflare({
        overrides: { wifiApConfig: nextApConfig },
        successToast: "تنظیمات اکسس‌پوینت ذخیره شد.",
        errorToast: "خطا در ذخیره تنظیمات اکسس‌پوینت.",
      });

      if (result.success) {
        setIsApEditing(false);
        setHasAttemptedApSave(false);
        scheduleApSavedReset();
      } else {
        setWifiApConfig(previousApConfig);
        setApDraft(nextApConfig);
      }
    } catch (error) {
      setWifiApConfig(previousApConfig);
      setApDraft(nextApConfig);
      console.error("Failed to save Access Point settings to cloud", error);
      showToast("خطا در ارتباط با سرور کلودفلر.", "error");
    } finally {
      setIsSavingAp(false);
    }
  }

  function handleEditAccessPoint(): void {
    setApDraft({});
    setHasAttemptedApSave(false);
    setIsApSaved(false);
    setIsApEditing(true);
  }

  function handleCancelAccessPointEdit(): void {
    setApDraft({});
    setHasAttemptedApSave(false);
    setIsApEditing(false);
  }

  function handleResetAccessPointDraft(): void {
    setApDraft({ ssid: "", password: "" });
    setHasAttemptedApSave(false);
    setIsApSaved(false);
    setShowApPassword(false);
  }

  const apSsidByteLength = getUtf8ByteLength(trimmedApSsid);
  const apPasswordByteLength = getUtf8ByteLength(apPassword);

  return (
    <section aria-labelledby="wifi-ap-heading" className="surface-panel space-y-4 p-4">
      {!isApEditing ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h3 id="wifi-ap-heading" className="text-sm font-bold text-text-primary">
              اکسس‌پوینت راه‌اندازی (AP)
            </h3>
            <p className="text-xs leading-5 text-text-secondary">
              {isDefaultAccessPoint
                ? "از نام و رمز پیش‌فرض مبتنی بر MAC دستگاه استفاده می‌شود."
                : `نام شبکه: ${wifiApConfig?.ssid || "ثبت نشده"}`}
            </p>
            <p className="text-xs text-text-muted">
              {isDefaultAccessPoint ? "نام و رمز پیش‌فرض دستگاه بر اساس شناسهٔ سخت‌افزاری ساخته می‌شود." : "نام و رمز سفارشی برای شبکهٔ راه‌اندازی ذخیره شده است."}
            </p>
            <p className="max-w-2xl text-xs leading-5 text-text-secondary">
              این اکسس‌پوینت یک شبکهٔ مستقل برای اتصال مستقیم به ESP32 است؛ با شبکهٔ روتر خانه که در فهرست بالا ثبت می‌کنید تفاوت دارد.
            </p>
            {isApSaved ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                <Check className="size-3.5" aria-hidden="true" />
                ذخیره شد
              </span>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleEditAccessPoint}
            className="min-h-11 shrink-0"
          >
            ویرایش اکسس‌پوینت
          </Button>
        </div>
      ) : (
        <WifiAccessPointEditor
          ssid={apSsid}
          password={apPassword}
          ssidByteLength={apSsidByteLength}
          passwordByteLength={apPasswordByteLength}
          showPassword={showApPassword}
          hasAttemptedSave={hasAttemptedApSave}
          isSaving={isSavingAp}
          errors={apErrors}
          onSsidChange={(value) => {
            setIsApSaved(false);
            setApDraft((previous) => ({ ...previous, ssid: value }));
          }}
          onPasswordChange={(value) => {
            setIsApSaved(false);
            setApDraft((previous) => ({ ...previous, password: value }));
          }}
          onTogglePassword={() => setShowApPassword((visible) => !visible)}
          onResetToDefault={handleResetAccessPointDraft}
          onCancel={handleCancelAccessPointEdit}
          onSave={handleSaveAccessPoint}
        />
      )}
    </section>
  );
}
