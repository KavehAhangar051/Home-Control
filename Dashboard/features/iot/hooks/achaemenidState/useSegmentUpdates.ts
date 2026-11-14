import { useCallback } from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { publishUpdateRuleCommand } from "@/features/iot/services/mqttService";
import { validateEsp32Pin } from "@/features/iot/utils/pinValidation";

function validateRuleActionList(actions?: Array<{ targetPin: string }>): string | null {
  if (!actions) return null;

  for (let i = 0; i < actions.length; i++) {
    const targetPin = actions[i].targetPin;
    if (targetPin) {
      const validation = validateEsp32Pin(targetPin, "output");
      if (!validation.isValid) {
        return validation.message;
      }
    }
  }

  return null;
}

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

      setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, rule } : s)));
      publishUpdateRuleCommand(id, rule.highActions || [], rule.lowActions || []);
    },
    [setSegments],
  );

  return {
    handleUpdateSegmentMode,
    handleUpdateSegmentAutoOff,
    handleUpdateSegmentRule,
  };
}
