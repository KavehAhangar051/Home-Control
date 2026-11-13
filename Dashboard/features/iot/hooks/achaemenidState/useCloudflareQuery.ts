"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * این hook فقط وضعیت mount را مدیریت می‌کند.
 * وضعیت پین‌ها از ESP32 از طریق MQTT می‌آید (در services/mqtt/init.ts پارس می‌شود).
 * CloudFlare فقط برای UI Config (رنگ، نام، تنظیمات) استفاده می‌شود، نه برای وضعیت پین‌ها.
 */
export function useCloudflareQuery() {
  const mounted = useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);

  // refetchIot برای سازگاری با کد موجود نگه داشته شده
  const refetchIot = async () => {};

  return {
    mounted,
    refetchIot,
  };
}
