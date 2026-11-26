export interface MqttConnectionValues {
  brokerWsUrl: string;
  brokerHost: string;
  brokerPort: number;
}

export interface MqttValidationErrors {
  brokerWsUrl?: string;
  brokerHost?: string;
  brokerPort?: string;
  baseTopic?: string;
}

export function validateMqttConnectionFields({
  brokerWsUrl,
  brokerHost,
  brokerPort,
}: MqttConnectionValues): MqttValidationErrors {
  const errors: MqttValidationErrors = {};
  const normalizedUrl = brokerWsUrl.trim();
  const normalizedHost = brokerHost.trim();

  try {
    const url = new URL(normalizedUrl);

    if ((url.protocol !== "ws:" && url.protocol !== "wss:") || !url.hostname) {
      errors.brokerWsUrl = "نشانی باید با ws:// یا wss:// شروع شود و میزبان معتبری داشته باشد.";
    }
  } catch {
    errors.brokerWsUrl = "یک نشانی معتبر WebSocket وارد کنید؛ مانند wss://broker.example.com:8084/mqtt.";
  }

  if (!normalizedHost || /[\s/?#@]/.test(normalizedHost) || normalizedHost.includes("://")) {
    errors.brokerHost = "نام میزبان یا نشانی IP بروکر را بدون پروتکل و مسیر وارد کنید.";
  } else {
    try {
      const hostUrl = new URL(`http://${normalizedHost}`);

      if (!hostUrl.hostname || hostUrl.port || hostUrl.pathname !== "/" || hostUrl.search || hostUrl.hash) {
        errors.brokerHost = "فقط نام میزبان یا IP را وارد کنید؛ پورت در فیلد جداگانه قرار می‌گیرد.";
      }
    } catch {
      errors.brokerHost = "نام میزبان یا نشانی IP معتبر وارد کنید.";
    }
  }

  if (!Number.isInteger(brokerPort) || brokerPort < 1 || brokerPort > 65535) {
    errors.brokerPort = "پورت باید یک عدد صحیح بین ۱ تا ۶۵۵۳۵ باشد.";
  }

  return errors;
}

export function validateMqttMessageFields(baseTopic: string): MqttValidationErrors {
  const normalizedTopic = baseTopic.trim();

  if (!normalizedTopic) {
    return { baseTopic: "پیشوند موضوع‌ها را وارد کنید." };
  }

  if (normalizedTopic.includes("#") || normalizedTopic.includes("+") || normalizedTopic.includes("\0")) {
    return { baseTopic: "پیشوند موضوع نمی‌تواند شامل نویسه‌های رزروشده # یا + باشد." };
  }

  return {};
}
