import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Save } from "@/components/ui/hugeicons";
import { buildEspConfig } from "@/features/iot/hooks/achaemenidState/core/buildEspConfig";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { saveConfigToCloudflare } from "@/features/iot/services/cloudflare/api";
import { isCloudflareEnabled } from "@/features/iot/services/cloudflareService";
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

  const mqttConfig = useIoTStore((state) => state.mqttConfig);
  const setMqttConfig = useIoTStore((state) => state.setMqttConfig);
  const showToast = useIoTStore((state) => state.showToast);

  const [overrides, setOverrides] = useState<MqttLocalOverrides>({});
  const [isSaved, setIsSaved] = useState(false);

  const brokerWsUrl =
    overrides.brokerWsUrl ?? mqttConfig?.broker_ws_url ?? initialSettings?.brokerUrl ?? "";
  const brokerHost =
    overrides.brokerHost ?? mqttConfig?.broker_host ?? (initialSettings ? "broker.emqx.io" : "");
  const brokerPort = overrides.brokerPort ?? mqttConfig?.broker_port ?? 1883;
  const baseTopic =
    overrides.baseTopic ?? mqttConfig?.base_topic ?? initialSettings?.baseTopic ?? "";
  const qos = overrides.qos ?? mqttConfig?.qos ?? initialSettings?.qos ?? 1;

  const setBrokerWsUrl = (val: string) => setOverrides((prev) => ({ ...prev, brokerWsUrl: val }));
  const setBrokerHost = (val: string) => setOverrides((prev) => ({ ...prev, brokerHost: val }));
  const setBrokerPort = (val: number) => setOverrides((prev) => ({ ...prev, brokerPort: val }));
  const setBaseTopic = (val: string) => setOverrides((prev) => ({ ...prev, baseTopic: val }));
  const setQos = (val: 0 | 1 | 2) => setOverrides((prev) => ({ ...prev, qos: val }));

  const handleSaveAndReconnect = async () => {
    soundManager.playClick();

    try {
      localStorage.setItem("mqtt_broker_url", brokerWsUrl);
      localStorage.setItem("mqtt_base_topic", baseTopic);
      localStorage.setItem("mqtt_qos", qos.toString());
    } catch {
      // Ignore storage write errors in restricted contexts
    }

    const newMqttConfig = {
      broker_ws_url: brokerWsUrl,
      broker_host: brokerHost,
      broker_port: brokerPort,
      base_topic: baseTopic,
      qos: qos,
    };

    setMqttConfig(newMqttConfig);
    reconnectMqtt();

    if (!isCloudflareEnabled()) {
      showToast("تنظیمات MQTT ذخیره و اتصال مجدد برقرار شد.", "success");
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);

      return;
    }

    try {
      const currentConfig = buildEspConfig({
        ...useIoTStore.getState(),
        mqttConfig: newMqttConfig,
      });
      const res = await saveConfigToCloudflare(currentConfig);

      if (res.success) {
        useIoTStore.getState().resetUnsavedChanges();
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
