import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MqttQosSelector } from "./MqttQosSelector";

interface Props {
  baseTopic: string;
  setBaseTopic: (val: string) => void;
  qos: 0 | 1 | 2;
  setQos: (val: 0 | 1 | 2) => void;
}

export function MqttMessageSettingsStep({
  baseTopic,
  setBaseTopic,
  qos,
  setQos,
}: Props) {
  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <Label htmlFor="mqtt-base-topic" className="text-sm font-bold text-text-primary">
          پیشوند موضوع‌ها (Base Topic)
        </Label>
        <p id="mqtt-base-topic-help" className="text-xs leading-5 text-text-secondary sm:text-[13px]">
          این پیشوند باید با مقدار تنظیم‌شده در فریمور ESP32 یکسان باشد.
        </p>
        <Input
          id="mqtt-base-topic"
          aria-describedby="mqtt-base-topic-help"
          type="text"
          dir="ltr"
          autoCapitalize="none"
          spellCheck={false}
          value={baseTopic}
          onChange={(event) => setBaseTopic(event.target.value)}
          className="h-11 font-mono text-base sm:text-sm"
          placeholder="KamyarIoT/Achaemenid"
        />
      </div>

      <MqttQosSelector qos={qos} setQos={setQos} />
    </div>
  );
}
