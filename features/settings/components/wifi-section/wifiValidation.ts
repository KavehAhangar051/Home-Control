import type { WifiNetwork } from "@/features/iot/hooks/store/types";

export const MAX_WIFI_NETWORKS = 5;
export const MAX_SSID_BYTES = 32;
export const MIN_PASSWORD_BYTES = 8;
export const MAX_PASSWORD_BYTES = 63;

export interface WifiCredentialErrors {
  ssid?: string;
  password?: string;
}

const utf8Encoder = new TextEncoder();

/** Returns exact UTF-8 byte length of a string (ESP32 NVS / Wi-Fi 32/63-byte bounds). */
export function getUtf8ByteLength(value: string): number {
  return utf8Encoder.encode(value).length;
}

export function validateWifiNetworkCredentials(params: {
  ssid: string;
  password: string;
  existingNetworks: readonly WifiNetwork[];
  editingNetworkId?: string | null;
}): WifiCredentialErrors {
  const errors: WifiCredentialErrors = {};
  const trimmedSsid = params.ssid.trim();
  const ssidBytes = getUtf8ByteLength(trimmedSsid);
  const passwordBytes = getUtf8ByteLength(params.password);

  if (!trimmedSsid) {
    errors.ssid = "نام شبکه (SSID) را وارد کنید.";
  } else if (ssidBytes > MAX_SSID_BYTES) {
    errors.ssid = `نام شبکه نباید بیشتر از ${MAX_SSID_BYTES} بایت UTF-8 باشد.`;
  } else if (
    params.existingNetworks.some(
      (net) => net.id !== params.editingNetworkId && net.ssid.trim() === trimmedSsid,
    )
  ) {
    errors.ssid = "این شبکه قبلاً در فهرست ذخیره شده است.";
  }

  if (passwordBytes > 0 && passwordBytes < MIN_PASSWORD_BYTES) {
    errors.password = `رمز عبور باید حداقل ${MIN_PASSWORD_BYTES} بایت باشد (یا برای شبکهٔ باز خالی بگذارید).`;
  } else if (passwordBytes > MAX_PASSWORD_BYTES) {
    errors.password = `رمز عبور نباید بیشتر از ${MAX_PASSWORD_BYTES} بایت باشد.`;
  }

  return errors;
}

export function validateWifiAccessPointCredentials(params: {
  ssid: string;
  password: string;
}): WifiCredentialErrors {
  const errors: WifiCredentialErrors = {};
  const trimmedSsid = params.ssid.trim();
  const ssidBytes = getUtf8ByteLength(trimmedSsid);
  const passwordBytes = getUtf8ByteLength(params.password);

  // Explicit empty/empty resets provisioning AP to device MAC-derived default.
  if (!trimmedSsid && !params.password) {
    return errors;
  }

  if (!trimmedSsid) {
    errors.ssid = "برای تعیین رمز عبور سفارشی، نام شبکه (SSID) اکسس‌پوینت را هم وارد کنید.";
  } else if (ssidBytes > MAX_SSID_BYTES) {
    errors.ssid = `نام اکسس‌پوینت نباید بیشتر از ${MAX_SSID_BYTES} بایت UTF-8 باشد.`;
  }

  if (passwordBytes < MIN_PASSWORD_BYTES) {
    errors.password = `رمز عبور اکسس‌پوینت باید بین ${MIN_PASSWORD_BYTES} تا ${MAX_PASSWORD_BYTES} بایت باشد.`;
  } else if (passwordBytes > MAX_PASSWORD_BYTES) {
    errors.password = `رمز عبور اکسس‌پوینت نباید بیشتر از ${MAX_PASSWORD_BYTES} بایت باشد.`;
  }

  return errors;
}
