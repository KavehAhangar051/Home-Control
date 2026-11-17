import { Settings2 } from "@/components/ui/hugeicons";
import type { ConditionAction } from "./ConditionActionItem";
import { ConditionActionsList } from "./ConditionActionsList";

interface ConditionRule {
  highActions?: ConditionAction[];
  lowActions?: ConditionAction[];
}

interface Props {
  segment: { title: string; pin: string };
  rule: ConditionRule;
  updateLocalRule: (type: "high" | "low", newActions: ConditionAction[]) => void;
  onSave: () => void;
}

export function ConditionSegment({ segment, rule, updateLocalRule, onSave }: Props) {
  return (
    <div className="p-5 border border-border-color rounded-2xl bg-card-bg-solid shadow-sm flex flex-col gap-5">
      <div className="font-bold text-sm text-accent3 flex items-center gap-2 border-b border-border-color pb-3">
        <div className="p-1.5 rounded-lg bg-accent3-transparent text-accent3">
          <Settings2 aria-hidden="true" className="size-4" />
        </div>
        {segment.title} (پایه: {segment.pin})
      </div>
      <div className="flex flex-col gap-4">
        <ConditionActionsList
          type="high"
          actions={rule.highActions || []}
          onUpdate={(newActions) => updateLocalRule("high", newActions)}
        />
        <ConditionActionsList
          type="low"
          actions={rule.lowActions || []}
          onUpdate={(newActions) => updateLocalRule("low", newActions)}
        />
      </div>
      <div className="flex justify-end mt-2">
        <button
          type="button"
          onClick={onSave}
          className="w-full py-3 bg-accent3 hover:bg-accent3-dark text-bg-main text-sm font-bold rounded-xl transition-colors shadow-xs"
        >
          ثبت و ارسال
        </button>
      </div>
    </div>
  );
}
