import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MqttQosSelector } from "./MqttQosSelector";
import type { MqttValidationErrors } from "./mqttValidation";

interface MqttMessageSettingsStepProps {
  baseTopic: string;
  setBaseTopic: (val: string) => void;
  qos: 0 | 1 | 2;
  setQos: (val: 0 | 1 | 2) => void;
  errors: MqttValidationErrors;
}

export function MqttMessageSettingsStep({
  baseTopic,
  setBaseTopic,
  qos,
  setQos,
  errors,
}: MqttMessageSettingsStepProps) {
  const previewTopic = baseTopic.trim() || "KamyarIoT/Achaemenid";

  return (
    <div className="space-y-7">
      <div className="space-y-2.5">
        <Label htmlFor="mqtt-base-topic" className="text-sm font-bold text-text-primary">
          پیشوند موضوع پایه (Base Topic)
        </Label>
        <p
          id="mqtt-base-topic-help"
          className="text-xs leading-5 text-text-secondary sm:text-[13px]"
        >
          تمام پیام‌های فرمان، وضعیت و حضور برد با این پیشوند مبادله می‌شوند.
        </p>
        <Input
          id="mqtt-base-topic"
          type="text"
          dir="ltr"
          autoCapitalize="none"
          spellCheck={false}
          required
          aria-invalid={Boolean(errors.baseTopic)}
          aria-describedby={
            errors.baseTopic ? "mqtt-base-topic-help mqtt-base-topic-error" : "mqtt-base-topic-help"
          }
          value={baseTopic}
          onChange={(event) => setBaseTopic(event.target.value)}
          placeholder="KamyarIoT/Achaemenid"
          className="h-11 font-mono text-base sm:text-sm"
        />
        {errors.baseTopic && (
          <p
            id="mqtt-base-topic-error"
            className="text-xs leading-5 text-red-700 dark:text-red-300"
          >
            {errors.baseTopic}
          </p>
        )}

        <div className="rounded-xl border border-border-color bg-bg-main p-3 text-[11px] text-text-secondary">
          <span className="block mb-1.5 font-semibold text-text-primary">موضوعات تولیدشده:</span>
          <div dir="ltr" className="space-y-1 font-mono text-text-muted">
            <div className="truncate">{previewTopic}/Command</div>
            <div className="truncate">{previewTopic}/State</div>
            <div className="truncate">{previewTopic}/Status</div>
          </div>
        </div>
      </div>

      <MqttQosSelector qos={qos} setQos={setQos} />
    </div>
  );
}
