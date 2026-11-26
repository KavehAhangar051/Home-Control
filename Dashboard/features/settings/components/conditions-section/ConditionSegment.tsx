import { Settings2 } from "@/components/ui/hugeicons-groups/shell";
import type { AnalogRangeRule, Segment, SegmentRule } from "@/features/iot/hooks/store/types";
import {
  clampAdcResolution,
  getAdcMaxValue,
  isAnalogInputSegment,
} from "@/features/iot/utils/analogInput";
import { AnalogRangeRuleEditor } from "./AnalogRangeRuleEditor";
import type { ConditionAction } from "./ConditionActionItem";
import { ConditionActionsList } from "./ConditionActionsList";

interface Props {
  segment: Segment;
  rule: SegmentRule;
  updateLocalRule: (type: "high" | "low", newActions: ConditionAction[]) => void;
  updateAnalogRanges: (newRanges: AnalogRangeRule[]) => void;
  onSave: () => void;
}

export function ConditionSegment({
  segment,
  rule,
  updateLocalRule,
  updateAnalogRanges,
  onSave,
}: Props) {
  const isAnalogInput = isAnalogInputSegment(segment);
  const resolution = isAnalogInput ? clampAdcResolution(segment.adcResolution) : 12;
  const maxAdcValue = isAnalogInput ? getAdcMaxValue(resolution) : 4095;

  return (
    <div className="p-5 border border-border-color rounded-2xl bg-card-bg-solid shadow-sm flex flex-col gap-5">
      <div className="font-bold text-sm text-accent3 flex flex-wrap items-center justify-between gap-2 border-b border-border-color pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-accent3-transparent text-accent3 shrink-0">
            <Settings2 aria-hidden="true" className="size-4" />
          </div>
          <span className="truncate">
            {segment.title} (پایه: {segment.pin})
          </span>
        </div>
        {isAnalogInput && (
          <span
            dir="ltr"
            className="rounded-md border border-border-color bg-secondary px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums text-text-secondary"
          >
            ADC {resolution}-bit · 0..{maxAdcValue}
          </span>
        )}
      </div>

      {isAnalogInput ? (
        <AnalogRangeRuleEditor
          segment={segment}
          ranges={rule.analogRanges || []}
          onUpdate={updateAnalogRanges}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <ConditionActionsList
            type="high"
            inputPin={segment.pin}
            actions={rule.highActions || []}
            onUpdate={(newActions) => updateLocalRule("high", newActions)}
          />
          <ConditionActionsList
            type="low"
            inputPin={segment.pin}
            actions={rule.lowActions || []}
            onUpdate={(newActions) => updateLocalRule("low", newActions)}
          />
        </div>
      )}

      <div className="flex justify-end mt-2">
        <button
          type="button"
          onClick={onSave}
          className="w-full py-3 bg-accent3 hover:bg-accent3-dark text-accent3-foreground text-sm font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
        >
          ثبت و ارسال
        </button>
      </div>
    </div>
  );
}
