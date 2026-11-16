import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { soundManager } from "@/lib/audio";

interface Props {
  qos: 0 | 1 | 2;
  setQos: (val: 0 | 1 | 2) => void;
}

export function MqttQosSelector({ qos, setQos }: Props) {
  return (
    <fieldset className="space-y-2 text-right pt-2">
      <legend className="text-xs font-bold text-[var(--text-primary)] px-1">
        کیفیت سرویس (QoS)
      </legend>
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
            className="h-9 w-full rounded-xl text-xs font-mono aria-pressed:bg-[var(--accent3-transparent)] aria-pressed:border-[var(--accent3)] aria-pressed:text-[var(--accent3)]"
          >
            QoS {q}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="text-[9px] text-[var(--text-muted)] pt-1 px-1">
        {qos === 0 && "ارسال حداکثر یکبار. بدون تضمین تحویل."}
        {qos === 1 && "ارسال حداقل یکبار. تضمین تحویل با احتمال تکرار."}
        {qos === 2 && "ارسال دقیقا یکبار. امن‌ترین و کندترین حالت."}
      </p>
    </fieldset>
  );
}
