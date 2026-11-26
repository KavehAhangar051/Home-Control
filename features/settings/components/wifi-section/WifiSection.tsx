import { AnimatePresence } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Save, Wifi } from "@/components/ui/hugeicons-groups/controls";
import { Plus } from "@/components/ui/hugeicons-groups/shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { persistStoreConfigToCloudflare } from "@/features/iot/hooks/achaemenidState/core/buildEspConfig";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { isCloudflareEnabled } from "@/features/iot/services/cloudflareService";
import { soundManager } from "@/lib/audio";
import { WifiNetworkEditCard, WifiNetworkViewCard } from "./WifiNetworkCard";

interface ApDraftOverrides {
  ssid?: string;
  password?: string;
}

export default function WifiSection() {
  const wifiNetworks = useIoTStore((s) => s.wifiNetworks);
  const setWifiNetworks = useIoTStore((s) => s.setWifiNetworks);
  const wifiApConfig = useIoTStore((s) => s.wifiApConfig);
  const setWifiApConfig = useIoTStore((s) => s.setWifiApConfig);
  const showToast = useIoTStore((s) => s.showToast);

  const [apDraft, setApDraft] = useState<ApDraftOverrides>({});
  const [isSavingAp, setIsSavingAp] = useState(false);
  const [isApSaved, setIsApSaved] = useState(false);
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
  const hasAnyApValue = Boolean(trimmedApSsid || apPassword);

  const apSsidError =
    hasAnyApValue && !trimmedApSsid
      ? "نام شبکه اکسس‌پوینت را وارد کنید."
      : trimmedApSsid.length > 32
        ? "نام شبکه نمی‌تواند بیشتر از ۳۲ نویسه باشد."
        : undefined;

  const apPasswordError =
    hasAnyApValue && (apPassword.length < 8 || apPassword.length > 63)
      ? "رمز عبور اکسس‌پوینت باید ۸ تا ۶۳ نویسه باشد."
      : undefined;

  const hasApErrors = Boolean(apSsidError || apPasswordError);
  const hasApChanges =
    trimmedApSsid !== (wifiApConfig?.ssid ?? "").trim() ||
    apPassword !== (wifiApConfig?.password ?? "");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempSsid, setTempSsid] = useState("");
  const [tempPassword, setTempPassword] = useState("");

  const scheduleApSavedReset = () => {
    setIsApSaved(true);

    if (savedResetTimerRef.current !== null) {
      clearTimeout(savedResetTimerRef.current);
    }

    savedResetTimerRef.current = setTimeout(() => {
      savedResetTimerRef.current = null;
      setIsApSaved(false);
    }, 2000);
  };

  const handleSaveAccessPoint = async () => {
    soundManager.playClick();

    if (apSsidError || apPasswordError) {
      showToast(apSsidError || apPasswordError || "اطلاعات اکسس‌پوینت را بررسی کنید.", "error");

      return;
    }

    const nextApConfig = {
      ssid: trimmedApSsid,
      password: apPassword,
    };

    setWifiApConfig(nextApConfig);
    setApDraft({});

    if (!isCloudflareEnabled()) {
      showToast("تنظیمات اکسس‌پوینت در حافظه داشبورد ذخیره شد.", "success");
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
        scheduleApSavedReset();
      }
    } catch (error) {
      console.error("Failed to save Access Point settings to cloud", error);
      showToast("خطا در ارتباط با سرور کلودفلر.", "error");
    } finally {
      setIsSavingAp(false);
    }
  };

  const handleAddNetwork = () => {
    const newId = `wifi_${Date.now()}`;
    setWifiNetworks((prev) => [...prev, { id: newId, ssid: "شبکه جدید", password: "" }]);
    setEditingId(newId);
    setTempSsid("شبکه جدید");
    setTempPassword("");
  };

  const handleEditNetwork = (id: string, ssid: string, password?: string) => {
    setEditingId(id);
    setTempSsid(ssid);
    setTempPassword(password || "");
  };

  const handleSaveNetwork = (id: string) => {
    if (!tempSsid.trim()) return;
    setWifiNetworks((prev) =>
      prev.map((net) => (net.id === id ? { ...net, ssid: tempSsid, password: tempPassword } : net)),
    );
    setEditingId(null);
  };

  const handleRemoveNetwork = (id: string) => {
    setWifiNetworks((prev) => prev.filter((net) => net.id !== id));

    if (editingId === id) {
      setEditingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="surface-panel space-y-3 p-4">
        <div>
          <h4 className="text-sm font-semibold text-text-primary">اکسس‌پوینت راه‌اندازی (AP)</h4>
          <p className="mt-1 text-xs leading-5 text-text-muted">
            این شبکه برای اتصال مستقیم به ESP32 هنگام راه‌اندازی است. برای استفاده از نام و رمز پیش‌فرض دستگاه، هر دو فیلد را خالی بگذارید.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="esp-ap-ssid">نام شبکه (SSID)</Label>
          <Input
            id="esp-ap-ssid"
            type="text"
            dir="auto"
            maxLength={32}
            value={apSsid}
            onChange={(event) => {
              setIsApSaved(false);
              setApDraft((prev) => ({
                ...prev,
                ssid: event.target.value,
              }));
            }}
            placeholder="Achaemenid-XXXXXX"
            error={apSsidError}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="esp-ap-password">رمز عبور اکسس‌پوینت</Label>
          <Input
            id="esp-ap-password"
            type="password"
            dir="ltr"
            maxLength={63}
            value={apPassword}
            onChange={(event) => {
              setIsApSaved(false);
              setApDraft((prev) => ({
                ...prev,
                password: event.target.value,
              }));
            }}
            placeholder="حداقل ۸ کاراکتر"
            error={apPasswordError}
          />
        </div>

        <div className="space-y-2 pt-1">
          <Button
            type="button"
            variant={isApSaved && !hasApChanges ? "outline" : "accent"}
            disabled={isSavingAp || hasApErrors}
            onClick={handleSaveAccessPoint}
            className={`w-full h-auto min-h-11 rounded-xl px-4 py-2.5 text-sm font-bold ${
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
          <p className="text-[11px] leading-5 text-text-muted">
            در Cloudflare ذخیره می‌شود و در همگام‌سازی بعدی به ESP32 می‌رسد.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-semibold text-text-secondary">
            شبکه‌های Wi-Fi برای اتصال ESP32 ({wifiNetworks.length})
          </h4>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  onClick={handleAddNetwork}
                  variant="accent"
                  size="sm"
                  className="rounded-xl gap-1.5 text-xs"
                  type="button"
                >
                  <Plus className="size-3.5" />
                  <span>افزودن شبکه</span>
                </Button>
              }
            />
            <TooltipContent>افزودن شبکه جدید</TooltipContent>
          </Tooltip>
        </div>

        <AnimatePresence initial={false}>
          {wifiNetworks.map((net) =>
            editingId === net.id ? (
              <WifiNetworkEditCard
                key={net.id}
                tempSsid={tempSsid}
                setTempSsid={setTempSsid}
                tempPassword={tempPassword}
                setTempPassword={setTempPassword}
                onSave={() => handleSaveNetwork(net.id)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <WifiNetworkViewCard
                key={net.id}
                net={net}
                onEditStart={() => handleEditNetwork(net.id, net.ssid, net.password)}
                onDelete={() => handleRemoveNetwork(net.id)}
              />
            ),
          )}
        </AnimatePresence>

        {wifiNetworks.length === 0 && (
          <div className="space-y-1.5 rounded-2xl border border-dashed border-border-color bg-card-bg-solid p-6 text-center">
            <Wifi className="mx-auto size-6 text-text-muted opacity-50" />
            <p className="text-xs font-medium text-text-secondary">هنوز شبکه‌ای برای اتصال ESP32 اضافه نشده است</p>
          </div>
        )}
      </div>
    </div>
  );
}
