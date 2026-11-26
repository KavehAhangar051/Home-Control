import type { MqttConnectionStatus } from "./useMqttConnectionStatus";

interface Props {
  brokerStatus: MqttConnectionStatus;
  isEsp32Online: boolean;
  esp32Ip: string | null;
  brokerWsUrl: string;
  brokerHost: string;
  brokerPort: number;
  baseTopic: string;
  qos: 0 | 1 | 2;
  onEdit: () => void;
}

const BROKER_STATUS_COPY: Record<MqttConnectionStatus, { label: string; tone: string }> = {
  starting: { label: "در انتظار راه‌اندازی کلاینت", tone: "bg-text-muted" },
  connecting: { label: "در حال اتصال به بروکر", tone: "bg-amber-500" },
  connected: { label: "متصل به بروکر", tone: "bg-success" },
  reconnecting: { label: "در حال اتصال مجدد", tone: "bg-amber-500" },
  disconnected: { label: "ارتباط با بروکر قطع شده", tone: "bg-red-500" },
  offline: { label: "شبکه در دسترس نیست", tone: "bg-red-500" },
  error: { label: "خطا در اتصال به بروکر", tone: "bg-red-500" },
};

const QOS_COPY = {
  0: "QoS 0 · بدون تأیید",
  1: "QoS 1 · تحویل با تأیید",
  2: "QoS 2 · تحویل دقیقاً یک‌بار",
} as const;

function SummaryItem({
  label,
  value,
  direction = "auto",
}: {
  label: string;
  value: string;
  direction?: "auto" | "ltr";
}) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-xs font-medium text-text-secondary">{label}</dt>
      <dd dir={direction} className="break-all text-sm font-semibold leading-6 text-text-primary">
        {value || "تنظیم نشده"}
      </dd>
    </div>
  );
}

export function MqttOverview({
  brokerStatus,
  isEsp32Online,
  esp32Ip,
  brokerWsUrl,
  brokerHost,
  brokerPort,
  baseTopic,
  qos,
  onEdit,
}: Props) {
  const brokerState = BROKER_STATUS_COPY[brokerStatus];
  const esp32Status = isEsp32Online ? "آنلاین" : esp32Ip ? "آفلاین" : "هنوز دریافت نشده";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="text-base font-bold text-text-primary">وضعیت ارتباط MQTT</h3>
          <p className="text-xs leading-5 text-text-secondary sm:text-[13px]">
            وضعیت فعلی اتصال و پیکربندی ذخیره‌شده را از اینجا مشاهده کنید.
          </p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-accent3 px-4 text-sm font-bold text-accent3-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset"
        >
          ویرایش تنظیمات
        </button>
      </div>

      <section
        aria-label="وضعیت اتصال"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="space-y-4 rounded-xl border border-border-color bg-bg-main p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-semibold text-text-primary">اتصال داشبورد به بروکر</span>
          <span className="inline-flex items-center gap-2 text-sm font-bold text-text-primary">
            <span aria-hidden="true" className={`size-2.5 rounded-full ${brokerState.tone}`} />
            {brokerState.label}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-semibold text-text-primary">وضعیت برد ESP32</span>
          <span className="inline-flex items-center gap-2 text-sm font-bold text-text-primary">
            <span
              aria-hidden="true"
              className={`size-2.5 rounded-full ${isEsp32Online ? "bg-success" : esp32Ip ? "bg-red-500" : "bg-text-muted"}`}
            />
            {esp32Status}
          </span>
        </div>
        {esp32Ip && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-color/70 pt-3">
            <span className="text-xs text-text-secondary">آخرین IP گزارش‌شده</span>
            <span dir="ltr" className="font-mono text-sm text-text-primary">{esp32Ip}</span>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h4 className="text-sm font-bold text-text-primary">پیکربندی فعلی</h4>
        <dl className="grid grid-cols-1 gap-x-5 gap-y-4 rounded-xl border border-border-color bg-bg-main p-4 sm:grid-cols-2">
          <SummaryItem label="نشانی WebSocket داشبورد" value={brokerWsUrl} direction="ltr" />
          <SummaryItem label="میزبان TCP برای ESP32" value={brokerHost} direction="ltr" />
          <SummaryItem label="پورت TCP" value={String(brokerPort)} direction="ltr" />
          <SummaryItem label="پیشوند موضوع‌ها (Base Topic)" value={baseTopic} direction="ltr" />
          <SummaryItem label="کیفیت تحویل پیام" value={QOS_COPY[qos]} />
        </dl>
      </section>
    </div>
  );
}
