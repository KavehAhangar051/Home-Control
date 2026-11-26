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
  }

  const canAddNetwork = wifiNetworks.length < MAX_WIFI_NETWORKS && editingId === null;

  return (
    <section aria-labelledby="wifi-networks-heading" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h3 id="wifi-networks-heading" className="text-lg font-bold text-text-primary sm:text-xl">
            شبکه‌های Wi-Fi
          </h3>
          <p className="text-xs text-text-secondary">
            ESP32 برای اتصال به شبکهٔ محلی، این فهرست را به‌ترتیب بررسی می‌کند.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-xs tabular-nums text-text-secondary">
            {wifiNetworks.length} از {MAX_WIFI_NETWORKS}
          </span>
          <Button
            type="button"
            onClick={handleAddNetwork}
            variant="accent"
            size="sm"
            disabled={!canAddNetwork}
            className="min-h-11 gap-1.5 rounded-xl text-xs"
          >
            <Plus className="size-3.5" />
            افزودن شبکه
          </Button>
        </div>
      </div>


      {wifiNetworks.length === 1 ? (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-xs leading-5 text-amber-800 dark:text-amber-300">
          با حذف آخرین شبکه، ESP32 دیگر اطلاعاتی برای اتصال به روتر ندارد و برای راه‌اندازی، به اکسس‌پوینت مستقل خود برمی‌گردد.
        </p>
      ) : null}

      <div className="divide-y divide-border-color/70">
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
      </div>

      {wifiNetworks.length === 0 && !draftNewNetwork ? (
        <div className="space-y-3 rounded-xl bg-bg-main p-5 text-center">
          <Wifi className="mx-auto size-7 text-text-muted" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-text-primary">شبکه‌ای اضافه نشده است</p>
            <p className="text-xs leading-5 text-text-secondary">
              برای اتصال ESP32 به روتر، نام شبکه و رمز آن را ثبت کنید.
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
          ظرفیت ذخیره‌سازی ESP32 تکمیل شده است؛ برای افزودن شبکه، یکی از موارد فعلی را حذف کنید.
        </p>
      ) : null}
    </section>
  );
}
