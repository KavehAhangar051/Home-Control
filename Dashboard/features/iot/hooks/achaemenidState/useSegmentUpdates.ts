import { useCallback } from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { publishUpdateRuleCommand } from "@/features/iot/services/mqttService";
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
    (
      id: string,
      rule: {
        highActions?: Array<{
          reqHold: number;
          targetPin: string;
          actionOn: boolean;
          actionType?: number;
          delay?: number;
        }>;
        lowActions?: Array<{
          reqHold: number;
          targetPin: string;
          actionOn: boolean;
          actionType?: number;
          delay?: number;
        }>;
      },
    ) => {
      const errorMessage =
        validateRuleActionList(rule.highActions) ?? validateRuleActionList(rule.lowActions);

      if (errorMessage !== null) {
        useIoTStore.getState().showToast(`خطا در پایه: ${errorMessage}`, "error");

        return;
      }

      const targetSegment = useIoTStore.getState().segments.find((segment) => segment.id === id);
      if (targetSegment?.type !== "input") {
        useIoTStore.getState().showToast("سگمنت ورودی موردنظر در داشبورد پیدا نشد.", "error");
        return;
      }

      const inputPin = Number(targetSegment.pin);
      if (!Number.isInteger(inputPin) || inputPin < 0 || inputPin > 39) {
        useIoTStore.getState().showToast("شماره GPIO سگمنت ورودی معتبر نیست.", "error");
        return;
      }

      setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, rule } : s)));
      publishUpdateRuleCommand(inputPin, rule.highActions || [], rule.lowActions || []);
    },
    [setSegments],
  );

  return {
    handleUpdateSegmentMode,
    handleUpdateSegmentAutoOff,
    handleUpdateSegmentRule,
  };
}
