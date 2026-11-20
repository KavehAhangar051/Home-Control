import { Info } from "@/components/ui/hugeicons-groups/controls";
import { Settings2 } from "@/components/ui/hugeicons-groups/shell";
import { isAnalogInputSegment, normalizeAdcThresholds } from "@/features/iot/utils/analogInput";
import type { ConditionAction } from "./ConditionActionItem";
import { ConditionActionsList } from "./ConditionActionsList";

interface ConditionRule {
  highActions?: ConditionAction[];
  lowActions?: ConditionAction[];
}

interface Props {
  segment: {
    title: string;
    pin: string;
    type?: string;
    adcResolution?: number;
    adcHighThreshold?: number;
    adcLowThreshold?: number;
  };
  rule: ConditionRule;
  updateLocalRule: (type: "high" | "low", newActions: ConditionAction[]) => void;
  onSave: () => void;
}

export function ConditionSegment({ segment, rule, updateLocalRule, onSave }: Props) {
  const isAnalogInput = isAnalogInputSegment(segment);
  const thresholds = isAnalogInput
    ? normalizeAdcThresholds(
        segment.adcHighThreshold,
        segment.adcLowThreshold,
        segment.adcResolution,
      )
    : null;
  const isThresholdDisabled = Boolean(isAnalogInput && thresholds?.adcHighThreshold === 0);

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
        {isAnalogInput && thresholds && (
          <span
            dir="ltr"
            className="rounded-md border border-border-color bg-secondary px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums text-text-secondary"
          >
            {thresholds.adcHighThreshold > 0
              ? `ADC · ATL ${thresholds.adcLowThreshold} / ATH ${thresholds.adcHighThreshold}`
              : "ADC · ATH = 0"}
          </span>
        )}
      </div>

      {isThresholdDisabled && (
        <div className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning-soft px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300">
          <Info className="size-4 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            آستانه بالا (<span className="font-mono">ATH</span>) برای این سنسور روی{" "}
            <span className="font-mono font-semibold">0</span> تنظیم شده است؛ بنابراین موتور قوانین
            برای آن غیرفعال است. برای فعال شدن شرط‌ها، از منوی تنظیمات کارت همین سنسور در صفحه خانه
            مقدار آستانه بالا و پایین را تنظیم کنید.
          </p>
        </div>
      )}

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
          className="w-full py-3 bg-accent3 hover:bg-accent3-dark text-accent3-foreground text-sm font-bold rounded-xl transition-colors shadow-xs"
        >
          ثبت و ارسال
        </button>
      </div>
    </div>
  );
}
