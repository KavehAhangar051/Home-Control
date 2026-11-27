import { Check } from "@/components/ui/hugeicons-groups/controls";
import { soundManager } from "@/lib/audio";

interface Props {
  qos: 0 | 1 | 2;
  setQos: (val: 0 | 1 | 2) => void;
}

const QOS_OPTIONS = [
  {
    value: 0,
    title: "بدون تأیید",
    description: "کمترین سربار ارتباطی؛ پیام ممکن است از دست برود.",
  },
  {
    value: 1,
    title: "تحویل با تأیید",
    description: "در صورت نیاز ارسال مجدد؛ احتمال دریافت پیام تکراری.",
  },
  {
    value: 2,
    title: "تحویل دقیقاً یک‌بار",
    description: "بیشترین سربار ارتباطی در میان سه سطح.",
  },
] as const;

export function MqttQosSelector({ qos, setQos }: Props) {
  return (
    <fieldset className="space-y-3 text-right">
      <legend className="text-sm font-bold text-text-primary">کیفیت تحویل پیام (QoS)</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {QOS_OPTIONS.map((option) => {
          const isSelected = qos === option.value;

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isSelected}
              aria-describedby={`mqtt-qos-${option.value}-description`}
              onClick={() => {
                soundManager.playClick();
                setQos(option.value);
              }}
              className={`relative flex min-h-28 cursor-pointer flex-col items-start gap-2 rounded-xl border p-4 text-start transition-[border-color,background-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset ${
                isSelected
                  ? "border-accent3 bg-accent3/10 ring-1 ring-accent3/25"
                  : "border-border-color bg-bg-main hover:border-text-muted/50 hover:bg-card-hover-bg"
              }`}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="text-sm font-bold text-text-primary">QoS {option.value}</span>
                <span
                  aria-hidden="true"
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                    isSelected
                      ? "border-accent3 bg-accent3 text-accent3-foreground"
                      : "border-border-color text-transparent"
                  }`}
                >
                  <Check className="size-3" strokeWidth={2.5} />
                </span>
              </span>
              <span className="text-sm font-semibold text-text-primary">{option.title}</span>
              <span
                id={`mqtt-qos-${option.value}-description`}
                className="text-xs leading-5 text-text-secondary sm:text-[13px]"
              >
                {option.description}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
