"use client";

import { Button } from "@/components/ui/button";
import { Edit2 } from "@/components/ui/hugeicons-groups/controls";
import { RefreshCw } from "@/components/ui/hugeicons-groups/shell";
import type { MqttBrokerConnectionStatus } from "./useMqttConnectionStatus";

interface MqttOverviewProps {
  brokerStatus: MqttBrokerConnectionStatus;
  isEsp32Online: boolean;
  hasReceivedMqttStatus: boolean;
  esp32Ip: string | null;
  brokerWsUrl: string;
  brokerHost: string;
  brokerPort: number;
  baseTopic: string;
  qos: 0 | 1 | 2;
  onEdit: () => void;
  onReconnect: () => void;
}

const BROKER_STATUS_META: Record<
  MqttBrokerConnectionStatus,
  { label: string; dotClass: string; badgeClass: string }
> = {
  connected: {
    label: "متصل به بروکر",
    dotClass: "bg-success",
    badgeClass: "border-success/40 bg-success/10 text-success",
  },
  connecting: {
    label: "در حال اتصال به بروکر...",
    dotClass: "bg-amber-500 animate-pulse",
    badgeClass: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  reconnecting: {
    label: "در حال تلاش مجدد...",
    dotClass: "bg-amber-500 animate-pulse",
    badgeClass: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  disconnected: {
    label: "ارتباط با بروکر قطع است",
    dotClass: "bg-destructive",
    badgeClass: "border-destructive/40 bg-destructive/10 text-destructive",
  },
  error: {
    label: "خطا در اتصال به بروکر",
    dotClass: "bg-destructive",
    badgeClass: "border-destructive/40 bg-destructive/10 text-destructive",
  },
};

export function MqttOverview({
  brokerStatus,
  isEsp32Online,
  hasReceivedMqttStatus,
  esp32Ip,
  brokerWsUrl,
  brokerHost,
  brokerPort,
  baseTopic,
  qos,
  onEdit,
  onReconnect,
}: MqttOverviewProps) {
  const brokerMeta = BROKER_STATUS_META[brokerStatus];
  const isBrokerConnected = brokerStatus === "connected";
  const showRetryButton = brokerStatus === "disconnected" || brokerStatus === "error";

  const espStatusLabel =
    !isBrokerConnected || !hasReceivedMqttStatus
      ? "نامشخص (در انتظار پاسخ)"
      : isEsp32Online
        ? "آنلاین"
        : "آفلاین";

  const espBadgeClass =
    !isBrokerConnected || !hasReceivedMqttStatus
      ? "border-border-color bg-bg-primary text-text-secondary"
      : isEsp32Online
        ? "border-success/40 bg-success/10 text-success"
        : "border-destructive/40 bg-destructive/10 text-destructive";

  const espDotClass =
    !isBrokerConnected || !hasReceivedMqttStatus
      ? "bg-text-muted"
      : isEsp32Online
        ? "bg-success"
        : "bg-destructive";

  return (
    <div className="space-y-6 text-right">
      {/* Live Status Row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border-color bg-card-bg-solid p-4 space-y-2.5">
          <span className="block text-xs font-medium text-text-secondary">وضعیت بروکر MQTT</span>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs font-bold ${brokerMeta.badgeClass}`}
            >
              <span aria-hidden="true" className={`size-2 rounded-full ${brokerMeta.dotClass}`} />
              {brokerMeta.label}
            </span>

            {showRetryButton && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onReconnect}
                className="min-h-9 gap-1.5 text-xs"
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                تلاش مجدد
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border-color bg-card-bg-solid p-4 space-y-2.5">
          <span className="block text-xs font-medium text-text-secondary">وضعیت دستگاه ESP32</span>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs font-bold ${espBadgeClass}`}
            >
              <span aria-hidden="true" className={`size-2 rounded-full ${espDotClass}`} />
              {espStatusLabel}
            </span>

            {isBrokerConnected && hasReceivedMqttStatus && isEsp32Online && esp32Ip && (
              <span
                dir="ltr"
                className="rounded-md border border-border-color bg-bg-primary px-2 py-0.5 font-mono text-[11px] tabular-nums text-text-secondary"
              >
                {esp32Ip}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Active Configuration Summary */}
      <div className="rounded-xl border border-border-color bg-bg-main p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-color/70 pb-3">
          <div>
            <h3 className="text-sm font-bold text-text-primary">پیکربندی فعال MQTT</h3>
            <p className="text-xs text-text-secondary mt-0.5">
              اطلاعات اتصال مرورگر و برد مرکزی ESP32 به بروکر
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="min-h-10 gap-1.5"
          >
            <Edit2 className="size-3.5" aria-hidden="true" />
            ویرایش تنظیمات
          </Button>
        </div>

        <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-text-secondary">نشانی WebSocket (مرورگر)</dt>
            <dd dir="ltr" className="truncate font-mono text-text-primary">
              {brokerWsUrl || "—"}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-text-secondary">میزبان و پورت TCP (ESP32)</dt>
            <dd dir="ltr" className="truncate font-mono tabular-nums text-text-primary">
              {brokerHost ? `${brokerHost}:${brokerPort}` : "—"}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-text-secondary">پیشوند موضوع پایه (Base Topic)</dt>
            <dd dir="ltr" className="truncate font-mono text-text-primary">
              {baseTopic || "—"}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-text-secondary">کیفیت تحویل پیام</dt>
            <dd dir="ltr" className="font-mono font-semibold text-accent3">
              QoS {qos}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
