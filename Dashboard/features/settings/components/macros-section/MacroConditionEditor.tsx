"use client";

import type {
  ConditionLogic,
  MacroActionCondition,
  Segment,
} from "@/features/iot/hooks/store/types";
import { ActionConditionsEditor } from "@/features/settings/components/shared/ActionConditionsEditor";

interface MacroConditionEditorProps {
  index: number;
  conditions: readonly MacroActionCondition[];
  conditionLogic?: ConditionLogic;
  segments: readonly Segment[];
  onChange: (nextConditions: MacroActionCondition[], nextLogic?: ConditionLogic) => void;
}

export function MacroConditionEditor({
  index,
  conditions,
  conditionLogic,
  segments,
  onChange,
}: MacroConditionEditorProps) {
  return (
    <ActionConditionsEditor
      actionLabel={`عملیات ${index + 1}`}
      conditions={conditions}
      conditionLogic={conditionLogic}
      segments={segments}
      allowTimeRange
      allowFailureMessage
      onChange={onChange}
    />
  );
}
