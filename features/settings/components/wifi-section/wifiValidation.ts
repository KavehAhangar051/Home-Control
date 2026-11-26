import type { WifiNetwork } from "@/features/iot/hooks/store/types";

export const MAX_WIFI_NETWORKS = 5;

export interface WifiCredentialErrors {
  ssid?: string;
  password?: string;
}

export function getUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function validateWifiNetwork(
  ssid: string,
  password: string,
  networks: WifiNetwork[],
  editingId?: string,
): WifiCredentialErrors {
  const normalizedSsid = ssid.trim();
  const errors: WifiCredentialErrors = {};
  const ssidBytes = getUtf8ByteLength(normalizedSsid);
  const passwordBytes = getUtf8ByteLength(password);

  if (!normalizedSsid) {
    errors.ssid = "نام شبکه را وارد کنید.";
  } else if (ssidBytes > 32) {
    errors.ssid = `نام شبکه نباید بیشتر از ۳۲ بایت باشد (اکنون ${ssidBytes} بایت).`;
  } else if (networks.some((network) => network.id !== editingId && network.ssid.trim() === normalizedSsid)) {
    errors.ssid = "این نام شبکه قبلاً اضافه شده است.";
  }

  if (password && (passwordBytes < 8 || passwordBytes > 63)) {
    errors.password = `رمز شبکه باید ۸ تا ۶۳ بایت باشد (اکنون ${passwordBytes} بایت).`;
  }

  return errors;
}

export function validateWifiAccessPoint(ssid: string, password: string): WifiCredentialErrors {
  const normalizedSsid = ssid.trim();
  const errors: WifiCredentialErrors = {};

  if (!normalizedSsid && !password) return errors;

  const ssidBytes = getUtf8ByteLength(normalizedSsid);
  const passwordBytes = getUtf8ByteLength(password);

  if (!normalizedSsid) {
    errors.ssid = "برای تنظیم اکسس‌پوینت سفارشی، نام شبکه را وارد کنید.";
  } else if (ssidBytes > 32) {
    errors.ssid = `نام شبکه نباید بیشتر از ۳۲ بایت باشد (اکنون ${ssidBytes} بایت).`;
  }

  if (normalizedSsid && (passwordBytes < 8 || passwordBytes > 63)) {
    errors.password = `رمز اکسس‌پوینت باید ۸ تا ۶۳ بایت باشد (اکنون ${passwordBytes} بایت).`;
  }

  return errors;
}
