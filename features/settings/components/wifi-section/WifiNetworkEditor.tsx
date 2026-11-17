import { Check, X } from "@/components/ui/hugeicons";
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
      <div>
        <Label htmlFor="wifi-network-ssid" className="block text-xs text-text-secondary mb-1">
          نام شبکه (SSID)
        </Label>
        <Input
          id="wifi-network-ssid"
          type="text"
          value={tempSsid}
          onChange={(e) => setTempSsid(e.target.value)}
          placeholder="SSID..."
          className="w-full bg-card-bg-solid border-border-color rounded-xl px-4 py-2.5 text-sm text-text-primary focus:border-accent3"
          dir="ltr"
        />
      </div>
      <div>
        <Label htmlFor="wifi-network-password" className="block text-xs text-text-secondary mb-1">
          رمز عبور (اختیاری)
        </Label>
        <Input
          id="wifi-network-password"
          type="password"
          value={tempPassword}
          onChange={(e) => setTempPassword(e.target.value)}
          placeholder="Password..."
          className="w-full bg-card-bg-solid border-border-color rounded-xl px-4 py-2.5 text-sm text-text-primary focus:border-accent3"
          dir="ltr"
        />
      </div>
      <div className="flex items-center gap-2 pt-2">
        <button
          type="button"
          onClick={onSave}
          className="flex-1 p-2.5 bg-accent3 text-bg-main rounded-xl hover:bg-accent3-dark transition-colors flex items-center justify-center gap-2 shadow-xs"
        >
          <Check aria-hidden="true" className="size-4" />
          <span className="text-sm font-bold">ذخیره</span>
        </button>
        <button
          type="button"
          onClick={onCancel}
          aria-label="لغو ویرایش شبکه"
          className="p-2.5 border border-border-color text-text-secondary rounded-xl hover:border-accent4 hover:text-accent4 transition-colors flex items-center justify-center bg-card-bg-solid"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  );
}
