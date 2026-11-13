import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Save } from "@/components/ui/hugeicons";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import {
  fetchConfigFromCloudflare,
  saveConfigToCloudflare,
} from "@/features/iot/services/cloudflare/api";
import { getMqttSettings, reconnectMqtt } from "@/features/iot/services/mqttService";
import { soundManager } from "@/lib/audio";
import { MqttFormFields } from "./MqttFormFields";
import { MqttQosSelector } from "./MqttQosSelector";

type MqttLocalOverrides = {
  brokerWsUrl?: string;
  brokerHost?: string;
  brokerPort?: number;
  baseTopic?: string;
  qos?: 0 | 1 | 2;
};

const subscribeMqttDefaults = () => () => {};
const getServerMqttSettingsSnapshot = () => "";

function getClientMqttSettingsSnapshot(): string {
  const settings = getMqttSettings();

  return JSON.stringify({
    brokerUrl: settings.brokerUrl,
    baseTopic: settings.baseTopic,
    qos: settings.qos,
  });
}

export default function MqttSection() {
  const settingsJson = useSyncExternalStore(
    subscribeMqttDefaults,
    getClientMqttSettingsSnapshot,
    getServerMqttSettingsSnapshot,
  );

  // SAFETY: settingsJson is produced by getClientMqttSettingsSnapshot
  const initialSettings = settingsJson
    ? (JSON.parse(settingsJson) as { brokerUrl: string; baseTopic: string; qos: 0 | 1 | 2 })
    : null;

  const [overrides, setOverrides] = useState<MqttLocalOverrides>({});
  const [isSaved, setIsSaved] = useState(false);
  const setMqttConfig = useIoTStore((state) => state.setMqttConfig);
  const showToast = useIoTStore((state) => state.showToast);

  const brokerWsUrl = overrides.brokerWsUrl ?? initialSettings?.brokerUrl ?? "";
  const brokerHost = overrides.brokerHost ?? (initialSettings ? "broker.emqx.io" : "");
  const brokerPort = overrides.brokerPort ?? 1883;
  const baseTopic = overrides.baseTopic ?? initialSettings?.baseTopic ?? "";
  const qos = overrides.qos ?? initialSettings?.qos ?? 1;

  const setBrokerWsUrl = (val: string) => setOverrides((prev) => ({ ...prev, brokerWsUrl: val }));
  const setBrokerHost = (val: string) => setOverrides((prev) => ({ ...prev, brokerHost: val }));
  const setBrokerPort = (val: number) => setOverrides((prev) => ({ ...prev, brokerPort: val }));
  const setBaseTopic = (val: string) => setOverrides((prev) => ({ ...prev, baseTopic: val }));
  const setQos = (val: 0 | 1 | 2) => setOverrides((prev) => ({ ...prev, qos: val }));

  useEffect(() => {
    let isCancelled = false;

    fetchConfigFromCloudflare().then((config) => {
      if (isCancelled || !config?.mqtt) return;

      setOverrides({
        brokerWsUrl: config.mqtt.broker_ws_url,
        brokerHost: config.mqtt.broker_host,
        brokerPort: config.mqtt.broker_port,
        baseTopic: config.mqtt.base_topic,
        qos: config.mqtt.qos,
      });
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  const handleSaveAndReconnect = async () => {
    soundManager.playClick();

    localStorage.setItem("mqtt_broker_url", brokerWsUrl);
    localStorage.setItem("mqtt_base_topic", baseTopic);
    localStorage.setItem("mqtt_qos", qos.toString());

    const newMqttConfig = {
      broker_ws_url: brokerWsUrl,
      broker_host: brokerHost,
      broker_port: brokerPort,
      base_topic: baseTopic,
      qos: qos,
    };

    setMqttConfig(newMqttConfig);

    try {
      const config = await fetchConfigFromCloudflare();

      if (!config) {
        showToast("تنظیمات سرور دریافت نشد؛ اتصال کلودفلر را بررسی کنید.", "error");

        return;
      }

      config.mqtt = newMqttConfig;
      const res = await saveConfigToCloudflare(config);

      if (res.success) {
        showToast(res.message, "success");
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
      } else {
        showToast(res.message, "error");
      }
    } catch (e) {
      console.error("Failed to save MQTT settings to cloud", e);
      showToast("خطا در ارتباط با سرور کلودفلر", "error");
    }

    reconnectMqtt();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-[10px] text-[var(--text-tertiary)] leading-relaxed text-right">
          تنظیمات ارتباطی داشبورد با ماژول‌های ESP را مدیریت کنید. پس از ذخیره، اتصال مجدداً برقرار
          می‌شود.
        </p>
      </div>

      <div className="space-y-4">
        <MqttFormFields
          brokerWsUrl={brokerWsUrl}
          setBrokerWsUrl={setBrokerWsUrl}
          brokerHost={brokerHost}
          setBrokerHost={setBrokerHost}
          brokerPort={brokerPort}
          setBrokerPort={setBrokerPort}
          baseTopic={baseTopic}
          setBaseTopic={setBaseTopic}
        />
        <MqttQosSelector qos={qos} setQos={setQos} />
      </div>

      <Button
        type="button"
        variant={isSaved ? "outline" : "default"}
        onClick={handleSaveAndReconnect}
        className={`w-full h-auto min-h-12 rounded-xl px-4 py-3.5 text-sm font-bold transition-colors focus-visible:ring-[var(--accent3)] ${
          isSaved
            ? "border-[var(--accent4)] bg-[var(--accent4-transparent)] text-[var(--accent4)] hover:border-[var(--accent4)] hover:bg-[var(--accent4-transparent)] hover:text-[var(--accent4)]"
            : "border-transparent bg-[var(--accent3)] text-[var(--bg-main)] shadow-sm hover:bg-[var(--accent3-dark)] hover:text-[var(--bg-main)]"
        }`}
      >
        {isSaved ? (
          <>
            <Save className="w-4 h-4" />
            ذخیره شد
          </>
        ) : (
          <>
            <RefreshCw className="w-4 h-4" />
            ذخیره و اتصال مجدد
          </>
        )}
      </Button>
    </div>
  );
}
