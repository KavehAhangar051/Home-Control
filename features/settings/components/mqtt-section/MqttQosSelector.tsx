import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { soundManager } from "@/lib/audio";

interface Props {
  qos: 0 | 1 | 2;
  setQos: (val: 0 | 1 | 2) => void;
}

export function MqttQosSelector({ qos, setQos }: Props) {
  return (
    <fieldset className="space-y-2 text-right pt-2">
      <legend className="text-xs font-bold text-text-primary px-1">کیفیت تحویل پیام (QoS)</legend>
      <ToggleGroup
        variant="outline"
        spacing={2}
        value={[String(qos)]}
        onValueChange={(vals) => {
          const num = Number(vals[0]);

          if (num === 0 || num === 1 || num === 2) {
            soundManager.playClick();
            setQos(num);
          }
        }}
        className="grid w-full grid-cols-3"
      >
        {([0, 1, 2] as const).map((q) => (
          <ToggleGroupItem
            key={q}
            value={String(q)}
            className="h-9 w-full rounded-xl text-xs font-mono aria-pressed:bg-accent3-transparent aria-pressed:border-accent3 aria-pressed:text-accent3"
          >
            QoS {q}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="text-[11px] text-text-muted pt-1 px-1">
        {qos === 0 && "بدون تأیید یا ارسال مجدد · پیام ممکن است از دست برود"}
        {qos === 1 && "با تأیید و ارسال مجدد در صورت نیاز · ممکن است پیام تکراری برسد"}
        {qos === 2 && "تحویل دقیقاً یک‌بار در ارتباط MQTT · بیشترین سربار ارتباطی"}
      </p>
    </fieldset>
  );
}
