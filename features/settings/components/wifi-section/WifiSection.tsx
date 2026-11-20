import { AnimatePresence } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Wifi } from "@/components/ui/hugeicons-groups/controls";
import { Plus } from "@/components/ui/hugeicons-groups/shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { WifiNetworkEditCard, WifiNetworkViewCard } from "./WifiNetworkCard";

export default function WifiSection() {
  const wifiNetworks = useIoTStore((s) => s.wifiNetworks);
  const setWifiNetworks = useIoTStore((s) => s.setWifiNetworks);
  const wifiApConfig = useIoTStore((s) => s.wifiApConfig);
  const setWifiApConfig = useIoTStore((s) => s.setWifiApConfig);
  const apSsid = wifiApConfig?.ssid ?? "";
  const apPassword = wifiApConfig?.password ?? "";

  const apPasswordError =
    (apSsid.trim() || apPassword) && (!apSsid.trim() || apPassword.length < 8 || apSsid.length > 32)
      ? "رمز AP سفارشی باید حداقل ۸ کاراکتر باشد."
      : undefined;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempSsid, setTempSsid] = useState("");
  const [tempPassword, setTempPassword] = useState("");

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
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-bold text-text-primary">
          <Wifi className="size-5 text-accent3" />
          تنظیمات شبکه‌های وای‌فای
        </h3>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                onClick={handleAddNetwork}
                variant="accent"
                size="icon"
                className="rounded-xl"
                aria-label="افزودن شبکه جدید"
                type="button"
              >
                <Plus className="size-4" />
              </Button>
            }
          />
          <TooltipContent>افزودن شبکه جدید</TooltipContent>
        </Tooltip>
      </div>

      <p className="mb-4 text-sm leading-relaxed text-text-secondary">
        اطلاعات شبکه‌های وای‌فای (SSID و رمز عبور) را برای ESP32 ثبت کنید. تراشه هنگام راه‌اندازی به
        ترتیب به این شبکه‌ها وصل می‌شود.
      </p>

      <div className="surface-panel space-y-3 p-4">
        <div>
          <h4 className="text-sm font-bold text-text-primary">اکسس‌پوینت راه‌اندازی ESP32</h4>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">
            این نام و رمز هنگام فعال شدن حالت Provisioning استفاده می‌شوند. اگر هر دو فیلد خالی
            باشند، مقادیر پیش‌فرض مبتنی بر MAC دستگاه استفاده می‌شوند.
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
            onChange={(event) =>
              setWifiApConfig({
                ...(wifiApConfig ?? { ssid: "", password: "" }),
                ssid: event.target.value,
              })
            }
            placeholder="Achaemenid-XXXXXX"
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
            onChange={(event) =>
              setWifiApConfig({
                ...(wifiApConfig ?? { ssid: "", password: "" }),
                password: event.target.value,
              })
            }
            placeholder="حداقل ۸ کاراکتر"
            error={apPasswordError}
          />
        </div>
      </div>

      <div className="space-y-4">
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
          <div className="space-y-2 rounded-2xl border border-dashed border-border-color bg-card-bg-solid p-6 text-center">
            <Wifi className="mx-auto size-7 text-text-secondary opacity-45" />
            <p className="text-sm font-semibold text-text-primary">هنوز شبکه وای‌فای ثبت نشده است</p>
            <p className="mx-auto max-w-xs text-xs leading-relaxed text-text-secondary">
              نام شبکه (SSID) و رمز عبور مودم را اضافه کنید تا برد ESP32 هنگام راه‌اندازی به آن متصل
              شود.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
