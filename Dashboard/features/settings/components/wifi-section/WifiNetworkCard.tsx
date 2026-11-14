import { m } from "motion/react";
import type React from "react";
import { DeleteButton } from "@/components/ui/delete-button";
import type { WifiNetwork } from "@/features/iot/hooks/store/types";
import { TRANSITION_ENTER_STANDARD, TRANSITION_EXIT_STANDARD } from "@/lib/ease";
import { WifiNetworkEditor } from "./WifiNetworkEditor";

interface Props {
  net: WifiNetwork;
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
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{
        opacity: 0,
        y: -12,
        transition: TRANSITION_EXIT_STANDARD,
      }}
      transition={TRANSITION_ENTER_STANDARD}
      className="p-4 bg-[var(--card-bg-solid)] border border-[var(--border-color)] rounded-2xl shadow-sm relative overflow-hidden"
    >
      {children}
    </m.div>
  );
}

interface WifiNetworkViewCardProps {
  net: WifiNetwork;
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
        <DeleteButton
          size="sm"
          resetAfter={0}
          onConfirm={onDelete}
          label={`حذف شبکه ${net.ssid}`}
          className="ml-2 shrink-0"
        />
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
