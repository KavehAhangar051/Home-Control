import React from "react";
import { Trash2 } from "@/components/ui/hugeicons";
import { motion } from "motion/react";
import { WifiNetworkEditor } from "./WifiNetworkEditor";

interface Props {
  net: any;
  isEditing: boolean;
  tempSsid: string;
  setTempSsid: (val: string) => void;
  tempPassword: string;
  setTempPassword: (val: string) => void;
  onEditStart: () => void;
  onDelete: () => void;
  onSave: () => void;
  onCancel: () => void;
}

function WifiNetworkCardFrame({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{
        opacity: 0,
        y: -12,
        filter: "blur(4px)",
        transition: { duration: 0.15, ease: "easeOut" },
      }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="p-4 bg-[var(--card-bg-solid)] border border-[var(--border-color)] rounded-2xl shadow-sm relative overflow-hidden"
    >
      {children}
    </motion.div>
  );
}

interface WifiNetworkViewCardProps {
  net: any;
  onEditStart: () => void;
  onDelete: () => void;
}

export function WifiNetworkViewCard({ net, onEditStart, onDelete }: WifiNetworkViewCardProps) {
  return (
    <WifiNetworkCardFrame>
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="flex-1 cursor-pointer text-right"
          onClick={onEditStart}
          aria-label={`ویرایش شبکه ${net.ssid}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-sm text-[var(--text-primary)]">{net.ssid}</span>
          </div>
          <div className="text-xs text-[var(--text-secondary)] opacity-70">
            {net.password ? "رمز عبور تنظیم شده" : "بدون رمز عبور"}
          </div>
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-2 text-[var(--accent4)] hover:bg-[var(--accent4-transparent)] border border-transparent hover:border-[var(--accent4)] rounded-xl transition-[background-color,border-color,color,scale] duration-150 ease-out active:scale-[0.96] ml-2"
          title="حذف شبکه"
          aria-label={`حذف شبکه ${net.ssid}`}
        >
          <Trash2 className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>
    </WifiNetworkCardFrame>
  );
}

interface WifiNetworkEditCardProps {
  tempSsid: string;
  setTempSsid: (val: string) => void;
  tempPassword: string;
  setTempPassword: (val: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function WifiNetworkEditCard({
  tempSsid,
  setTempSsid,
  tempPassword,
  setTempPassword,
  onSave,
  onCancel,
}: WifiNetworkEditCardProps) {
  return (
    <WifiNetworkCardFrame>
      <WifiNetworkEditor
        tempSsid={tempSsid}
        setTempSsid={setTempSsid}
        tempPassword={tempPassword}
        setTempPassword={setTempPassword}
        onSave={onSave}
        onCancel={onCancel}
      />
    </WifiNetworkCardFrame>
  );
}

export function WifiNetworkCard({
  net,
  isEditing,
  tempSsid,
  setTempSsid,
  tempPassword,
  setTempPassword,
  onEditStart,
  onDelete,
  onSave,
  onCancel,
}: Props) {
  if (isEditing) {
    return (
      <WifiNetworkEditCard
        tempSsid={tempSsid}
        setTempSsid={setTempSsid}
        tempPassword={tempPassword}
        setTempPassword={setTempPassword}
        onSave={onSave}
        onCancel={onCancel}
      />
    );
  }

  return <WifiNetworkViewCard net={net} onEditStart={onEditStart} onDelete={onDelete} />;
}
