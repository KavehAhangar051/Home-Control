import { useState } from "react";
import { Button } from "@/components/ui/button";
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
    <section
      aria-labelledby="wifi-networks-heading"
      className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(12rem,0.8fr)_minmax(0,1.7fr)] lg:gap-10"
    >
      <div className="space-y-2">
        <h3 id="wifi-networks-heading" className="text-sm font-bold text-text-primary">
          شبکه‌های Wi-Fi
        </h3>
        <p className="max-w-xs text-sm leading-6 text-text-secondary">
          ESP32 شبکه‌ها را به‌ترتیب فهرست برای اتصال به روتر امتحان می‌کند.
        </p>
        <p className="text-xs tabular-nums text-text-secondary">
          {wifiNetworks.length} از {MAX_WIFI_NETWORKS} شبکه
        </p>
      </div>

      <div className="min-w-0 space-y-3">
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={handleAddNetwork}
            variant="accent"
            disabled={!canAddNetwork}
            className="min-h-11 gap-2"
          >
            <Plus className="size-4" aria-hidden="true" />
            افزودن شبکه
          </Button>
        </div>

        {wifiNetworks.length === 1 ? (
          <p className="text-xs leading-5 text-amber-800 dark:text-amber-300">
            با حذف آخرین شبکه، ESP32 برای راه‌اندازی به اکسس‌پوینت مستقل خود برمی‌گردد.
          </p>
        ) : null}

        {wifiNetworks.length > 0 || draftNewNetwork ? (
          <div className="divide-y divide-border-color/70 border-y border-border-color/70">
            {wifiNetworks.map((network, index) =>
              editingId === network.id ? (
                <WifiNetworkEditCard
                  key={network.id}
                  title="ویرایش شبکه"
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
                  position={index + 1}
                  onEditStart={() => handleEditNetwork(network.id, network.ssid, network.password)}
                  onDelete={() => handleRemoveNetwork(network.id)}
                />
              ),
            )}

            {draftNewNetwork && editingId === draftNewNetwork.id ? (
              <WifiNetworkEditCard
                key={draftNewNetwork.id}
                title="افزودن شبکه"
                tempSsid={tempSsid}
                setTempSsid={setTempSsid}
                tempPassword={tempPassword}
                setTempPassword={setTempPassword}
                errors={networkErrors}
                onSave={() => handleSaveNetwork(draftNewNetwork.id)}
                onCancel={handleCancelNetworkEdit}
              />
            ) : null}
          </div>
        ) : (
          <p className="border-y border-border-color/70 py-5 text-sm text-text-secondary">
            هنوز شبکه‌ای ثبت نشده است. برای اتصال ESP32، نام شبکه و رمز روتر را اضافه کنید.
          </p>
        )}

        {wifiNetworks.length >= MAX_WIFI_NETWORKS ? (
          <p className="text-xs text-text-secondary">
            ظرفیت ذخیره‌سازی تکمیل است؛ برای افزودن شبکه، یکی از موارد فعلی را حذف کنید.
          </p>
        ) : null}
      </div>
    </section>
  );
}
