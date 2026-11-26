import type React from "react";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/ui/delete-button";
import { Edit2, Wifi } from "@/components/ui/hugeicons-groups/controls";
import type { WifiNetwork } from "@/features/iot/hooks/store/types";
import type { WifiCredentialErrors } from "./wifiValidation";
import { WifiNetworkEditor } from "./WifiNetworkEditor";

function WifiNetworkRow({ children }: { children: React.ReactNode }) {
  return <div className="py-4 first:pt-0 last:pb-0">{children}</div>;
}

interface WifiNetworkViewCardProps {
  net: WifiNetwork;
  onEditStart: () => void;
  onDelete: () => void;
}

export function WifiNetworkViewCard({ net, onEditStart, onDelete }: WifiNetworkViewCardProps) {
  return (
    <WifiNetworkRow>
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-bg-main text-text-secondary">
          <Wifi className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-bold text-text-primary">{net.ssid}</p>
          <p className="text-xs text-text-secondary">
            {net.password ? "رمز شبکه ذخیره شده" : "شبکه بدون رمز"}
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
    <WifiNetworkRow>
      <div className="rounded-xl bg-bg-main p-4 sm:p-5">
        <WifiNetworkEditor
          tempSsid={tempSsid}
          setTempSsid={setTempSsid}
          tempPassword={tempPassword}
          setTempPassword={setTempPassword}
          errors={errors}
          onSave={onSave}
          onCancel={onCancel}
        />
      </div>
    </WifiNetworkRow>
  );
}
