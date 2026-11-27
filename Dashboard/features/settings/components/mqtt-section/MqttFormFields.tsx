import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MqttValidationErrors } from "./mqttValidation";

interface Props {
  brokerWsUrl: string;
  setBrokerWsUrl: (val: string) => void;
  brokerHost: string;
  setBrokerHost: (val: string) => void;
  brokerPort: number;
  setBrokerPort: (val: number) => void;
  errors: MqttValidationErrors;
}

export function MqttFormFields({
  brokerWsUrl,
  setBrokerWsUrl,
  brokerHost,
  setBrokerHost,
  brokerPort,
  setBrokerPort,
  errors,
}: Props) {
  return (
    <div className="space-y-7">
      <fieldset className="space-y-3">
        <legend className="text-sm font-bold text-text-primary">
          اتصال داشبورد از طریق WebSocket
        </legend>
        <p
          id="mqtt-broker-ws-url-help"
          className="text-xs leading-5 text-text-secondary sm:text-[13px]"
        >
          مرورگر داشبورد از این نشانی برای اتصال به بروکر استفاده می‌کند.
        </p>
        <div className="space-y-2">
          <Label htmlFor="mqtt-broker-ws-url" className="text-sm font-bold text-text-primary">
            نشانی WebSocket بروکر
          </Label>
          <Input
            id="mqtt-broker-ws-url"
            aria-invalid={Boolean(errors.brokerWsUrl)}
            aria-describedby={
              errors.brokerWsUrl
                ? "mqtt-broker-ws-url-help mqtt-broker-ws-url-error"
                : "mqtt-broker-ws-url-help"
            }
            type="text"
            dir="ltr"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={brokerWsUrl}
            onChange={(event) => setBrokerWsUrl(event.target.value)}
            className="h-11 font-mono text-base sm:text-sm"
            placeholder="wss://broker.emqx.io:8084/mqtt"
          />
          {errors.brokerWsUrl && (
            <p
              id="mqtt-broker-ws-url-error"
              className="text-xs leading-5 text-red-700 dark:text-red-300"
            >
              {errors.brokerWsUrl}
            </p>
          )}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-bold text-text-primary">اتصال ESP32 از طریق TCP</legend>
        <p
          id="mqtt-tcp-connection-help"
          className="text-xs leading-5 text-text-secondary sm:text-[13px]"
        >
          میزبان و پورت بروکری را وارد کنید که ESP32 به آن متصل می‌شود.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <div className="min-w-0 space-y-2">
            <Label htmlFor="mqtt-broker-host" className="text-sm font-bold text-text-primary">
              میزبان بروکر
            </Label>
            <Input
              id="mqtt-broker-host"
              type="text"
              dir="ltr"
              autoCapitalize="none"
              spellCheck={false}
              required
              aria-invalid={Boolean(errors.brokerHost)}
              aria-describedby={
                errors.brokerHost
                  ? "mqtt-tcp-connection-help mqtt-broker-host-error"
                  : "mqtt-tcp-connection-help"
              }
              value={brokerHost}
              onChange={(event) => setBrokerHost(event.target.value)}
              className="h-11 font-mono text-base sm:text-sm"
              placeholder="broker.emqx.io"
            />
            {errors.brokerHost && (
              <p
                id="mqtt-broker-host-error"
                className="text-xs leading-5 text-red-700 dark:text-red-300"
              >
                {errors.brokerHost}
              </p>
            )}
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="mqtt-broker-port" className="text-sm font-bold text-text-primary">
              پورت TCP
            </Label>
            <Input
              id="mqtt-broker-port"
              type="number"
              dir="ltr"
              min={1}
              max={65535}
              step={1}
              required
              aria-invalid={Boolean(errors.brokerPort)}
              aria-describedby={
                errors.brokerPort
                  ? "mqtt-tcp-connection-help mqtt-broker-port-error"
                  : "mqtt-tcp-connection-help"
              }
              value={brokerPort || ""}
              onChange={(event) => setBrokerPort(Number(event.target.value))}
              className="h-11 font-mono text-base tabular-nums sm:text-sm"
              placeholder="1883"
            />
            {errors.brokerPort && (
              <p
                id="mqtt-broker-port-error"
                className="text-xs leading-5 text-red-700 dark:text-red-300"
              >
                {errors.brokerPort}
              </p>
            )}
          </div>
        </div>
      </fieldset>
    </div>
  );
}
