import { AnimatePresence, m } from "motion/react";
import { useMemo } from "react";
import { DashboardSlider } from "@/components/motion/dashboard-slider";
import { Card } from "@/components/ui/card";
import { ChevronDown, Plus, Settings2 } from "@/components/ui/hugeicons-groups/shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  type AnalogSegmentOptions,
  getAnalogMaxDuty,
  isAnalogOutputType,
  MAX_PWM_FREQUENCY,
  MIN_PWM_FREQUENCY,
  percentToAnalogDuty,
} from "@/features/iot/utils/analogOutput";
import {
  DURATION,
  EASE_IN_OUT,
  ERROR_SHAKE_KEYFRAMES,
  SPRING_PRESS,
  TRANSITION_ENTER_QUICK,
  TRANSITION_EXIT_QUICK,
} from "@/lib/ease";
import type { Segment } from "../core/types";
import { useAddSegmentForm } from "../hooks/useAddSegmentForm";
import ButtonModeSelector from "./ButtonModeSelector";
import FormDetailsInput from "./FormDetailsInput";
import PinSelector from "./PinSelector";

const PWM_FREQUENCY_PRESETS = [1000, 5000, 20000] as const;

interface AddSegmentFormProps {
  onAddSegment: (
    type: string,
    pin: string,
    title?: string,
    group?: string,
    mode?: "switch" | "push",
    auto_off?: number,
    icon?: string,
    groupIcon?: string,
    analogConfig?: AnalogSegmentOptions,
  ) => void;
  onClose: () => void;
  segments: Segment[];
  animationsEnabled: boolean;
}

