import { useCallback } from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { publishUpdateRuleCommand } from "@/features/iot/services/mqttService";
import { validateEsp32Pin } from "@/features/iot/utils/pinValidation";

export function useSegmentUpdates() {
  const setSegments = useIoTStore((state) => state.setSegments);

  const handleUpdateSegmentMode = useCallback(
    (id: string, mode: "switch" | "push") => {
      setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, mode } : s)));
    },
    [setSegments],
  );

  const handleUpdateSegmentAutoOff = useCallback(
    (id: string, auto_off: number) => {
      setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, auto_off } : s)));
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
      const allActions = [...(rule.highActions || []), ...(rule.lowActions || [])];

      for (const action of allActions) {
        if (action.targetPin) {
          const validation = validateEsp32Pin(action.targetPin, "output");

          if (!validation.isValid) {
            useIoTStore.getState().showToast(`خطا در پایه: ${validation.message}`, "error");

            return;
          }
        }
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
