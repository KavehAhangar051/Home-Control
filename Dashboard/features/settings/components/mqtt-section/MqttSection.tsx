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
import { MqttOverview } from "./MqttOverview";
import { MqttReviewStep } from "./MqttReviewStep";
import {
  validateMqttConnectionFields,
  validateMqttMessageFields,
  type MqttValidationErrors,
} from "./mqttValidation";
import { useMqttConnectionStatus } from "./useMqttConnectionStatus";

type MqttLocalOverrides = {
  brokerWsUrl?: string;
  brokerHost?: string;
  brokerPort?: number;
  baseTopic?: string;
  qos?: 0 | 1 | 2;
};

const MQTT_STEPS = ["اتصال", "پیام‌ها", "بازبینی"];
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

function focusFirstInvalidField(errors: MqttValidationErrors): void {
  const fieldOrder: Array<keyof MqttValidationErrors> = [
    "brokerWsUrl",
    "brokerHost",
    "brokerPort",
    "baseTopic",
  ];
  const fieldIds: Record<keyof MqttValidationErrors, string> = {
    brokerWsUrl: "mqtt-broker-ws-url",
    brokerHost: "mqtt-broker-host",
    brokerPort: "mqtt-broker-port",
    baseTopic: "mqtt-base-topic",
  };
  const firstInvalidField = fieldOrder.find((field) => errors[field]);

  if (firstInvalidField) {
    document.getElementById(fieldIds[firstInvalidField])?.focus();
  }
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
  const isEsp32Online = useIoTStore((state) => state.isLocal);
  const hasReceivedMqttStatus = useIoTStore((state) => state.hasReceivedMqttStatus);
  const esp32Ip = useIoTStore((state) => state.localIp);
  const { status: brokerStatus, retry: retryBrokerConnection } = useMqttConnectionStatus();

  const [overrides, setOverrides] = useState<MqttLocalOverrides>({});
  const [validationErrors, setValidationErrors] = useState<MqttValidationErrors>({});
  const [step, setStep] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { brokerWsUrl, brokerHost, brokerPort, baseTopic, qos } = resolveMqttDraftValues(
    overrides,
    mqttConfig,
    initialSettings,
  );

  const currentStepCopy = MQTT_STEP_COPY[step];

  const clearValidationError = (field: keyof MqttValidationErrors) => {
    setValidationErrors((previous) => {
      const next = { ...previous };
      delete next[field];
      return next;
    });
  };

  const setBrokerWsUrl = (val: string) => {
    clearValidationError("brokerWsUrl");
    setOverrides((prev) => ({ ...prev, brokerWsUrl: val }));
  };

  const setBrokerHost = (val: string) => {
    clearValidationError("brokerHost");
    setOverrides((prev) => ({ ...prev, brokerHost: val }));
  };

  const setBrokerPort = (val: number) => {
    clearValidationError("brokerPort");
    setOverrides((prev) => ({ ...prev, brokerPort: val }));
  };

  const setBaseTopic = (val: string) => {
    clearValidationError("baseTopic");
    setOverrides((prev) => ({ ...prev, baseTopic: val }));
  };

  const setQos = (val: 0 | 1 | 2) => {
    setOverrides((prev) => ({ ...prev, qos: val }));
  };

  const closeEditor = () => {
    setOverrides({});
    setValidationErrors({});
    setStep(0);
    setIsEditing(false);
  };

  const openEditor = () => {
    setOverrides({});
    setValidationErrors({});
    setStep(0);
    setIsEditing(true);
  };

  const handleSaveAndReconnect = async () => {
    if (isSaving) return;

    setIsSaving(true);
    soundManager.playClick();

    try {
      try {
        localStorage.setItem("mqtt_broker_url", brokerWsUrl);
        localStorage.setItem("mqtt_base_topic", baseTopic);
        localStorage.setItem("mqtt_qos", qos.toString());
      } catch {
        // Ignore storage write errors in restricted contexts
      }

      const newMqttConfig = {
        broker_ws_url: brokerWsUrl.trim(),
        broker_host: brokerHost.trim(),
        broker_port: brokerPort,
        base_topic: baseTopic.trim(),
        qos,
      };

      setMqttConfig(newMqttConfig);
      reconnectMqtt();

      if (!isCloudflareEnabled()) {
        showToast("تنظیمات MQTT ذخیره و اتصال مجدد آغاز شد.", "success");
        closeEditor();
        return;
      }

      const { result } = await persistStoreConfigToCloudflare({
        overrides: { mqttConfig: newMqttConfig },
      });

      if (result.success) {
        showToast("تنظیمات MQTT ذخیره و اتصال مجدد آغاز شد.", "success");
        closeEditor();
      } else {
        showToast("تنظیمات در داشبورد اعمال شد، اما ذخیره‌سازی ابری ناموفق بود.", "error");
      }
    } catch (error) {
      console.error("Failed to save MQTT settings to cloud", error);
      showToast("خطا در ارتباط با سرور کلودفلر", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleWizardSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (step === 0) {
      const errors = validateMqttConnectionFields({ brokerWsUrl, brokerHost, brokerPort });
      setValidationErrors(errors);

      if (Object.keys(errors).length > 0) {
        focusFirstInvalidField(errors);
        return;
      }

      setStep(1);
      return;
    }

    if (step === 1) {
      const errors = validateMqttMessageFields(baseTopic);
      setValidationErrors(errors);

      if (Object.keys(errors).length > 0) {
        focusFirstInvalidField(errors);
        return;
      }

      setStep(2);
      return;
    }

    void handleSaveAndReconnect();
  };

  if (!isEditing) {
    return (
      <MqttOverview
        brokerStatus={brokerStatus}
        isEsp32Online={isEsp32Online}
        hasReceivedMqttStatus={hasReceivedMqttStatus}
        esp32Ip={esp32Ip}
        brokerWsUrl={brokerWsUrl}
        brokerHost={brokerHost}
        brokerPort={brokerPort}
        baseTopic={baseTopic}
        qos={qos}
        onEdit={openEditor}
        onReconnect={retryBrokerConnection}
      />
    );
  }

  return (
    <form onSubmit={handleWizardSubmit} noValidate className="space-y-6">
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div aria-live="polite" aria-atomic="true" className="min-w-0 space-y-1">
            <h3 className="text-base font-bold text-text-primary">{currentStepCopy.title}</h3>
            <p className="text-xs leading-5 text-text-secondary sm:text-[13px]">
              {currentStepCopy.description}
            </p>
          </div>
          <button
            type="button"
            onClick={closeEditor}
            disabled={isSaving}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg px-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-card-hover-bg hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 disabled:cursor-not-allowed disabled:opacity-50"
          >
            لغو و مشاهده وضعیت
          </button>
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
            errors={validationErrors}
          />
        ) : step === 1 ? (
          <MqttMessageSettingsStep
            baseTopic={baseTopic}
            setBaseTopic={setBaseTopic}
            qos={qos}
            setQos={setQos}
            errors={validationErrors}
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
            disabled={isSaving}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-border-color bg-bg-main px-4 text-sm font-semibold text-text-primary transition-colors hover:bg-card-hover-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 disabled:cursor-not-allowed disabled:opacity-50"
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
            disabled={isSaving}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-accent3 px-5 text-sm font-bold text-accent3-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>مرحله بعد</span>
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
        ) : (
          <Button
            type="submit"
            disabled={isSaving}
            aria-busy={isSaving}
            variant="accent"
            className="h-auto min-h-12 rounded-xl px-5 py-3 text-sm font-bold"
          >
            {isSaving ? (
              <>
                <RefreshCw className="size-4 animate-spin" />
                در حال ذخیره...
              </>
            ) : (
              <>
                <Save className="size-4" />
                ذخیره و اتصال مجدد
              </>
            )}
          </Button>
        )}
      </div>
    </form>
  );
}
