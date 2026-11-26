"use client";

import { useState } from "react";
import { Settings2 } from "@/components/ui/hugeicons-groups/shell";
import {
  validateAnalogRangeRuleList,
  validateRuleActionList,
} from "@/features/iot/hooks/achaemenidState/core/segmentOperations";
import type { AnalogRangeRule, SegmentRule } from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { isSegmentRuleActive } from "@/features/iot/services/cloudflare/mappers";
import {
  publishUpdateAnalogRangeRulesCommand,
  publishUpdateRuleCommand,
} from "@/features/iot/services/mqttService";
import { isAnalogInputSegment, isReadOnlyInputSegment } from "@/features/iot/utils/analogInput";
import { isValidManagedPin } from "@/features/iot/utils/auxNodeUtils";
import type { ConditionAction } from "./ConditionActionItem";
import { ConditionSegment } from "./ConditionSegment";

export default function ConditionsSection() {
  const segments = useIoTStore((state) => state.segments);
  const pinsPwmResolution = useIoTStore((state) => state.pinsPwmResolution);
  const updateSegmentRule = useIoTStore((state) => state.updateSegmentRule);
  const showToast = useIoTStore((state) => state.showToast);

  const [localRules, setLocalRules] = useState<Record<string, SegmentRule>>({});

  const inputSegments = segments.filter((s) => isReadOnlyInputSegment(s));

  return (
    <div className="space-y-5">
      {inputSegments.length === 0 ? (
        <div className="text-center py-8 px-4 bg-card-bg-solid rounded-2xl border border-dashed border-border-color space-y-1.5">
          <Settings2 className="size-6 mx-auto text-text-muted opacity-50" />
          <p className="text-sm font-medium text-text-primary">قطعه ورودی ثبت نشده است</p>
          <p className="text-xs text-text-muted max-w-sm mx-auto leading-relaxed">
            ابتدا در بخش «پالایه و ماژول‌ها» یک ورودی دیجیتال یا سنسور آنالوگ بسازید
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {inputSegments.map((segment) => {
            const originalRule = segment.rule || {
              highActions: [],
              lowActions: [],
              analogRanges: [],
            };

            const rule: SegmentRule = localRules[segment.id] || {
              highActions: originalRule.highActions || [],
              lowActions: originalRule.lowActions || [],
              analogRanges: originalRule.analogRanges || [],
            };

            const isAnalogInput = isAnalogInputSegment(segment);

            const handleSave = () => {
              const inputPin = Number(segment.pin);
              if (!isValidManagedPin(inputPin)) {
                showToast("شماره پایه قطعه ورودی معتبر نیست.", "error");
                return;
              }

              if (isAnalogInput) {
                const nextRanges = rule.analogRanges || [];
                const effectiveAdcResolution =
                  pinsPwmResolution[segment.pin] ?? segment.adcResolution;
                const rangeError = validateAnalogRangeRuleList(
                  nextRanges,
                  segment.pin,
                  effectiveAdcResolution,
                  segments,
                );

                if (rangeError !== null) {
                  showToast(rangeError, "error");
                  return;
                }

                const nextRule: SegmentRule = {
                  ...rule,
                  highActions: rule.highActions || [],
                  lowActions: rule.lowActions || [],
                  analogRanges: nextRanges,
                  active: isSegmentRuleActive({ ...rule, analogRanges: nextRanges }),
                };

                updateSegmentRule(segment.id, nextRule);
                const delivered = publishUpdateAnalogRangeRulesCommand(inputPin, nextRanges, segments);
                showToast(
                  delivered
                    ? "قوانین چندبازه‌ای آنالوگ ثبت و به دستگاه ارسال شدند."
                    : "قوانین چندبازه‌ای ذخیره شدند؛ اتصال MQTT برای ارسال آنی برقرار نیست.",
                  "success",
                );
                return;
              }

              const digitalError =
                validateRuleActionList(rule.highActions, segments, segment.pin) ??
                validateRuleActionList(rule.lowActions, segments, segment.pin);

              if (digitalError !== null) {
                showToast(`خطا در پایه: ${digitalError}`, "error");
                return;
              }

              const nextRule: SegmentRule = {
                ...rule,
                highActions: rule.highActions || [],
                lowActions: rule.lowActions || [],
                active: isSegmentRuleActive(rule),
              };

              updateSegmentRule(segment.id, nextRule);
              const delivered = publishUpdateRuleCommand(
                inputPin,
                nextRule.highActions,
                nextRule.lowActions,
                segments,
              );
              showToast(
                delivered
                  ? "شرط‌ها با موفقیت ثبت و به دستگاه ارسال شدند."
                  : "شرط‌ها ذخیره شدند؛ اتصال MQTT برای ارسال آنی برقرار نیست.",
                "success",
              );
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

            const updateAnalogRanges = (newRanges: AnalogRangeRule[]) => {
              setLocalRules((prev) => ({
                ...prev,
                [segment.id]: {
                  ...rule,
                  analogRanges: newRanges,
                },
              }));
            };

            return (
              <ConditionSegment
                key={segment.id}
                segment={segment}
                rule={rule}
                updateLocalRule={updateLocalRule}
                updateAnalogRanges={updateAnalogRanges}
                onSave={handleSave}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
