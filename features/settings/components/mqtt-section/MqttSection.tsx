import { useState, useSyncExternalStore, type FormEvent } from "react";
import { ProgressSteps } from "@/components/dissolve/progress-steps";
import { Button } from "@/components/ui/button";
import { Save } from "@/components/ui/hugeicons-groups/controls";
import { ChevronLeft, ChevronRight, RefreshCw } from "@/components/ui/hugeicons-groups/shell";
import { persistStoreConfigToCloudflare } from "@/features/iot/hooks/achaemenidState/core/buildEspConfig";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { isCloudflareEnabled } from "@/features/iot/services/cloudflareService";
import { getMqttSettings, reconnectMqtt } from "@/features/iot/services/mqttService";
import { soundManager } from "@/lib/audio";
import { MqttFormFields } from "./MqttFormFields";
import { MqttMessageSettingsStep } from "./MqttMessageSettingsStep";
import { MqttReviewStep } from "./MqttReviewStep";

type MqttLocalOverrides = {
  brokerWsUrl?: string;
  brokerHost?: string;
  brokerPort?: number;
  baseTopic?: string;
  qos?: 0 | 1 | 2;
};

const MQTT_STEPS = ["اتصال بروکر", "تنظیم پیام‌ها", "بازبینی و ذخیره"];
const MQTT_STEP_COPY = [
  {
    title: "نشانی‌های اتصال",
    description: "نشانی اتصال مرورگر و مشخصات اتصال ESP32 به بروکر را وارد کنید.",
  },
  {
    title: "تنظیم پیام‌ها",
    description: "پیشوند موضوع‌ها و کیفیت تحویل پیام‌ها را مشخص کنید.",
  },
  {
    title: "بازبینی تنظیمات",
    description: "مقادیر انتخاب‌شده را پیش از ذخیره بررسی کنید.",
  },
] as const;

const subscribeMqttDefaults = () => () => {};
const getServerMqttSettingsSnapshot = () => "";

interface ParsedMqttDefaults {
  brokerUrl: string;
  baseTopic: string;
  qos: 0 | 1 | 2;
}

function getClientMqttSettingsSnapshot(): string {
  const settings = getMqttSettings();

  return JSON.stringify({
    brokerUrl: settings.brokerUrl,
    baseTopic: settings.baseTopic,
    qos: settings.qos,
  });
}

function resolveMqttDraftValues(
  overrides: MqttLocalOverrides,
  mqttConfig: ReturnType<typeof useIoTStore.getState>["mqttConfig"],
  initialSettings: ParsedMqttDefaults | null,
) {
  return {
    brokerWsUrl:
      overrides.brokerWsUrl ?? mqttConfig?.broker_ws_url ?? initialSettings?.brokerUrl ?? "",
    brokerHost:
      overrides.brokerHost ?? mqttConfig?.broker_host ?? (initialSettings ? "broker.emqx.io" : ""),
    brokerPort: overrides.brokerPort ?? mqttConfig?.broker_port ?? 1883,
    baseTopic: overrides.baseTopic ?? mqttConfig?.base_topic ?? initialSettings?.baseTopic ?? "",
    qos: overrides.qos ?? mqttConfig?.qos ?? initialSettings?.qos ?? 1,
  };
}

export default function MqttSection() {
  const settingsJson = useSyncExternalStore(
    subscribeMqttDefaults,
    getClientMqttSettingsSnapshot,
    getServerMqttSettingsSnapshot,
  );

  // SAFETY: settingsJson is produced by getClientMqttSettingsSnapshot
  const initialSettings = settingsJson ? (JSON.parse(settingsJson) as ParsedMqttDefaults) : null;

  const mqttConfig = useIoTStore((state) => state.mqttConfig);
  const setMqttConfig = useIoTStore((state) => state.setMqttConfig);
  const showToast = useIoTStore((state) => state.showToast);

  const [overrides, setOverrides] = useState<MqttLocalOverrides>({});
  const [step, setStep] = useState(0);
  const [isSaved, setIsSaved] = useState(false);

  const { brokerWsUrl, brokerHost, brokerPort, baseTopic, qos } = resolveMqttDraftValues(
    overrides,
    mqttConfig,
    initialSettings,
  );

  const currentStepCopy = MQTT_STEP_COPY[step];

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
      const { result } = await persistStoreConfigToCloudflare({
        overrides: { mqttConfig: newMqttConfig },
      });

      if (result.success) {
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
      }
    } catch (e) {
      console.error("Failed to save MQTT settings to cloud", e);
      showToast("خطا در ارتباط با سرور کلودفلر", "error");
    }
  };

  const handleWizardSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (step < MQTT_STEPS.length - 1) {
      setStep((current) => Math.min(current + 1, MQTT_STEPS.length - 1));
      return;
    }

    void handleSaveAndReconnect();
  };

  return (
    <form onSubmit={handleWizardSubmit} className="space-y-6">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h3 className="text-base font-bold text-text-primary">{currentStepCopy.title}</h3>
            <p className="text-xs leading-5 text-text-secondary sm:text-[13px]">
              {currentStepCopy.description}
            </p>
          </div>
          <span className="shrink-0 rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-semibold tabular-nums text-text-secondary">
            {step + 1} از {MQTT_STEPS.length}
          </span>
        </div>

        <ProgressSteps
          steps={MQTT_STEPS}
          current={step}
          size="lg"
          haptics={false}
          onStepPress={(index) => {
            if (index < step) setStep(index);
          }}
          labelClassName="font-sans"
        />
      </div>

      <div className="min-w-0">
        {step === 0 ? (
          <MqttFormFields
            brokerWsUrl={brokerWsUrl}
            setBrokerWsUrl={setBrokerWsUrl}
            brokerHost={brokerHost}
            setBrokerHost={setBrokerHost}
            brokerPort={brokerPort}
            setBrokerPort={setBrokerPort}
          />
        ) : step === 1 ? (
          <MqttMessageSettingsStep
            baseTopic={baseTopic}
            setBaseTopic={setBaseTopic}
            qos={qos}
            setQos={setQos}
          />
        ) : (
          <MqttReviewStep
            brokerWsUrl={brokerWsUrl}
            brokerHost={brokerHost}
            brokerPort={brokerPort}
            baseTopic={baseTopic}
            qos={qos}
            onEditConnection={() => setStep(0)}
            onEditMessages={() => setStep(1)}
          />
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border-color/80 pt-5">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(current - 1, 0))}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-border-color bg-bg-main px-4 text-sm font-semibold text-text-primary transition-colors hover:bg-card-hover-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
            <span>مرحله قبل</span>
          </button>
        ) : (
          <span />
        )}

        {step < MQTT_STEPS.length - 1 ? (
          <button
            type="submit"
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-accent3 px-5 text-sm font-bold text-accent3-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset"
          >
            <span>مرحله بعد</span>
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
        ) : (
          <Button
            type="submit"
            variant={isSaved ? "outline" : "accent"}
            className={`h-auto min-h-12 rounded-xl px-5 py-3 text-sm font-bold ${
              isSaved
                ? "border-success/40 bg-success-soft text-success hover:border-success/40 hover:bg-success-soft hover:text-success"
                : ""
            }`}
          >
            {isSaved ? (
              <>
                <Save className="size-4" />
                ذخیره شد
              </>
            ) : (
              <>
                <RefreshCw className="size-4" />
                ذخیره و اتصال مجدد
              </>
            )}
          </Button>
        )}
      </div>
    </form>
  );
}
