import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  brokerWsUrl: string;
  setBrokerWsUrl: (val: string) => void;
  brokerHost: string;
  setBrokerHost: (val: string) => void;
  brokerPort: number;
  setBrokerPort: (val: number) => void;
}

export function MqttFormFields({
  brokerWsUrl,
  setBrokerWsUrl,
  brokerHost,
  setBrokerHost,
  brokerPort,
  setBrokerPort,
}: Props) {
  return (
    <div className="space-y-7">
      <fieldset className="space-y-3">
        <legend className="text-sm font-bold text-text-primary">
          اتصال داشبورد از طریق WebSocket
        </legend>
        <p id="mqtt-broker-ws-url-help" className="text-xs leading-5 text-text-secondary sm:text-[13px]">
          مرورگر داشبورد از این نشانی برای اتصال به بروکر استفاده می‌کند.
        </p>
        <div className="space-y-2">
          <Label htmlFor="mqtt-broker-ws-url" className="text-sm font-bold text-text-primary">
            نشانی WebSocket بروکر
          </Label>
          <Input
            id="mqtt-broker-ws-url"
            aria-describedby="mqtt-broker-ws-url-help"
            type="text"
            dir="ltr"
            autoCapitalize="none"
            spellCheck={false}
            value={brokerWsUrl}
            onChange={(event) => setBrokerWsUrl(event.target.value)}
            className="h-11 font-mono text-base sm:text-sm"
            placeholder="wss://broker.emqx.io:8084/mqtt"
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-bold text-text-primary">
          اتصال ESP32 از طریق TCP
        </legend>
        <p id="mqtt-tcp-connection-help" className="text-xs leading-5 text-text-secondary sm:text-[13px]">
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
              aria-describedby="mqtt-tcp-connection-help"
              value={brokerHost}
              onChange={(event) => setBrokerHost(event.target.value)}
              className="h-11 font-mono text-base sm:text-sm"
              placeholder="broker.emqx.io"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mqtt-broker-port" className="text-sm font-bold text-text-primary">
              پورت TCP
            </Label>
            <Input
              id="mqtt-broker-port"
              type="number"
              dir="ltr"
              aria-describedby="mqtt-tcp-connection-help"
              value={brokerPort}
              onChange={(event) => setBrokerPort(Number.parseInt(event.target.value, 10) || 1883)}
              className="h-11 font-mono text-base tabular-nums sm:text-sm"
              placeholder="1883"
            />
          </div>
        </div>
      </fieldset>
    </div>
  );
}
