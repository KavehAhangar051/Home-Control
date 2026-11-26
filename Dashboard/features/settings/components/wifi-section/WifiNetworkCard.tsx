import { m } from "motion/react";
import type React from "react";
import { DeleteButton } from "@/components/ui/delete-button";
import type { WifiNetwork } from "@/features/iot/hooks/store/types";
import { TRANSITION_ENTER_STANDARD, TRANSITION_EXIT_STANDARD } from "@/lib/ease";
import type { WifiCredentialErrors } from "./wifiValidation";
import { WifiNetworkEditor } from "./WifiNetworkEditor";

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
      className="relative overflow-hidden rounded-2xl border border-border-color bg-card-bg-solid p-4 shadow-sm"
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
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="flex min-h-11 flex-1 cursor-pointer flex-col justify-center text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 focus-visible:ring-offset-2"
          onClick={onEditStart}
          aria-label={`ویرایش شبکه ${net.ssid}`}
        >
          <span className="mb-1 font-bold text-sm text-text-primary">{net.ssid}</span>
          <span className="text-xs text-text-secondary">
            {net.password ? "رمز عبور ذخیره شده" : "شبکهٔ بدون رمز"}
          </span>
        </button>
        <DeleteButton
          size="sm"
          resetAfter={0}
          onConfirm={onDelete}
          label={`حذف شبکه ${net.ssid}`}
          className="ms-2 min-h-11 min-w-11 shrink-0"
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
  errors: WifiCredentialErrors;
  onSave: () => void;
  onCancel: () => void;
}

export function WifiNetworkEditCard({
  tempSsid,
  setTempSsid,
  tempPassword,
  setTempPassword,
  errors,
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
        errors={errors}
        onSave={onSave}
        onCancel={onCancel}
      />
    </WifiNetworkCardFrame>
  );
}
