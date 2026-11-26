import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Save } from "@/components/ui/hugeicons-groups/controls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { persistStoreConfigToCloudflare } from "@/features/iot/hooks/achaemenidState/core/buildEspConfig";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { isCloudflareEnabled } from "@/features/iot/services/cloudflareService";
import { soundManager } from "@/lib/audio";
import { getUtf8ByteLength, validateWifiAccessPoint } from "./wifiValidation";

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
  const hasApChanges =
    trimmedApSsid !== (wifiApConfig?.ssid ?? "").trim() ||
    apPassword !== (wifiApConfig?.password ?? "");
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
              {isDefaultAccessPoint ? "تنظیم پیش‌فرض دستگاه" : "رمز عبور سفارشی ذخیره شده"}
            </p>
            {isApSaved && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                <Check className="size-3.5" aria-hidden="true" />
                ذخیره شد
              </span>
            )}
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
        <>
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
              <span className="text-xs tabular-nums text-text-muted">{apSsidByteLength}/۳۲ بایت</span>
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
              value={apSsid}
              onChange={(event) => {
                setIsApSaved(false);
                setApDraft((previous) => ({ ...previous, ssid: event.target.value }));
              }}
              placeholder="Achaemenid-XXXXXX"
              aria-describedby="esp-ap-ssid-help"
              error={hasAttemptedApSave ? apErrors.ssid : undefined}
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
                onClick={() => setShowApPassword((visible) => !visible)}
                className="min-h-11 rounded-lg px-3 text-xs font-semibold text-accent3 hover:bg-accent3/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3"
                aria-label={showApPassword ? "مخفی کردن رمز اکسس‌پوینت" : "نمایش رمز اکسس‌پوینت"}
                aria-pressed={showApPassword}
              >
                {showApPassword ? "پنهان کردن" : "نمایش رمز"}
              </button>
            </div>
            <Input
              id="esp-ap-password"
              name="esp-ap-password"
              type={showApPassword ? "text" : "password"}
              dir="ltr"
              autoComplete="new-password"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={63}
              value={apPassword}
              onChange={(event) => {
                setIsApSaved(false);
                setApDraft((previous) => ({ ...previous, password: event.target.value }));
              }}
              placeholder="۸ تا ۶۳ بایت"
              aria-describedby="esp-ap-password-help"
              error={hasAttemptedApSave ? apErrors.password : undefined}
            />
            <p id="esp-ap-password-help" className="text-xs leading-5 text-text-muted">
              رمز سفارشی باید ۸ تا ۶۳ بایت UTF-8 باشد.
              <span className="ms-1 tabular-nums">({apPasswordByteLength}/۶۳ بایت)</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-color/70 pt-3">
            <button
              type="button"
              onClick={handleResetAccessPointDraft}
              className="min-h-11 rounded-lg px-3 text-xs font-semibold text-text-secondary transition-colors hover:bg-card-hover-bg hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3"
            >
              بازگشت به پیش‌فرض دستگاه
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelAccessPointEdit}
                disabled={isSavingAp}
                className="min-h-11"
              >
                لغو
              </Button>
              <Button
                type="button"
                variant={isApSaved && !hasApChanges ? "outline" : "accent"}
                disabled={isSavingAp}
                onClick={handleSaveAccessPoint}
                className={`min-h-11 h-auto rounded-xl px-4 py-2.5 text-sm font-bold ${
                  isApSaved && !hasApChanges
                    ? "border-success/40 bg-success-soft text-success hover:border-success/40 hover:bg-success-soft hover:text-success"
                    : ""
                }`}
              >
                {isSavingAp ? (
                  "در حال ذخیره اکسس‌پوینت..."
                ) : isApSaved && !hasApChanges ? (
                  <>
                    <Check className="size-4" />
                    ذخیره شد
                  </>
                ) : (
                  <>
                    <Save className="size-4" />
                    ذخیره اکسس‌پوینت
                  </>
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
