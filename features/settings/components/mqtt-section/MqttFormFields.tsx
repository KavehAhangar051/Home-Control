import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  brokerWsUrl: string;
  setBrokerWsUrl: (val: string) => void;
  brokerHost: string;
  setBrokerHost: (val: string) => void;
  brokerPort: number;
  setBrokerPort: (val: number) => void;
  baseTopic: string;
  setBaseTopic: (val: string) => void;
}

export function MqttFormFields({
  brokerWsUrl,
  setBrokerWsUrl,
  brokerHost,
  setBrokerHost,
  brokerPort,
  setBrokerPort,
  baseTopic,
  setBaseTopic,
}: Props) {
  return (
    <>
      <div className="space-y-2 text-right">
        <Label htmlFor="mqtt-broker-ws-url" className="px-1 font-bold">
          آدرس WebSocket بروکر برای داشبورد
        </Label>
        <p className="px-1 text-xs leading-5 text-text-secondary">مرورگر داشبورد از این نشانی و پروتکل WebSocket به بروکر وصل می‌شود.</p>
        <Input
          id="mqtt-broker-ws-url"
          type="text"
          dir="ltr"
          value={brokerWsUrl}
          onChange={(e) => setBrokerWsUrl(e.target.value)}
          className="h-11 bg-card-bg-solid px-4 py-3 text-xs text-text-secondary"
          placeholder="wss://broker.emqx.io:8084/mqtt"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 space-y-2 text-right">
          <Label htmlFor="mqtt-broker-host" className="px-1 font-bold">
            میزبان بروکر برای ESP32 (TCP)
          </Label>
          <p className="px-1 text-xs leading-5 text-text-secondary">نام میزبان یا IP بروکری که برد ESP32 از طریق TCP به آن وصل می‌شود.</p>
          <Input
            id="mqtt-broker-host"
            type="text"
            dir="ltr"
            value={brokerHost}
            onChange={(e) => setBrokerHost(e.target.value)}
            className="h-11 bg-card-bg-solid px-4 py-3 text-xs text-text-secondary"
            placeholder="broker.emqx.io"
          />
        </div>
        <div className="sm:col-span-1 space-y-2 text-right">
          <Label htmlFor="mqtt-broker-port" className="px-1 font-bold">
            پورت
          </Label>
          <Input
            id="mqtt-broker-port"
            type="number"
            dir="ltr"
            value={brokerPort}
            onChange={(e) => setBrokerPort(parseInt(e.target.value, 10) || 1883)}
            className="h-11 bg-card-bg-solid px-4 py-3 text-xs text-text-secondary"
            placeholder="1883"
          />
        </div>
      </div>

      <div className="space-y-2 text-right">
        <Label htmlFor="mqtt-base-topic" className="px-1 font-bold">
          پیشوند موضوع‌های MQTT (Base Topic)
        </Label>
        <p className="px-1 text-xs leading-5 text-text-secondary">این پیشوند در ساخت موضوع‌های فرمان و وضعیت استفاده می‌شود؛ مقدار آن باید با تنظیمات فریمور یکسان باشد.</p>
        <Input
          id="mqtt-base-topic"
          type="text"
          dir="ltr"
          value={baseTopic}
          onChange={(e) => setBaseTopic(e.target.value)}
          className="h-11 bg-card-bg-solid px-4 py-3 text-xs text-text-secondary"
          placeholder="KamyarIoT/Achaemenid"
        />
      </div>
    </>
  );
}
