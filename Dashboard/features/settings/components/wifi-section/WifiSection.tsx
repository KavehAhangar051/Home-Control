import React, { useState } from "react";
import { Plus, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { AnimatePresence } from "motion/react";
import { WifiNetworkEditCard, WifiNetworkViewCard } from "./WifiNetworkCard";

export default function WifiSection() {
  const wifiNetworks = useIoTStore((s) => s.wifiNetworks);
  const setWifiNetworks = useIoTStore((s) => s.setWifiNetworks);

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
        <Button
          onClick={handleAddNetwork}
          variant="default"
          size="icon"
          className="rounded-xl bg-[var(--accent3)] text-white shadow-sm transition-colors hover:bg-[var(--accent3-dark)] hover:text-white focus-visible:ring-[var(--accent3)]"
          title="افزودن شبکه جدید"
          aria-label="افزودن شبکه جدید"
          type="button"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed">
        در این بخش می‌توانید اطلاعات شبکه‌های وای‌فای (SSID و رمز عبور) را برای تراشه ESP32 تعریف کنید.
        تراشه به هنگام راه‌اندازی به ترتیب به این شبکه‌ها متصل خواهد شد.
      </p>

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
