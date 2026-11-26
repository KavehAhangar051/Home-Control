import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/ui/delete-button";
import { Edit2 } from "@/components/ui/hugeicons-groups/controls";
import type { WifiNetwork } from "@/features/iot/hooks/store/types";
import type { WifiCredentialErrors } from "./wifiValidation";
import { WifiNetworkEditor } from "./WifiNetworkEditor";

function WifiNetworkRow({ children }: { children: ReactNode }) {
  return <div className="py-4">{children}</div>;
}

interface WifiNetworkViewCardProps {
  net: WifiNetwork;
  position: number;
  onEditStart: () => void;
  onDelete: () => void;
}

export function WifiNetworkViewCard({
  net,
  position,
  onEditStart,
  onDelete,
}: WifiNetworkViewCardProps) {
  return (
    <WifiNetworkRow>
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3">
        <span className="w-6 shrink-0 text-xs tabular-nums text-text-secondary">
          {position}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-semibold text-text-primary">{net.ssid}</p>
          <p className="text-xs text-text-secondary">
            {net.password ? "رمز عبور ذخیره شده" : "شبکه بدون رمز"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onEditStart}
            className="min-h-11 gap-1.5 px-3 text-xs"
            aria-label={`ویرایش شبکه ${net.ssid}`}
          >
            <Edit2 className="size-4" aria-hidden="true" />
            ویرایش
          </Button>
          <DeleteButton
            size="sm"
            cornerRadius={6}
            resetAfter={0}
            onConfirm={onDelete}
            label={`حذف شبکه ${net.ssid}`}
            className="min-h-11 min-w-11 shrink-0"
          />
        </div>
      </div>
    </WifiNetworkRow>
  );
}

interface WifiNetworkEditCardProps {
  title: string;
  tempSsid: string;
  setTempSsid: (val: string) => void;
  tempPassword: string;
  setTempPassword: (val: string) => void;
  errors: WifiCredentialErrors;
  onSave: () => void;
  onCancel: () => void;
}

export function WifiNetworkEditCard({
  title,
  tempSsid,
  setTempSsid,
  tempPassword,
  setTempPassword,
  errors,
  onSave,
  onCancel,
}: WifiNetworkEditCardProps) {
  return (
    <WifiNetworkRow>
      <WifiNetworkEditor
        title={title}
        tempSsid={tempSsid}
        setTempSsid={setTempSsid}
        tempPassword={tempPassword}
        setTempPassword={setTempPassword}
        errors={errors}
        onSave={onSave}
        onCancel={onCancel}
      />
    </WifiNetworkRow>
  );
}
