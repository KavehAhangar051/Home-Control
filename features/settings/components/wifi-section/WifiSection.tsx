import { AnimatePresence } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Save, Wifi } from "@/components/ui/hugeicons-groups/controls";
import { Plus } from "@/components/ui/hugeicons-groups/shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WifiNetwork } from "@/features/iot/hooks/store/types";
import { persistStoreConfigToCloudflare } from "@/features/iot/hooks/achaemenidState/core/buildEspConfig";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { isCloudflareEnabled } from "@/features/iot/services/cloudflareService";
import { soundManager } from "@/lib/audio";
import { WifiNetworkEditCard, WifiNetworkViewCard } from "./WifiNetworkCard";
import {
  getUtf8ByteLength,
  MAX_WIFI_NETWORKS,
  validateWifiAccessPoint,
  validateWifiNetwork,
} from "./wifiValidation";

interface ApDraftOverrides {
  ssid?: string;
  password?: string;
}

export default function WifiSection() {
  const wifiNetworks = useIoTStore((state) => state.wifiNetworks);
  const setWifiNetworks = useIoTStore((state) => state.setWifiNetworks);
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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftNewNetwork, setDraftNewNetwork] = useState<WifiNetwork | null>(null);
  const [tempSsid, setTempSsid] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [networkErrors, setNetworkErrors] = useState<ReturnType<typeof validateWifiNetwork>>({});

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
      }
    } catch (error) {
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

  function handleAddNetwork(): void {
    if (wifiNetworks.length >= MAX_WIFI_NETWORKS || editingId !== null) return;

    const newId = `wifi_${Date.now()}`;
    setDraftNewNetwork({ id: newId, ssid: "", password: "" });
    setEditingId(newId);
    setTempSsid("");
    setTempPassword("");
    setNetworkErrors({});
  }

  function handleEditNetwork(id: string, ssid: string, password?: string): void {
    setEditingId(id);
    setTempSsid(ssid);
    setTempPassword(password || "");
    setNetworkErrors({});
  }

  function handleSaveNetwork(id: string): void {
    const errors = validateWifiNetwork(tempSsid, tempPassword, wifiNetworks, id);
    setNetworkErrors(errors);

    if (errors.ssid || errors.password) return;

    const nextNetwork = {
      id,
      ssid: tempSsid.trim(),
      password: tempPassword,
    };

    if (draftNewNetwork?.id === id) {
      setWifiNetworks((previous) => [...previous, nextNetwork]);
      setDraftNewNetwork(null);
    } else {
      setWifiNetworks((previous) =>
        previous.map((network) => (network.id === id ? nextNetwork : network)),
      );
    }

    setEditingId(null);
    setNetworkErrors({});
  }

  function handleCancelNetworkEdit(): void {
    if (draftNewNetwork?.id === editingId) {
      setDraftNewNetwork(null);
    }

    setEditingId(null);
    setNetworkErrors({});
  }

  function handleRemoveNetwork(id: string): void {
    setWifiNetworks((previous) => previous.filter((network) => network.id !== id));

    if (editingId === id) {
      setEditingId(null);
      setNetworkErrors({});
    }
  }

  const apSsidByteLength = getUtf8ByteLength(trimmedApSsid);
  const apPasswordByteLength = getUtf8ByteLength(apPassword);
  const canAddNetwork = wifiNetworks.length < MAX_WIFI_NETWORKS && editingId === null;

  return (
    <div className="space-y-7">
      <section aria-labelledby="wifi-networks-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 id="wifi-networks-heading" className="text-sm font-bold text-text-primary">
              شبکه‌های Wi-Fi
            </h3>
            <p className="text-xs text-text-secondary">
              ESP32 برای اتصال به شبکه‌های ذخیره‌شده از این فهرست استفاده می‌کند.
            </p>
          </div>
          <Button
            type="button"
            onClick={handleAddNetwork}
            variant="accent"
            size="sm"
            disabled={!canAddNetwork}
            className="min-h-11 rounded-xl gap-1.5 text-xs"
          >
            <Plus className="size-3.5" />
            افزودن شبکه
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-border-color bg-card-bg-solid px-3 py-2.5">
          <span className="text-xs text-text-secondary">شبکه‌های ذخیره‌شده</span>
          <span className="text-sm font-bold tabular-nums text-text-primary">
            {wifiNetworks.length} از {MAX_WIFI_NETWORKS}
          </span>
        </div>

        {wifiNetworks.length === 1 && (
          <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-xs leading-5 text-amber-800 dark:text-amber-300">
            حذف آخرین شبکه باعث راه‌اندازی مجدد ESP32 و بازگشت آن به اکسس‌پوینت راه‌اندازی می‌شود.
          </p>
        )}

        <AnimatePresence initial={false}>
          {draftNewNetwork && editingId === draftNewNetwork.id && (
            <WifiNetworkEditCard
              key={draftNewNetwork.id}
              tempSsid={tempSsid}
              setTempSsid={setTempSsid}
              tempPassword={tempPassword}
              setTempPassword={setTempPassword}
              errors={networkErrors}
              onSave={() => handleSaveNetwork(draftNewNetwork.id)}
              onCancel={handleCancelNetworkEdit}
            />
          )}
          {wifiNetworks.map((network) =>
            editingId === network.id ? (
              <WifiNetworkEditCard
                key={network.id}
                tempSsid={tempSsid}
                setTempSsid={setTempSsid}
                tempPassword={tempPassword}
                setTempPassword={setTempPassword}
                errors={networkErrors}
                onSave={() => handleSaveNetwork(network.id)}
                onCancel={handleCancelNetworkEdit}
              />
            ) : (
              <WifiNetworkViewCard
                key={network.id}
                net={network}
                onEditStart={() => handleEditNetwork(network.id, network.ssid, network.password)}
                onDelete={() => handleRemoveNetwork(network.id)}
              />
            ),
          )}
        </AnimatePresence>

        {wifiNetworks.length === 0 && !draftNewNetwork && (
          <div className="space-y-3 rounded-2xl border border-dashed border-border-color bg-card-bg-solid p-6 text-center">
            <Wifi className="mx-auto size-7 text-text-muted" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-text-primary">شبکه‌ای اضافه نشده است</p>
              <p className="text-xs leading-5 text-text-secondary">
                یک شبکه Wi-Fi اضافه کنید تا ESP32 بتواند به آن متصل شود.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleAddNetwork}
              disabled={!canAddNetwork}
              className="min-h-11"
            >
              <Plus className="size-4" />
              افزودن اولین شبکه
            </Button>
          </div>
        )}

        {wifiNetworks.length >= MAX_WIFI_NETWORKS && (
          <p className="text-xs text-text-muted">
            ظرفیت پنج شبکه تکمیل شده است. برای افزودن شبکهٔ دیگر، ابتدا یکی را حذف کنید.
          </p>
        )}
      </section>

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
    </div>
  );
}
