import { useCallback } from "react";
import type { SegmentRule } from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { defaultDeviceSyncGateway } from "@/features/iot/services/deviceGatewayAdapter";
import { publishUpdateRuleCommand } from "@/features/iot/services/mqttService";
import {
  type AnalogInputSegmentOptions,
  isAnalogInputSegment,
  isReadOnlyInputSegment,
  isValidAdc1Pin,
  normalizeAnalogInputConfig,
} from "@/features/iot/utils/analogInput";
import { validateRuleActionList } from "./core/segmentOperations";

export function useSegmentUpdates() {
  const setSegments = useIoTStore((state) => state.setSegments);

  const handleUpdateSegmentMode = useCallback(
    (id: string, mode: "switch" | "push") => {
      setSegments((prev) => {
        const target = prev.find((s) => s.id === id);

        if (!target || target.mode === mode) return prev;

        return prev.map((s) => (s.id === id ? { ...s, mode } : s));
      });
    },
    [setSegments],
  );

  const handleUpdateSegmentAutoOff = useCallback(
    (id: string, auto_off: number) => {
      setSegments((prev) => {
        const target = prev.find((s) => s.id === id);

        if (!target || target.auto_off === auto_off) return prev;

        return prev.map((s) => (s.id === id ? { ...s, auto_off } : s));
      });
    },
    [setSegments],
  );

  const handleUpdateSegmentRule = useCallback(
    (id: string, rule: SegmentRule) => {
      const errorMessage =
        validateRuleActionList(rule.highActions) ?? validateRuleActionList(rule.lowActions);

      if (errorMessage !== null) {
        useIoTStore.getState().showToast(`خطا در پایه: ${errorMessage}`, "error");

        return;
      }

      const targetSegment = useIoTStore.getState().segments.find((segment) => segment.id === id);
      if (!isReadOnlyInputSegment(targetSegment)) {
        useIoTStore.getState().showToast("سگمنت ورودی موردنظر در داشبورد پیدا نشد.", "error");
        return;
      }

      const inputPin = Number(targetSegment?.pin);
      if (!Number.isInteger(inputPin) || inputPin < 0 || inputPin > 39) {
        useIoTStore.getState().showToast("شماره GPIO سگمنت ورودی معتبر نیست.", "error");
        return;
      }

      setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, rule } : s)));
      publishUpdateRuleCommand(inputPin, rule.highActions || [], rule.lowActions || []);
    },
    [setSegments],
  );

  const handleUpdateAnalogInputConfig = useCallback(
    (id: string, config: AnalogInputSegmentOptions): boolean => {
      const store = useIoTStore.getState();
      const targetSegment = store.segments.find((segment) => segment.id === id);

      if (!targetSegment || !isAnalogInputSegment(targetSegment)) {
        store.showToast("سگمنت ورودی آنالوگ موردنظر پیدا نشد.", "error");
        return false;
      }

      if (!isValidAdc1Pin(targetSegment.pin)) {
        store.showToast("پایه انتخاب‌شده جزء کانال‌های مجاز ADC1 نیست.", "error");
        return false;
      }

      const normalized = normalizeAnalogInputConfig({
        adcResolution: config.adcResolution ?? targetSegment.adcResolution,
        adcSampleIntervalMs: config.adcSampleIntervalMs ?? targetSegment.adcSampleIntervalMs,
        adcDeltaThreshold: config.adcDeltaThreshold ?? targetSegment.adcDeltaThreshold,
        adcHighThreshold: config.adcHighThreshold ?? targetSegment.adcHighThreshold,
        adcLowThreshold: config.adcLowThreshold ?? targetSegment.adcLowThreshold,
      });

      setSegments((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                adcResolution: normalized.adcResolution,
                adcSampleIntervalMs: normalized.adcSampleIntervalMs,
                adcDeltaThreshold: normalized.adcDeltaThreshold,
                adcHighThreshold: normalized.adcHighThreshold,
                adcLowThreshold: normalized.adcLowThreshold,
              }
            : s,
        ),
      );

      store.setPinsPwmResolution((prev) =>
        prev[targetSegment.pin] === normalized.adcResolution
          ? prev
          : { ...prev, [targetSegment.pin]: normalized.adcResolution },
      );

      const delivered = defaultDeviceSyncGateway.updateAnalogInputConfig(targetSegment.pin, {
        ...normalized,
        adcResolution:
          config.adcResolution !== undefined ? normalized.adcResolution : undefined,
      });

      if (delivered) {
        store.showToast("تنظیمات سنسور آنالوگ روی دستگاه اعمال شد.", "success");
      } else {
        store.showToast("تنظیمات در داشبورد ذخیره شد اما ارتباط با دستگاه برقرار نیست.", "error");
      }

      return delivered;
    },
    [setSegments],
  );

  return {
    handleUpdateSegmentMode,
    handleUpdateSegmentAutoOff,
    handleUpdateSegmentRule,
    handleUpdateAnalogInputConfig,
  };
}
