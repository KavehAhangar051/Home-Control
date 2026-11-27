"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Info } from "@/components/ui/hugeicons-groups/controls";
import { Plus } from "@/components/ui/hugeicons-groups/shell";
import { persistStoreConfigToCloudflare } from "@/features/iot/hooks/achaemenidState/core/buildEspConfig";
import type { WifiNetwork } from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { isCloudflareEnabled } from "@/features/iot/services/cloudflareService";
import { soundManager } from "@/lib/audio";
import { WifiNetworkEditCard, WifiNetworkViewCard } from "./WifiNetworkCard";
import {
  MAX_WIFI_NETWORKS,
  validateWifiNetworkCredentials,
  type WifiCredentialErrors,
} from "./wifiValidation";

export function WifiNetworksSection() {
  const wifiNetworks = useIoTStore((state) => state.wifiNetworks);
  const setWifiNetworks = useIoTStore((state) => state.setWifiNetworks);
  const showToast = useIoTStore((state) => state.showToast);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tempSsid, setTempSsid] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [errors, setErrors] = useState<WifiCredentialErrors>({});

  const isMaxReached = wifiNetworks.length >= MAX_WIFI_NETWORKS;
  const isFormOpen = isAdding || editingId !== null;

  const resetDraft = () => {
    setIsAdding(false);
    setEditingId(null);
    setTempSsid("");
    setTempPassword("");
    setErrors({});
  };

  const startAdding = () => {
    if (isMaxReached || isSaving) return;
    setEditingId(null);
    setTempSsid("");
    setTempPassword("");
    setErrors({});
    setIsAdding(true);
  };

  const startEditing = (net: WifiNetwork) => {
    if (isSaving) return;
    setIsAdding(false);
    setEditingId(net.id);
    setTempSsid(net.ssid);
    setTempPassword(net.password ?? "");
    setErrors({});
  };

  const commitNetworks = async (
    nextNetworks: WifiNetwork[],
    successMsg: string,
    closeFormOnSuccess: boolean,
  ) => {
    const previousNetworks = wifiNetworks;
    setWifiNetworks(nextNetworks);

    if (!isCloudflareEnabled()) {
      showToast(successMsg, "success");
      if (closeFormOnSuccess) resetDraft();
      return;
    }

    setIsSaving(true);
    try {
      const { result } = await persistStoreConfigToCloudflare({
        overrides: {
          wifiNetworks: nextNetworks,
          wifiNetworksConfigured: true,
        },
      });

      if (result.success) {
        if (closeFormOnSuccess) resetDraft();
      } else {
        setWifiNetworks(previousNetworks);
        showToast(result.message || "خطا در ذخیره شبکه‌های وای‌فای در کلودفلر.", "error");
      }
    } catch {
      setWifiNetworks(previousNetworks);
      showToast("خطا در ارتباط با سرور کلودفلر؛ تغییرات بازگردانی شد.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDraft = () => {
    if (isSaving) return;
    soundManager.playClick();

    if (isAdding && isMaxReached) {
      showToast(`حداکثر ${MAX_WIFI_NETWORKS} شبکه وای‌فای پشتیبانی می‌شود.`, "error");
      return;
    }

    const validationErrors = validateWifiNetworkCredentials({
      ssid: tempSsid,
      password: tempPassword,
      existingNetworks: wifiNetworks,
      editingNetworkId: editingId,
    });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const cleanSsid = tempSsid.trim();
    const cleanPassword = tempPassword || undefined;

    if (isAdding) {
      const created: WifiNetwork = {
        id: `wifi_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        ssid: cleanSsid,
        ...(cleanPassword ? { password: cleanPassword } : {}),
      };
      void commitNetworks([...wifiNetworks, created], `شبکه «${cleanSsid}» ذخیره شد.`, true);
      return;
    }

    if (editingId) {
      const nextNetworks = wifiNetworks.map((net) =>
        net.id === editingId
          ? {
              ...net,
              ssid: cleanSsid,
              ...(cleanPassword ? { password: cleanPassword } : { password: "" }),
            }
          : net,
      );
      void commitNetworks(nextNetworks, `تغییرات شبکه «${cleanSsid}» ذخیره شد.`, true);
    }
  };

  const handleDeleteNetwork = (target: WifiNetwork) => {
    if (isSaving) return;
    soundManager.playClick();
    const nextNetworks = wifiNetworks.filter((net) => net.id !== target.id);
    if (editingId === target.id) {
      resetDraft();
    }
    void commitNetworks(
      nextNetworks,
      nextNetworks.length === 0
        ? "آخرین شبکه حذف شد؛ ESP32 در اتصال بعدی وارد حالت اکسس‌پوینت می‌شود."
        : `شبکه «${target.ssid}» حذف شد.`,
      false,
    );
  };

  return (
    <section
      aria-labelledby="wifi-networks-heading"
      className="grid grid-cols-1 gap-6 lg:grid-cols-12"
    >
      <div className="space-y-3 lg:col-span-5 text-right">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <h3 id="wifi-networks-heading" className="text-sm font-bold text-text-primary">
              شبکه‌های وای‌فای ذخیره‌شده
            </h3>
            <span
              dir="ltr"
              className="rounded-md border border-border-color bg-bg-main px-2 py-0.5 font-mono text-xs tabular-nums text-text-secondary"
            >
              {wifiNetworks.length} / {MAX_WIFI_NETWORKS}
            </span>
          </div>
          <p className="text-xs leading-5 text-text-secondary">
            ESP32 به‌ترتیب فهرست به اولین شبکهٔ در دسترس متصل می‌شود. حداکثر {MAX_WIFI_NETWORKS} شبکه
            قابل ثبت است.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={startAdding}
          disabled={isMaxReached || isFormOpen || isSaving}
          className="min-h-11 w-full justify-center gap-1.5 sm:w-auto"
        >
          <Plus className="size-4" aria-hidden="true" />
          افزودن شبکه جدید
        </Button>

        {isMaxReached && (
          <p className="text-[11px] text-amber-700 dark:text-amber-300">
            حداکثر ظرفیت فهرست ({MAX_WIFI_NETWORKS} شبکه) تکمیل شده است.
          </p>
        )}

        {wifiNetworks.length === 1 && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-[11px] leading-5 text-amber-800 dark:text-amber-200">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              با حذف تنها شبکهٔ باقی‌مانده، ESP32 پس از راه‌اندازی مجدد به حالت اکسس‌پوینت (AP)
              برمی‌گردد.
            </span>
          </div>
        )}
      </div>

      <div className="min-w-0 lg:col-span-7">
        {wifiNetworks.length === 0 && !isAdding ? (
          <div className="rounded-xl border border-dashed border-border-color bg-bg-main/50 p-6 text-center text-xs text-text-secondary">
            هنوز شبکهٔ وای‌فایی ثبت نشده است.
          </div>
        ) : (
          <div className="divide-y divide-border-color/70">
            {wifiNetworks.map((net, index) =>
              editingId === net.id ? (
                <WifiNetworkEditCard
                  key={net.id}
                  title={`ویرایش شبکه «${net.ssid}»`}
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
                  onSave={handleSaveDraft}
                  onCancel={resetDraft}
                />
              ) : (
                <WifiNetworkViewCard
                  key={net.id}
                  net={net}
                  position={index + 1}
                  onEditStart={() => startEditing(net)}
                  onDelete={() => handleDeleteNetwork(net)}
                />
              ),
            )}

            {isAdding && (
              <WifiNetworkEditCard
                title="افزودن شبکه وای‌فای جدید"
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
                onSave={handleSaveDraft}
                onCancel={resetDraft}
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}
