import { Button } from "@/components/ui/button";
import { Edit2 } from "@/components/ui/hugeicons-groups/controls";

interface MqttReviewStepProps {
  brokerWsUrl: string;
  brokerHost: string;
  brokerPort: number;
  baseTopic: string;
  qos: 0 | 1 | 2;
  onEditConnection: () => void;
  onEditMessages: () => void;
}

const QOS_TITLES: Record<0 | 1 | 2, string> = {
  0: "QoS 0 — بدون تأیید",
  1: "QoS 1 — تحویل با تأیید",
  2: "QoS 2 — تحویل دقیقاً یک‌بار",
};

export function MqttReviewStep({
  brokerWsUrl,
  brokerHost,
  brokerPort,
  baseTopic,
  qos,
  onEditConnection,
  onEditMessages,
}: MqttReviewStepProps) {
  return (
    <div className="space-y-4 text-right">
      <div className="rounded-xl border border-border-color bg-bg-main p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-border-color/70 pb-2.5">
          <h4 className="text-sm font-bold text-text-primary">نشانی‌های اتصال</h4>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onEditConnection}
            className="min-h-9 gap-1.5 text-xs"
          >
            <Edit2 className="size-3.5" aria-hidden="true" />
            ویرایش
          </Button>
        </div>

        <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-text-secondary">نشانی WebSocket داشبورد</dt>
            <dd dir="ltr" className="truncate font-mono text-text-primary">
              {brokerWsUrl}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-text-secondary">اتصال TCP برد ESP32</dt>
            <dd dir="ltr" className="truncate font-mono tabular-nums text-text-primary">
              {brokerHost}:{brokerPort}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-border-color bg-bg-main p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-border-color/70 pb-2.5">
          <h4 className="text-sm font-bold text-text-primary">تنظیمات پیام</h4>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onEditMessages}
            className="min-h-9 gap-1.5 text-xs"
          >
            <Edit2 className="size-3.5" aria-hidden="true" />
            ویرایش
          </Button>
        </div>

        <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-text-secondary">پیشوند موضوع پایه</dt>
            <dd dir="ltr" className="truncate font-mono text-text-primary">
              {baseTopic}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-text-secondary">سطح کیفیت تحویل</dt>
            <dd className="font-semibold text-accent3">{QOS_TITLES[qos]}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
