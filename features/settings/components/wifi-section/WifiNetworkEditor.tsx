import { Check } from "@/components/ui/hugeicons-groups/controls";
import { X } from "@/components/ui/hugeicons-groups/shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  tempSsid: string;
  setTempSsid: (val: string) => void;
  tempPassword: string;
  setTempPassword: (val: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function WifiNetworkEditor({
  tempSsid,
  setTempSsid,
  tempPassword,
  setTempPassword,
  onSave,
  onCancel,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="wifi-network-ssid" className="text-sm font-bold">
          نام شبکه Wi-Fi (SSID)
        </Label>
        <Input
          id="wifi-network-ssid"
          type="text"
          value={tempSsid}
          onChange={(e) => setTempSsid(e.target.value)}
          placeholder="نام شبکه"
          className="h-11 bg-card-bg-solid text-base sm:text-sm"
          dir="auto"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="wifi-network-password" className="text-sm font-bold">
          رمز عبور شبکه
        </Label>
        <Input
          id="wifi-network-password"
          type="password"
          value={tempPassword}
          onChange={(e) => setTempPassword(e.target.value)}
          className="h-11 bg-card-bg-solid text-base sm:text-sm"
          dir="ltr"
        />
      </div>
      <div className="flex items-center gap-2 pt-2">
        <button
          type="button"
          onClick={onSave}
          className="flex-1 min-h-11 p-2.5 bg-accent3 text-accent3-foreground rounded-xl hover:bg-accent3-dark transition-colors flex items-center justify-center gap-2 shadow-xs"
        >
          <Check aria-hidden="true" className="size-4" />
          <span className="text-sm font-bold">ذخیره</span>
        </button>
        <button
          type="button"
          onClick={onCancel}
          aria-label="لغو ویرایش شبکه"
          className="size-11 shrink-0 border border-border-color text-text-secondary rounded-xl hover:border-text-muted hover:text-text-primary transition-colors flex items-center justify-center bg-card-bg-solid"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  );
}
