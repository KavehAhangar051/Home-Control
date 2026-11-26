"use client";

import { useId } from "react";
import { DeleteButton } from "@/components/ui/delete-button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { MacroAction, MacroActionKind, Segment } from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import {
  clampPwmResolution,
  hasExplicitAnalogTargetValue,
  isAnalogOutputSegment,
  percentToAnalogDuty,
} from "@/features/iot/utils/analogOutput";
import {
  DEFAULT_MACRO_HTTP_TIMEOUT_MS,
  getMacroActionConditions,
} from "@/features/iot/utils/macroEngine";
import { MacroAnalogActionFields } from "./MacroAnalogActionFields";
import { MacroConditionEditor } from "./MacroConditionEditor";
import { MacroHttpActionFields } from "./MacroHttpActionFields";

interface MacroActionCardProps {
  index: number;
  action: MacroAction;
  outputs: readonly Segment[];
  allSegments: readonly Segment[];
  onChange: (updates: Partial<MacroAction>) => void;
  onRemove: () => void;
}

export function MacroActionCard({
  index,
  action,
  outputs,
  allSegments,
  onChange,
  onRemove,
}: MacroActionCardProps) {
  const baseId = useId();
  const targetPinId = `${baseId}-target`;
  const pinsPwmResolution = useIoTStore((state) => state.pinsPwmResolution);

  const isHttpAction = action.actionKind === "http";
  const matchedOutput = outputs.find((seg) => seg.pin.trim() === action.targetPin.trim());
  const isAnalogTarget = !isHttpAction && isAnalogOutputSegment(matchedOutput);
  const pwmResolution = clampPwmResolution(
    pinsPwmResolution[action.targetPin] ?? matchedOutput?.pwmResolution,
  );
  const actionConditions = getMacroActionConditions(action);
  const activeConditionsCount = actionConditions.filter((c) => c.enabled !== false).length;

  const badgeLabel = isHttpAction
    ? `درخواست ${action.httpRequest?.method ?? "GET"}`
    : isAnalogTarget
      ? `خروجی آنالوگ PWM (${pwmResolution} بیت)`
      : "خروجی دیجیتال";

  const handleActionKindChange = (nextKind: MacroActionKind) => {
    if (nextKind === "http") {
      onChange({
        actionKind: "http",
        targetPin: "",
        actionOn: true,
        targetValue: undefined,
        analogMode: undefined,
        stepDelta: undefined,
        stepUnit: undefined,
        powerToggle: undefined,
        httpRequest: action.httpRequest ?? {
          method: "POST",
          url: "",
          contentType: "application/json",
          timeoutMs: DEFAULT_MACRO_HTTP_TIMEOUT_MS,
        },
      });
      return;
    }

    const fallbackSeg = matchedOutput ?? outputs[0];
    if (!fallbackSeg) return;

    const nextIsAnalog = isAnalogOutputSegment(fallbackSeg);
    const nextRes = clampPwmResolution(
      pinsPwmResolution[fallbackSeg.pin] ?? fallbackSeg.pwmResolution,
    );

    onChange({
      actionKind: undefined,
      httpRequest: undefined,
      targetPin: fallbackSeg.pin,
      actionOn: true,
      analogMode: nextIsAnalog ? "set" : undefined,
      targetValue: nextIsAnalog ? percentToAnalogDuty(50, nextRes) : undefined,
      stepDelta: undefined,
      stepUnit: undefined,
      powerToggle: undefined,
    });
  };

  const handleTargetPinChange = (nextPin: string) => {
    const nextSegment = outputs.find((seg) => seg.pin.trim() === nextPin.trim());

    if (isAnalogOutputSegment(nextSegment)) {
      const nextRes = clampPwmResolution(
        pinsPwmResolution[nextPin] ?? nextSegment?.pwmResolution,
      );
      const nextDuty = hasExplicitAnalogTargetValue(action.targetValue)
        ? action.targetValue
        : percentToAnalogDuty(50, nextRes);

      onChange({
        targetPin: nextPin,
        analogMode: "set",
        targetValue: nextDuty,
        actionOn: nextDuty > 0,
        stepDelta: undefined,
        stepUnit: undefined,
        powerToggle: undefined,
      });

      return;
    }

    onChange({
      targetPin: nextPin,
      targetValue: undefined,
      analogMode: undefined,
      stepDelta: undefined,
      stepUnit: undefined,
      powerToggle: undefined,
    });
  };

  return (
    <div className="space-y-3 rounded-xl border border-border-color bg-card-bg-solid p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-color/70 pb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-lg border border-border-color bg-bg-primary px-2 py-0.5 text-[11px] font-bold text-text-primary">
            عملیات {index + 1}
          </span>
          <span className="rounded-md border border-border-color bg-secondary px-2 py-0.5 text-[10px] font-medium text-text-secondary">
            {badgeLabel}
          </span>
          {activeConditionsCount > 0 && (
            <span className="rounded-md border border-accent3/40 bg-accent3/15 px-2 py-0.5 text-[10px] font-semibold text-accent3">
              {activeConditionsCount === 1 ? "شرط‌دار" : `${activeConditionsCount} شرط`}
            </span>
          )}
        </div>

        <DeleteButton
          size="sm"
          resetAfter={0}
          onConfirm={onRemove}
          label={`حذف عملیات ${index + 1}`}
        />
      </div>

      {/* Action Kind Switcher: GPIO Segment vs HTTP/HTTPS Request */}
      <div
        role="tablist"
        aria-label={`نوع عملیات ${index + 1}`}
        className="grid grid-cols-2 gap-1 rounded-xl border border-border-color bg-bg-primary p-1 text-xs"
      >
        <button
          type="button"
          role="tab"
          aria-selected={!isHttpAction}
          disabled={!outputs.length}
          onClick={() => handleActionKindChange("segment")}
          className={`cursor-pointer rounded-lg px-2 py-1.5 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            !isHttpAction
              ? "bg-accent3 text-accent3-foreground"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          کنترل قطعه (GPIO)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isHttpAction}
          onClick={() => handleActionKindChange("http")}
          className={`cursor-pointer rounded-lg px-2 py-1.5 font-semibold transition-colors ${
            isHttpAction
              ? "bg-accent3 text-accent3-foreground"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          درخواست HTTP / HTTPS
        </button>
      </div>

      {isHttpAction ? (
        <MacroHttpActionFields
          index={index}
          request={action.httpRequest}
          onChange={(httpRequest) => onChange({ httpRequest })}
        />
      ) : (
        <>
          {/* Target Output Selection */}
          <div className="space-y-1.5 text-xs">
            <Label htmlFor={targetPinId} className="font-semibold text-text-secondary">
              قطعه هدف
            </Label>
            <Select
              id={targetPinId}
              aria-label={`پایه عملیات ${index + 1}`}
              value={action.targetPin}
              onChange={(event) => handleTargetPinChange(event.target.value)}
              className="bg-bg-primary text-xs"
            >
              {outputs.map((segment) => (
                <option key={segment.id} value={segment.pin}>
                  {segment.title} — GPIO {segment.pin} (
                  {isAnalogOutputSegment(segment) ? "PWM آنالوگ" : "دیجیتال"})
                </option>
              ))}
            </Select>
          </div>

          {/* Target Action Value: Analog (Set / Step / Power) vs Digital ON/OFF */}
          {isAnalogTarget ? (
            <MacroAnalogActionFields
              index={index}
              action={action}
              pwmResolution={pwmResolution}
              onChange={onChange}
            />
          ) : (
            <fieldset
              aria-label={`وضعیت خروجی عملیات ${index + 1}`}
              className="grid grid-cols-2 gap-1.5 rounded-xl border border-border-color bg-bg-primary p-1"
            >
              <button
                type="button"
                aria-pressed={action.actionOn}
                onClick={() => onChange({ actionOn: true, targetValue: undefined })}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                  action.actionOn
                    ? "bg-accent3 text-accent3-foreground"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                روشن
              </button>
              <button
                type="button"
                aria-pressed={!action.actionOn}
                onClick={() => onChange({ actionOn: false, targetValue: undefined })}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                  !action.actionOn
                    ? "bg-destructive text-destructive-foreground"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                خاموش
              </button>
            </fieldset>
          )}
        </>
      )}

      {/* Per-Action Dashboard Condition */}
      <MacroConditionEditor
        index={index}
        conditions={actionConditions}
        conditionLogic={action.conditionLogic}
        segments={allSegments}
        onChange={(nextConditions, nextLogic) =>
          onChange({
            condition: undefined,
            conditions: nextConditions.length > 0 ? nextConditions : undefined,
            conditionLogic: nextConditions.length > 1 ? nextLogic : undefined,
          })
        }
      />
    </div>
  );
}
