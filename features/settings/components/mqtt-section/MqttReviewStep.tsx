interface Props {
  brokerWsUrl: string;
  brokerHost: string;
  brokerPort: number;
  baseTopic: string;
  qos: 0 | 1 | 2;
  onEditConnection: () => void;
  onEditMessages: () => void;
}

const QOS_SUMMARIES = {
  0: "ارسال بدون تأیید؛ پیام ممکن است از دست برود.",
  1: "تحویل با تأیید؛ ممکن است پیام تکراری دریافت شود.",
  2: "تحویل دقیقاً یک‌بار؛ با سربار ارتباطی بیشتر.",
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
      <dd
        dir={direction}
        className="break-all text-sm font-semibold leading-6 text-text-primary"
      >
        {value || "وارد نشده"}
      </dd>
    </div>
  );
}

export function MqttReviewStep({
  brokerWsUrl,
  brokerHost,
  brokerPort,
  baseTopic,
  qos,
  onEditConnection,
  onEditMessages,
}: Props) {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-bold text-text-primary">نشانی‌های اتصال</h4>
          <button
            type="button"
            aria-label="ویرایش نشانی‌های اتصال"
            onClick={onEditConnection}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg px-3 text-sm font-semibold text-accent3 transition-colors hover:bg-accent3/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3"
          >
            ویرایش
          </button>
        </div>
        <dl className="grid grid-cols-1 gap-4 rounded-xl border border-border-color bg-bg-main p-4 sm:grid-cols-2">
          <SummaryItem
            label="نشانی WebSocket داشبورد"
            value={brokerWsUrl}
            direction="ltr"
          />
          <SummaryItem label="میزبان TCP برای ESP32" value={brokerHost} direction="ltr" />
          <SummaryItem
            label="پورت TCP"
            value={String(brokerPort)}
            direction="ltr"
          />
        </dl>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-bold text-text-primary">تنظیم پیام‌ها</h4>
          <button
            type="button"
            aria-label="ویرایش تنظیم پیام‌ها"
            onClick={onEditMessages}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg px-3 text-sm font-semibold text-accent3 transition-colors hover:bg-accent3/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3"
          >
            ویرایش
          </button>
        </div>
        <dl className="grid grid-cols-1 gap-4 rounded-xl border border-border-color bg-bg-main p-4 sm:grid-cols-2">
          <SummaryItem label="پیشوند موضوع‌ها (Base Topic)" value={baseTopic} direction="ltr" />
          <SummaryItem label={`کیفیت تحویل پیام (QoS ${qos})`} value={QOS_SUMMARIES[qos]} />
        </dl>
      </section>

      <p className="rounded-xl bg-secondary/60 px-4 py-3 text-xs leading-5 text-text-secondary sm:text-[13px]">
        این مقادیر هنوز ذخیره نشده‌اند. با انتخاب «ذخیره و اتصال مجدد»، تنظیمات اعمال می‌شوند و داشبورد اتصال MQTT را دوباره برقرار می‌کند.
      </p>
    </div>
  );
}
