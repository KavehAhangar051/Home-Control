import { useId } from "react";
import { DashboardSlider } from "@/components/motion/dashboard-slider";
import { DeleteButton } from "@/components/ui/delete-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import {
  analogDutyToPercent,
  clampAnalogValue,
  clampPwmResolution,
  getAnalogMaxDuty,
  hasExplicitAnalogTargetValue,
  isAnalogOutputSegment,
  percentToAnalogDuty,
} from "@/features/iot/utils/analogOutput";

export interface ConditionAction {
  reqHold: number;
  targetPin: string;
  actionOn: boolean;
  actionType?: number;
  delay?: number;
  /** Optional explicit PWM duty cycle (`0..4095`). `-1` / null preserves boolean mode. */
  targetValue?: number | null;
}

const PWM_RULE_PERCENT_PRESETS = [0, 25, 50, 75, 100] as const;

interface Props {
  action: ConditionAction;
  idx: number;
  actions: ConditionAction[];
  onRemove: () => void;
  onUpdate: (updates: Partial<ConditionAction>) => void;
  showToast: (msg: string, type: "success" | "error") => void;
}

export function ConditionActionItem({
  action,
  idx,
  actions,
  onRemove,
  onUpdate,
  showToast,
}: Props) {
  const baseId = useId();
  const holdId = `${baseId}-hold`;
  const pinId = `${baseId}-pin`;
  const stateId = `${baseId}-state`;
  const typeId = `${baseId}-type`;
  const delayId = `${baseId}-delay`;

  const segments = useIoTStore((state) => state.segments);
  const pinsPwmResolution = useIoTStore((state) => state.pinsPwmResolution);

  const normalizedPin = action.targetPin.trim();
  const matchedSegment = normalizedPin
    ? segments.find((s) => s.type !== "placeholder" && s.pin.trim() === normalizedPin)
    : undefined;

  const isAnalogTarget =
    isAnalogOutputSegment(matchedSegment) || hasExplicitAnalogTargetValue(action.targetValue);
  const resolution = clampPwmResolution(
    pinsPwmResolution[normalizedPin] ?? matchedSegment?.pwmResolution,
  );
  const maxDuty = getAnalogMaxDuty(resolution);
  const isExactPwmMode = hasExplicitAnalogTargetValue(action.targetValue);
  const exactDuty = hasExplicitAnalogTargetValue(action.targetValue)
    ? clampAnalogValue(action.targetValue, resolution)
    : 0;
  const exactPercent = analogDutyToPercent(exactDuty, resolution);

  return (
    <div className="bg-card-bg-solid p-4 rounded-xl border border-border-color relative shadow-sm">
      <DeleteButton
        size="sm"
        resetAfter={0}
        onConfirm={onRemove}
        label="حذف عملیات"
        className="absolute top-2.5 left-2.5 z-10"
      />
      <div className="flex flex-col gap-3 text-xs pr-2">
        <div>
          <Label htmlFor={holdId} className="block font-semibold mb-1.5">
            شرط فعال‌سازی
          </Label>
          <Select
            id={holdId}
            aria-label="شرط فعال‌سازی"
            value={action.reqHold}
            onChange={(e) => {
              const val = Number.parseInt(e.target.value, 10);

              if (actions.some((a, i) => i !== idx && a.reqHold === val)) {
                showToast("این شرط قبلاً استفاده شده است", "error");

                return;
              }

              onUpdate({ reqHold: val });
            }}
            className="bg-bg-primary p-2.5 rounded-lg text-xs"
          >
            <option value={0}>تک کلیک / لحظه‌ای (فوری)</option>
            <option value={-1}>دابل کلیک (۲ بار فشردن سریع)</option>
            <option value={3}>نگه‌داشتن ۳ ثانیه</option>
            <option value={5}>نگه‌داشتن ۵ ثانیه</option>
            <option value={10}>نگه‌داشتن ۱۰ ثانیه</option>
          </Select>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Label htmlFor={pinId} className="block font-semibold mb-1.5">
              پایه هدف (GPIO)
            </Label>
            <Input
              id={pinId}
              aria-label="پایه هدف GPIO"
              type="text"
              placeholder="مثال: 4"
              value={action.targetPin}
              onChange={(e) => onUpdate({ targetPin: e.target.value.replace(/[^0-9]/g, "") })}
              className="bg-bg-primary p-2.5 rounded-lg text-xs text-left font-mono tabular-nums"
              dir="ltr"
            />
            {matchedSegment && (
              <p className="mt-1 text-[11px] text-text-muted truncate">
                متصل به: <span className="text-text-secondary">{matchedSegment.title}</span>
                {isAnalogOutputSegment(matchedSegment) && (
                  <span className="ms-1 text-accent3 font-medium">(PWM {resolution}-bit)</span>
                )}
              </p>
            )}
          </div>
          {!isExactPwmMode && (
            <div className="flex-1">
              <Label htmlFor={stateId} className="block font-semibold mb-1.5">
                وضعیت
              </Label>
              <Select
                id={stateId}
                aria-label="وضعیت خروجی"
                value={action.actionOn ? "1" : "0"}
                onChange={(e) =>
                  onUpdate({
                    actionOn: e.target.value === "1",
                    ...(isAnalogTarget ? { targetValue: -1 } : {}),
                  })
                }
                className="bg-bg-primary p-2.5 rounded-lg text-xs"
              >
                <option value="1">{isAnalogTarget ? "روشن (بازیابی آخرین شدت)" : "روشن"}</option>
                <option value="0">خاموش</option>
              </Select>
            </div>
          )}
        </div>

        {isAnalogTarget && (
          <div className="space-y-2.5 rounded-xl border border-border-color bg-bg-primary/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-text-secondary">حالت فرمان PWM</span>
              <div className="inline-flex rounded-lg border border-border-color bg-card-bg-solid p-0.5">
                <button
                  type="button"
                  aria-pressed={!isExactPwmMode}
                  onClick={() => onUpdate({ targetValue: -1 })}
                  className={`rounded-md px-2.5 py-1 text-[11px] transition-colors cursor-pointer ${
                    !isExactPwmMode
                      ? "bg-accent3 text-accent3-foreground font-semibold"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  کلید (حفظ شدت)
                </button>
                <button
                  type="button"
                  aria-pressed={isExactPwmMode}
                  onClick={() => {
                    const fallbackDuty = action.actionOn ? percentToAnalogDuty(50, resolution) : 0;
                    onUpdate({
                      targetValue: isExactPwmMode ? exactDuty : fallbackDuty,
                      actionOn: (isExactPwmMode ? exactDuty : fallbackDuty) > 0,
                    });
                  }}
                  className={`rounded-md px-2.5 py-1 text-[11px] transition-colors cursor-pointer ${
                    isExactPwmMode
                      ? "bg-accent3 text-accent3-foreground font-semibold"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  مقدار دقیق PWM
                </button>
              </div>
            </div>

            {isExactPwmMode && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-text-muted">شدت هدف ({resolution} بیت)</span>
                  <span className="font-mono font-semibold tabular-nums text-accent3" dir="ltr">
                    {exactPercent}% ({exactDuty}/{maxDuty})
                  </span>
                </div>
                <DashboardSlider
                  defaultVariant="range"
                  min={0}
                  max={maxDuty}
                  step={1}
                  value={exactDuty}
                  onValueChange={(nextDuty) => {
                    const clamped = clampAnalogValue(nextDuty, resolution);
                    onUpdate({ targetValue: clamped, actionOn: clamped > 0 });
                  }}
                  label="شدت هدف"
                  format={(val) => `${analogDutyToPercent(val, resolution)}%`}
                  unit="%"
                  rulerScale={{
                    min: 0,
                    max: 100,
                    step: 1,
                    majorEvery: 10,
                    unit: "%",
                    toDisplay: (raw) => analogDutyToPercent(raw, resolution),
                    fromDisplay: (pct) => percentToAnalogDuty(pct, resolution),
                  }}
                  aria-label="مقدار دقیق PWM هدف"
                  formatValueText={(val) => `${analogDutyToPercent(val, resolution)} درصد`}
                />
                <div className="flex flex-wrap items-center gap-1.5" dir="ltr">
                  {PWM_RULE_PERCENT_PRESETS.map((pct) => {
                    const presetDuty = percentToAnalogDuty(pct, resolution);
                    const isSelected = exactPercent === pct;

                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() =>
                          onUpdate({ targetValue: presetDuty, actionOn: presetDuty > 0 })
                        }
                        className={`rounded-md border px-2 py-0.5 font-mono text-[10px] tabular-nums transition-colors cursor-pointer ${
                          isSelected
                            ? "border-accent3 bg-accent3 text-accent3-foreground font-semibold"
                            : "border-border-color bg-card-bg-solid text-text-muted hover:text-text-primary"
                        }`}
                      >
                        {pct}%
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div>
          <Label htmlFor={typeId} className="block font-semibold mb-1.5">
            نوع عملیات
          </Label>
          <Select
            id={typeId}
            aria-label="نوع عملیات"
            value={action.actionType || 0}
            onChange={(e) => onUpdate({ actionType: Number.parseInt(e.target.value, 10) })}
            className="bg-bg-primary p-2.5 rounded-lg text-xs"
          >
            <option value={0}>فوری</option>
            <option value={1}>اجرا پس از تاخیر</option>
            <option value={2}>اجرا برای مدت مشخص</option>
          </Select>
        </div>
        {(action.actionType || 0) > 0 && (
          <div>
            <Label htmlFor={delayId} className="block font-semibold mb-1.5">
              زمان عملیات (ثانیه)
            </Label>
            <Input
              id={delayId}
              aria-label="زمان عملیات به ثانیه"
              type="number"
              min="1"
              max="60"
              value={action.delay || 10}
              onChange={(e) => {
                const raw = e.target.value;

                if (!raw) {
                  onUpdate({ delay: undefined });

                  return;
                }

                const parsed = Number.parseInt(raw, 10);

                if (!Number.isNaN(parsed)) {
                  onUpdate({ delay: parsed });
                }
              }}
              className="bg-bg-primary p-2.5 rounded-lg text-xs text-left"
              dir="ltr"
            />
          </div>
        )}
      </div>
    </div>
  );
}
