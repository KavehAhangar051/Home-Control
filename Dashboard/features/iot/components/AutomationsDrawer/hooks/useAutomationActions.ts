import type { AutomationAction } from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";

export function useAutomationActions(
  actions: AutomationAction[],
  setActions: (actions: AutomationAction[]) => void,
) {
  const segments = useIoTStore((state) => state.segments);
  const macros = useIoTStore((state) => state.macros);

  const addAction = (type: "pin" | "macro") => {
    if (type === "pin") {
      setActions([...actions, { targetPin: segments[0]?.pin || "2", actionOn: true }]);
    } else {
      setActions([...actions, { targetMacro: macros[0]?.id || "" }]);
    }
  };

  const updateAction = (index: number, updates: Partial<AutomationAction>) => {
    const newActions = [...actions];
    newActions[index] = { ...newActions[index], ...updates };
    setActions(newActions);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  return {
    addAction,
    updateAction,
    removeAction,
    segments,
    macros,
  };
}
