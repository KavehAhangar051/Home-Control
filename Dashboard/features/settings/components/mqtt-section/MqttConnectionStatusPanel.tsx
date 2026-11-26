import { RefreshCw } from "@/components/ui/hugeicons-groups/shell";
import type { MqttConnectionStatus } from "./useMqttConnectionStatus";

interface Props {
  brokerStatus: MqttConnectionStatus;
  isEsp32Online: boolean;
  esp32Ip: string | null;
  onReconnect: () => void;
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

export function MqttConnectionStatusPanel({
  brokerStatus,
  isEsp32Online,
  esp32Ip,
  onReconnect,
}: Props) {
  const brokerState = BROKER_STATUS_COPY[brokerStatus];
  const isBrokerConnected = brokerStatus === "connected";
  const canRetry = brokerStatus === "disconnected" || brokerStatus === "offline" || brokerStatus === "error";
  const esp32Status = !isBrokerConnected
    ? "نامشخص تا اتصال بروکر"
    : isEsp32Online
      ? "آنلاین"
      : esp32Ip
        ? "آفلاین"
        : "هنوز گزارشی دریافت نشده";
  const esp32Tone = !isBrokerConnected
    ? "bg-text-muted"
    : isEsp32Online
      ? "bg-success"
      : esp32Ip
        ? "bg-red-500"
        : "bg-text-muted";

  return (
    <section aria-label="وضعیت اتصال" className="space-y-4 rounded-xl border border-border-color bg-bg-main p-4">
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
          <span aria-hidden="true" className={`size-2.5 rounded-full ${esp32Tone}`} />
          {esp32Status}
        </span>
      </div>

      {!isBrokerConnected ? (
        <p className="text-xs leading-5 text-text-secondary">
          تا زمانی که داشبورد به بروکر متصل نباشد، وضعیت آنلاین یا آفلاین ESP32 قابل تأیید نیست.
        </p>
      ) : !isEsp32Online && !esp32Ip ? (
        <p className="text-xs leading-5 text-text-secondary">
          پس از دریافت اولین پیام وضعیت از ESP32، وضعیت آنلاین یا آفلاین آن نمایش داده می‌شود.
        </p>
      ) : null}

      {isBrokerConnected && esp32Ip && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-color/70 pt-3">
          <span className="text-xs text-text-secondary">آخرین IP گزارش‌شده</span>
          <span dir="ltr" className="font-mono text-sm text-text-primary">{esp32Ip}</span>
        </div>
      )}

      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        اتصال داشبورد: {brokerState.label}. وضعیت ESP32: {esp32Status}.
      </p>

      {canRetry && (
        <div className="border-t border-border-color/70 pt-3">
          <button
            type="button"
            onClick={onReconnect}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border-color px-4 text-sm font-semibold text-text-primary transition-colors hover:bg-card-hover-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            تلاش مجدد برای اتصال
          </button>
        </div>
      )}
    </section>
  );
}
