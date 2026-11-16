import type { AutomationAction, Macro, Segment } from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";

export function buildNewAutomationAction(
  type: "pin" | "macro",
  segments: readonly Pick<Segment, "type" | "pin">[],
  macros: readonly Pick<Macro, "id">[],
): AutomationAction {
  if (type === "pin") {
    const defaultSegment = segments.find(
      (seg) => seg.type !== "placeholder" && seg.type !== "input" && seg.pin.trim().length > 0,
    );

    return { targetPin: defaultSegment?.pin || "2", actionOn: true };
  }

  return { targetMacro: macros[0]?.id || "" };
}

export function updateAutomationActionAt(
  actions: readonly AutomationAction[],
  index: number,
  updates: Partial<AutomationAction>,
): AutomationAction[] {
  const next = [...actions];
  next[index] = { ...next[index], ...updates };

  return next;
}

export function removeAutomationActionAt(
  actions: readonly AutomationAction[],
  index: number,
): AutomationAction[] {
  return actions.filter((_, i) => i !== index);
}

export function useAutomationActions(
  actions: AutomationAction[],
  setActions: (actions: AutomationAction[]) => void,
) {
  const segments = useIoTStore((state) => state.segments);
  const macros = useIoTStore((state) => state.macros);

  const addAction = (type: "pin" | "macro") => {
    setActions([...actions, buildNewAutomationAction(type, segments, macros)]);
  };

  const updateAction = (index: number, updates: Partial<AutomationAction>) => {
    setActions(updateAutomationActionAt(actions, index, updates));
  };

  const removeAction = (index: number) => {
    setActions(removeAutomationActionAt(actions, index));
  };

  return {
    addAction,
    updateAction,
    removeAction,
    segments,
    macros,
  };
}