export default function AddSegmentForm({
  onAddSegment,
  onClose,
  segments,
  animationsEnabled,
}: AddSegmentFormProps) {
  const {
    selectedType,
    setSelectedType,
    targetPin,
    setTargetPin,
    customTitle,
    setCustomTitle,
    groupName,
    setGroupName,
    segmentIcon,
    setSegmentIcon,
    groupIcon,
    setGroupIcon,
    errorText,
    buttonMode,
    setButtonMode,
    pwmResolution,
    setPwmResolution,
    pwmFrequency,
    setPwmFrequency,
    initialPercent,
    setInitialPercent,
    showAdvanced,
    setShowAdvanced,
    groupsOrder,
    handleSubmit,
  } = useAddSegmentForm(segments, onAddSegment, onClose);

  const isAnalog = isAnalogOutputType(selectedType);
  const maxDuty = getAnalogMaxDuty(pwmResolution);
  const initialDuty = percentToAnalogDuty(initialPercent, pwmResolution);

  const usedPins = useMemo(
    () =>
      new Set(
        segments
          .filter((s) => s.type !== "placeholder" && s.pin.trim().length > 0)
          .map((s) => s.pin.trim()),
      ),
    [segments],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="min-w-0 sm:bezel-shell">
        <Card className="bezel-core !gap-4 !p-3 sm:!p-4">
          <div className="flex items-center gap-2 text-text-primary border-b border-border-color pb-3">
            <Plus strokeWidth={1.5} className="size-4 text-accent3" />
            <span className="text-sm font-medium font-sans">افزودن سگمنت جدید</span>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="segment-monitoring-type" className="block">
              نوع سگمنت مانیتورینگ
            </Label>
            <Select
              id="segment-monitoring-type"
              aria-label="نوع سگمنت مانیتورینگ"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="text-xs rounded-lg font-sans"
            >
              <option value="gpio_toggle" className="bg-card-bg-solid">
                کلید کنترل پایه (خاموش و روشن)
              </option>
              <option value="analog_output" className="bg-card-bg-solid">
                خروجی آنالوگ (PWM / دیمر)
              </option>
              <option value="input" className="bg-card-bg-solid">
                ورودی دیجیتال (۰ و ۱)
              </option>
            </Select>
          </div>

          <PinSelector
            customPin={targetPin}
            setCustomPin={setTargetPin}
            selectedType={selectedType}
            usedPins={usedPins}
          />

          <FormDetailsInput
            customTitle={customTitle}
            setCustomTitle={setCustomTitle}
            groupName={groupName}
            setGroupName={setGroupName}
            segmentIcon={segmentIcon}
            setSegmentIcon={setSegmentIcon}
            groupIcon={groupIcon}
            setGroupIcon={setGroupIcon}
            existingGroups={groupsOrder}
          />

          <AnimatePresence initial={false}>
            {isAnalog && (
              <m.div
                key="analog-pwm-settings"
                initial={animationsEnabled ? { height: 0, opacity: 0 } : false}
                animate={{ height: "auto", opacity: 1 }}
                exit={
                  animationsEnabled
                    ? { height: 0, opacity: 0 }
                    : { opacity: 0, transition: { duration: 0 } }
                }
                transition={
                  animationsEnabled
                    ? {
                        height: { duration: 0.22, ease: TRANSITION_ENTER_QUICK.ease },
                        opacity: { duration: 0.16, ease: TRANSITION_EXIT_QUICK.ease },
                      }
                    : { duration: 0 }
                }
                className="overflow-hidden"
              >
                <div className="space-y-3.5 rounded-xl border border-border-color bg-secondary/40 p-3">
                  <div className="flex items-center justify-between gap-2 border-b border-border-color/70 pb-2">
                    <span className="text-xs font-medium text-text-primary">
                      تنظیمات PWM (LEDC)
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-text-muted" dir="ltr">
                      0..{maxDuty}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="pwm-resolution-select" className="block text-xs">
                        دقت (Resolution)
                      </Label>
                      <Select
                        id="pwm-resolution-select"
                        aria-label="دقت PWM"
                        value={pwmResolution}
                        onChange={(e) => setPwmResolution(Number.parseInt(e.target.value, 10))}
                        className="text-xs rounded-lg font-sans"
                      >
                        <option value={8} className="bg-card-bg-solid">
                          ۸ بیت (۰ تا ۲۵۵ — پیش‌فرض)
                        </option>
                        <option value={9} className="bg-card-bg-solid">
                          ۹ بیت (۰ تا ۵۱۱)
                        </option>
                        <option value={10} className="bg-card-bg-solid">
                          ۱۰ بیت (۰ تا ۱۰۲۳)
                        </option>
                        <option value={11} className="bg-card-bg-solid">
                          ۱۱ بیت (۰ تا ۲۰۴۷)
                        </option>
                        <option value={12} className="bg-card-bg-solid">
                          ۱۲ بیت (۰ تا ۴۰۹۵)
                        </option>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="pwm-frequency-input" className="block text-xs">
                        فرکانس (Hz)
                      </Label>
                      <Input
                        id="pwm-frequency-input"
                        aria-label="فرکانس PWM بر حسب هرتز"
                        type="number"
                        min={MIN_PWM_FREQUENCY}
                        max={MAX_PWM_FREQUENCY}
                        step={100}
                        value={pwmFrequency}
                        onChange={(e) => {
                          const parsed = Number.parseInt(e.target.value, 10);
                          if (!Number.isNaN(parsed)) setPwmFrequency(parsed);
                        }}
                        className="text-xs font-mono tabular-nums rounded-lg text-right"
                        dir="ltr"
                      />
                      <div className="flex items-center gap-1" dir="ltr">
                        {PWM_FREQUENCY_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setPwmFrequency(preset)}
                            className={`rounded border px-1.5 py-0.5 font-mono text-[10px] tabular-nums transition-colors cursor-pointer ${
                              pwmFrequency === preset
                                ? "border-accent3 bg-accent3 text-bg-main font-semibold"
                                : "border-border-color bg-card-bg-solid text-text-muted hover:text-text-primary"
                            }`}
                          >
                            {preset >= 1000 ? `${preset / 1000}kHz` : `${preset}Hz`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-secondary">مقدار اولیه هنگام ساخت</span>
                      <span
                        className="font-mono text-[11px] tabular-nums text-text-primary"
                        dir="ltr"
                      >
                        {initialPercent}% ({initialDuty}/{maxDuty})
                      </span>
                    </div>
                    <DashboardSlider
                      defaultVariant="bubble"
                      min={0}
                      max={100}
                      step={1}
                      value={initialPercent}
                      onValueChange={setInitialPercent}
                      label="شدت اولیه"
                      format={(val) => `${val}%`}
                      unit="%"
                      aria-label="مقدار اولیه خروجی آنالوگ"
                      formatValueText={(val) => `${val} درصد`}
                    />
                  </div>
                </div>
              </m.div>
            )}
          </AnimatePresence>

          {!isAnalog && (
            <div className="pt-2 border-t border-border-color">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between text-text-secondary hover:text-text-primary transition-colors py-2"
              >
                <div className="flex items-center gap-2">
                  <Settings2 strokeWidth={1.5} className="size-4" />
                  <span className="text-xs font-medium">تنظیمات جانبی</span>
                </div>
                <ChevronDown
                  strokeWidth={1.5}
                  className={`size-4 transition-transform duration-200 ${showAdvanced ? "rotate-180" : ""}`}
                />
              </button>

              <AnimatePresence initial={false}>
                {showAdvanced && (
                  <m.div
                    key="advanced-settings"
                    initial={animationsEnabled ? { height: 0, opacity: 0 } : false}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={
                      animationsEnabled
                        ? { height: 0, opacity: 0 }
                        : { opacity: 0, transition: { duration: 0 } }
                    }
                    transition={
                      animationsEnabled
                        ? {
                            height: { duration: 0.22, ease: TRANSITION_ENTER_QUICK.ease },
                            opacity: { duration: 0.16, ease: TRANSITION_EXIT_QUICK.ease },
                          }
                        : { duration: 0 }
                    }
                    className="overflow-hidden"
                  >
                    <div className="pt-3 pb-1 space-y-4">
                      {selectedType === "gpio_toggle" && (
                        <ButtonModeSelector
                          buttonMode={buttonMode}
                          setButtonMode={setButtonMode}
                          animationsEnabled={animationsEnabled}
                        />
                      )}
                      {selectedType !== "gpio_toggle" && (
                        <p className="text-xs text-text-muted text-center">
                          تنظیمات جانبی برای این نوع سگمنت وجود ندارد
                        </p>
                      )}
                    </div>
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <AnimatePresence mode="wait">
            {errorText && (
              <m.p
                key={errorText}
                initial={animationsEnabled ? { opacity: 0, y: -4 } : false}
                animate={{
                  opacity: 1,
                  y: 0,
                  x: animationsEnabled ? [...ERROR_SHAKE_KEYFRAMES] : 0,
                }}
                exit={
                  animationsEnabled
                    ? { opacity: 0, y: -4, transition: TRANSITION_EXIT_QUICK }
                    : undefined
                }
                transition={{
                  ...TRANSITION_ENTER_QUICK,
                  x: { duration: DURATION.slow, ease: EASE_IN_OUT },
                }}
                className="text-xs text-destructive font-sans mt-2"
              >
                {errorText}
              </m.p>
            )}
          </AnimatePresence>
          <m.button
            type="submit"
            whileTap={animationsEnabled ? { scale: 0.98 } : undefined}
            transition={SPRING_PRESS}
            className="group mt-4 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-accent3 py-2 pr-4 pl-2 font-sans text-sm font-medium text-bg-main transition-opacity duration-150 hover:opacity-90"
          >
            <span>ایجاد سگمنت</span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-bg-main/15 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:scale-105">
              <Plus strokeWidth={2} className="size-3.5" aria-hidden="true" />
            </span>
          </m.button>
        </Card>
      </div>
    </form>
  );
}
