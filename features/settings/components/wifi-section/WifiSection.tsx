import { AnimatePresence } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Wifi } from "@/components/ui/hugeicons";
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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Wifi className="w-5 h-5 text-[var(--accent3)]" />
          تنظیمات شبکه‌های وای‌فای
        </h3>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                onClick={handleAddNetwork}
                variant="default"
                size="icon"
                className="rounded-xl bg-[var(--accent3)] text-[var(--bg-main)] shadow-sm transition-colors hover:bg-[var(--accent3-dark)] hover:text-[var(--bg-main)] focus-visible:ring-[var(--accent3)]"
                aria-label="افزودن شبکه جدید"
                type="button"
              >
                <Plus className="w-4 h-4" />
              </Button>
            }
          />
          <TooltipContent>افزودن شبکه جدید</TooltipContent>
        </Tooltip>
      </div>

      <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed">
        در این بخش می‌توانید اطلاعات شبکه‌های وای‌فای (SSID و رمز عبور) را برای تراشه ESP32 تعریف کنید.
        تراشه به هنگام راه‌اندازی به ترتیب به این شبکه‌ها متصل خواهد شد.
      </p>

      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg-solid)] p-4 space-y-3">
        <div>
          <h4 className="text-sm font-bold text-[var(--text-primary)]">
            اکسس‌پوینت راه‌اندازی ESP32
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
            این نام و رمز هنگام فعال شدن حالت Provisioning استفاده می‌شوند. اگر هر دو فیلد خالی
            باشند، مقادیر پیش‌فرض مبتنی بر MAC دستگاه استفاده می‌شوند.
          </p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="esp-ap-ssid" className="text-xs font-semibold text-[var(--text-primary)]">
            نام شبکه (SSID)
          </label>
          <input
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
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent3)]"
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="esp-ap-password"
            className="text-xs font-semibold text-[var(--text-primary)]"
          >
            رمز عبور اکسس‌پوینت
          </label>
          <input
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
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent3)]"
          />
        </div>
        {(apSsid.trim() || apPassword) &&
          (!apSsid.trim() || apPassword.length < 8 || apSsid.length > 32) && (
            <p className="text-xs text-red-500" role="alert">
              رمز AP سفارشی باید حداقل ۸ کاراکتر باشد.
            </p>
          )}
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
          <div className="text-center p-6 bg-[var(--card-bg-solid)] rounded-2xl border border-dashed border-[var(--border-color)] space-y-2">
            <Wifi className="w-7 h-7 mx-auto text-[var(--text-secondary)] opacity-45" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              هنوز شبکه وای‌فای ثبت نشده است
            </p>
            <p className="text-xs text-[var(--text-secondary)] max-w-xs mx-auto leading-relaxed">
              نام شبکه (SSID) و رمز عبور مودم را اضافه کنید تا برد ESP32 هنگام راه‌اندازی به آن متصل
              شود.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
