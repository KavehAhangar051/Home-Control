export interface MqttValidationErrors {
  brokerWsUrl?: string;
  brokerHost?: string;
  brokerPort?: string;
  baseTopic?: string;
}

export function validateMqttConnectionFields(fields: {
  brokerWsUrl: string;
  brokerHost: string;
  brokerPort: number;
}): MqttValidationErrors {
  const errors: MqttValidationErrors = {};
  const trimmedWs = fields.brokerWsUrl.trim();
  const trimmedHost = fields.brokerHost.trim();
  const port = fields.brokerPort;

  if (!trimmedWs) {
    errors.brokerWsUrl = "نشانی WebSocket بروکر را وارد کنید.";
  } else {
    try {
      const parsed = new URL(trimmedWs);
      if ((parsed.protocol !== "ws:" && parsed.protocol !== "wss:") || !parsed.hostname) {
        errors.brokerWsUrl =
          "نشانی WebSocket باید با ws:// یا wss:// شروع شود و میزبان معتبر داشته باشد.";
      }
    } catch {
      errors.brokerWsUrl =
        "فرمت نشانی WebSocket معتبر نیست (مثال: wss://broker.emqx.io:8084/mqtt).";
    }
  }

  if (!trimmedHost) {
    errors.brokerHost = "نام میزبان یا آدرس IP بروکر را وارد کنید.";
  } else if (/\s/.test(trimmedHost) || trimmedHost.includes("://")) {
    errors.brokerHost = "تنها نام دامنه یا IP میزبان را بدون فاصله و پیشوند پروتکل وارد کنید.";
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.brokerPort = "پورت TCP باید عددی صحیح بین ۱ تا ۶۵۵۳۵ باشد.";
  }

  return errors;
}

export function validateMqttMessageFields(baseTopic: string): MqttValidationErrors {
  const errors: MqttValidationErrors = {};
  const trimmedTopic = baseTopic.trim();

  if (!trimmedTopic) {
    errors.baseTopic = "پیشوند موضوع پایه (Base Topic) را وارد کنید.";
  } else if (
    /\s/.test(trimmedTopic) ||
    trimmedTopic.includes("+") ||
    trimmedTopic.includes("#") ||
    trimmedTopic.startsWith("/") ||
    trimmedTopic.endsWith("/")
  ) {
    errors.baseTopic =
      "پیشوند موضوع نباید شامل فاصله، کاراکترهای + یا # و اسلش در ابتدا یا انتها باشد.";
  }

  return errors;
}
