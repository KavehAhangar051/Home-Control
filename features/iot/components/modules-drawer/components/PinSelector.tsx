import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PinSelectorProps {
  customPin: string;
  setCustomPin: (val: string) => void;
}

export default function PinSelector({ customPin, setCustomPin }: PinSelectorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="esp32-hardware-pin" className="w-full text-right">
          پایه سخت‌افزاری (GPIO)
        </Label>
      </div>
      <Input
        id="esp32-hardware-pin"
        type="text"
        placeholder="مثال: 14"
        value={customPin}
        onChange={(e) => setCustomPin(e.target.value.replace(/[^0-9]/g, ""))}
        className="text-xs font-mono tabular-nums rounded-lg text-right placeholder:font-sans"
        dir="ltr"
      />
    </div>
  );
}
