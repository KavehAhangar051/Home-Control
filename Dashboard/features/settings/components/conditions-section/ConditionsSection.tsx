"use client";

import { useState } from "react";
import { Info } from "@/components/ui/hugeicons-groups/controls";
import { Settings2 } from "@/components/ui/hugeicons-groups/shell";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { publishUpdateRuleCommand } from "@/features/iot/services/mqttService";
import { isReadOnlyInputSegment } from "@/features/iot/utils/analogInput";
import {
  hasExplicitAnalogTargetValue,
  isAnalogOutputSegment,
  MAX_ANALOG_OUTPUT_VALUE,
} from "@/features/iot/utils/analogOutput";
import { validateEsp32Pin } from "@/features/iot/utils/pinValidation";
import type { ConditionAction } from "./ConditionActionItem";
import { ConditionSegment } from "./ConditionSegment";

export default function ConditionsSection() {
  const segments = useIoTStore((state) => state.segments);
  const updateSegmentRule = useIoTStore((state) => state.updateSegmentRule);
  const showToast = useIoTStore((state) => state.showToast);

  const [localRules, setLocalRules] = useState<
    Record<
      string,
      {
        highActions: ConditionAction[];
        lowActions: ConditionAction[];
      }
    >
  >({});

  const inputSegments = segments.filter((s) => isReadOnlyInputSegment(s));

  return (
    <div className="space-y-6">
      <div className="bg-accent3-transparent border border-accent3 text-accent3 p-4 rounded-xl text-xs flex gap-3 items-start">
        <Info className="size-5 shrink-0 mt-0.5" />
        <p className="leading-relaxed font-medium">
          برای ورودی‌های دیجیتال و سنسورهای آنالوگ (ADC دارای آستانه) می‌توانید عملیات جداگانه تعریف
          کنید. هر وضعیت می‌تواند تا ۴ عملیات روی خروجی‌های دیجیتال یا PWM داشته باشد.
        </p>
      </div>

      {inputSegments.length === 0 ? (
        <div className="text-center py-8 px-4 bg-card-bg-solid rounded-2xl border border-dashed border-border-color space-y-1.5">
          <Settings2 className="size-7 mx-auto text-text-secondary opacity-45" />
          <p className="text-sm font-semibold text-text-primary">
            هنوز قطعه ورودی در داشبورد ثبت نشده است
          </p>
          <p className="text-xs text-text-secondary max-w-sm mx-auto leading-relaxed">
            ابتدا از بخش «پالایه و ماژول‌ها» یک قطعه از نوع «ورودی دیجیتال» یا «ورودی آنالوگ (ADC)»
            بسازید تا بتوانید برای آن شرط تعریف کنید.
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {inputSegments.map((segment) => {
            const originalRule = segment.rule || { highActions: [], lowActions: [] };

            const rule = localRules[segment.id] || {
              highActions: originalRule.highActions || [],
              lowActions: originalRule.lowActions || [],
            };

            const handleSave = () => {
              const allActions = [...(rule.highActions || []), ...(rule.lowActions || [])];

              for (const action of allActions) {
                const pin = action.targetPin.trim();
                if (pin) {
                  const matchedSeg = segments.find(
                    (s) => s.type !== "placeholder" && s.pin.trim() === pin,
                  );
                  if (isReadOnlyInputSegment(matchedSeg)) {
                    showToast(
                      `پایه GPIO ${pin} به‌عنوان ورودی تعریف شده و نمی‌تواند هدف خروجی باشد.`,
                      "error",
                    );

                    return;
                  }
                  const val = validateEsp32Pin(
                    pin,
                    isAnalogOutputSegment(matchedSeg) ? "analog_output" : "output",
                  );

                  if (!val.isValid) {
                    showToast(`خطا در پایه: ${val.message}`, "error");

                    return;
                  }
                }

                if (
                  hasExplicitAnalogTargetValue(action.targetValue) &&
                  action.targetValue > MAX_ANALOG_OUTPUT_VALUE
                ) {
                  showToast(
                    `مقدار PWM هدف باید بین ۰ تا ${MAX_ANALOG_OUTPUT_VALUE} باشد.`,
                    "error",
                  );

                  return;
                }
              }

              updateSegmentRule(segment.id, rule);
              publishUpdateRuleCommand(Number(segment.pin), rule.highActions, rule.lowActions);
              showToast("شرط‌ها با موفقیت ثبت و به دستگاه ارسال شدند.", "success");
            };

            const updateLocalRule = (type: "high" | "low", newActions: ConditionAction[]) => {
              setLocalRules((prev) => ({
                ...prev,
                [segment.id]: {
                  ...rule,
                  [type === "high" ? "highActions" : "lowActions"]: newActions,
                },
              }));
            };

            return (
              <ConditionSegment
                key={segment.id}
                segment={segment}
                rule={rule}
                updateLocalRule={updateLocalRule}
                onSave={handleSave}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
