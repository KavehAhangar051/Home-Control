import { AnimatePresence } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Wifi } from "@/components/ui/hugeicons-groups/controls";
import { Plus } from "@/components/ui/hugeicons-groups/shell";
import type { WifiNetwork } from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { WifiNetworkEditCard, WifiNetworkViewCard } from "./WifiNetworkCard";
import { MAX_WIFI_NETWORKS, validateWifiNetwork } from "./wifiValidation";

export function WifiNetworksSection() {
  const wifiNetworks = useIoTStore((state) => state.wifiNetworks);
  const setWifiNetworks = useIoTStore((state) => state.setWifiNetworks);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftNewNetwork, setDraftNewNetwork] = useState<WifiNetwork | null>(null);
  const [tempSsid, setTempSsid] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [networkErrors, setNetworkErrors] = useState<ReturnType<typeof validateWifiNetwork>>({});

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

  const canAddNetwork = wifiNetworks.length < MAX_WIFI_NETWORKS && editingId === null;

  return (
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

      {wifiNetworks.length === 1 ? (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-xs leading-5 text-amber-800 dark:text-amber-300">
          حذف آخرین شبکه باعث راه‌اندازی مجدد ESP32 و بازگشت آن به اکسس‌پوینت راه‌اندازی می‌شود.
        </p>
      ) : null}

      <AnimatePresence initial={false}>
        {draftNewNetwork && editingId === draftNewNetwork.id ? (
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
        ) : null}
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

      {wifiNetworks.length === 0 && !draftNewNetwork ? (
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
      ) : null}

      {wifiNetworks.length >= MAX_WIFI_NETWORKS ? (
        <p className="text-xs text-text-muted">
          ظرفیت پنج شبکه تکمیل شده است. برای افزودن شبکهٔ دیگر، ابتدا یکی را حذف کنید.
        </p>
      ) : null}
    </section>
  );
}
