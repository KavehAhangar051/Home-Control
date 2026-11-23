"use client";

import { AnimatePresence, m } from "motion/react";
import { useMemo, useState } from "react";
import { ProgressSteps } from "@/components/dissolve/progress-steps";
import { DashboardSlider } from "@/components/motion/dashboard-slider";
import { Card } from "@/components/ui/card";
import {
  Activity,
  Check,
  Cpu,
  Info,
  Power,
  Server,
  Waves,
} from "@/components/ui/hugeicons-groups/controls";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Settings2,
  Sliders,
} from "@/components/ui/hugeicons-groups/shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { isAnalogInputType } from "@/features/iot/utils/analogInput";
import {
  getAnalogMaxDuty,
  isAnalogOutputType,
  MAX_PWM_FREQUENCY,
  MIN_PWM_FREQUENCY,
  percentToAnalogDuty,
} from "@/features/iot/utils/analogOutput";
import {
  DURATION,
  EASE_IN_OUT,
  EASE_OUT,
  ERROR_SHAKE_KEYFRAMES,
  SPRING_PRESS,
  TRANSITION_ENTER_QUICK,
  TRANSITION_EXIT_QUICK,
} from "@/lib/ease";
import { cn } from "@/lib/utils";
import type { Segment } from "../core/types";
import { type OnAddSegmentFn, useAddSegmentForm } from "../hooks/useAddSegmentForm";
import AnalogInputSettingsPanel from "./AnalogInputSettingsPanel";
import ButtonModeSelector from "./ButtonModeSelector";
import FormDetailsInput from "./FormDetailsInput";
import PinSelector from "./PinSelector";
import VirtualPinSelector from "./VirtualPinSelector";

const PWM_FREQUENCY_PRESETS = [1000, 5000, 20000] as const;

const WIZARD_STEP_LABELS = ["نوع قطعه", "پایه و رفتار", "نام و گروه"];

interface SegmentTypeOption {
  value: "gpio_toggle" | "analog_output" | "input" | "analog_input";
  label: string;
  summary: string;
  icon: typeof Power;
}

const SEGMENT_TYPE_OPTIONS: readonly SegmentTypeOption[] = [
  {
    value: "gpio_toggle",
    label: "کلید کنترل",
    summary: "چراغ، رله یا پمپ",
    icon: Power,
  },
  {
    value: "analog_output",
    label: "دیمر (PWM)",
    summary: "نور، فن یا دور موتور",
    icon: Sliders,
  },
  {
    value: "input",
    label: "ورودی دیجیتال",
    summary: "کلید، سنسور حرکت یا درب",
    icon: Activity,
  },
  {
    value: "analog_input",
    label: "سنسور آنالوگ",
    summary: "نور، رطوبت، گاز یا ولتاژ",
    icon: Waves,
  },
];

interface AddSegmentFormProps {
  onAddSegment: OnAddSegmentFn;
  onClose: () => void;
  segments: Segment[];
  animationsEnabled: boolean;
  targetPlaceholder?: Segment;
}

export default function AddSegmentForm({
  onAddSegment,
  onClose,
  segments,
  animationsEnabled,
  targetPlaceholder,
}: AddSegmentFormProps) {
  const openAuxNodeModal = useIoTStore((s) => s.openAuxNodeModal);
  const [stepDirection, setStepDirection] = useState<1 | -1>(1);
  const [showPwmAdvanced, setShowPwmAdvanced] = useState(false);

  const {
    step,
    maxUnlockedStep,
    goToNextStep,
    goToPrevStep,
    goToStep,
    sourceMode,
    setSourceMode,
    auxNodes,
    selectedNodeId,
    setSelectedNodeId,
    selectedAuxNode,
    remotePin,
    setRemotePin,
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
    adcResolution,
    handleAdcResolutionChange,
    adcSampleIntervalMs,
    setAdcSampleIntervalMs,
    adcDeltaThreshold,
    setAdcDeltaThreshold,
    adcHighThreshold,
    setAdcHighThreshold,
    adcLowThreshold,
    setAdcLowThreshold,
    applyAdcPreset,
    groupsOrder,
    handleSubmit,
  } = useAddSegmentForm(segments, onAddSegment, onClose, targetPlaceholder);

  const isAnalogOutput = isAnalogOutputType(selectedType);
  const isAnalogInput = isAnalogInputType(selectedType);
  const maxDuty = getAnalogMaxDuty(pwmResolution);
  const initialDuty = percentToAnalogDuty(initialPercent, pwmResolution);

  const selectedTypeMeta =
    SEGMENT_TYPE_OPTIONS.find((opt) => opt.value === selectedType) ?? SEGMENT_TYPE_OPTIONS[0];
  const SelectedTypeIcon = selectedTypeMeta.icon;

  const usedPins = useMemo(
    () =>
      new Set(
        segments
          .filter((s) => s.type !== "placeholder" && s.pin.trim().length > 0)
          .map((s) => s.pin.trim()),
      ),
    [segments],
  );

  const resolvedPinSummary =
    sourceMode === "virtual"
      ? selectedAuxNode
        ? `${selectedAuxNode.name} · GPIO ${remotePin.trim() || "—"}`
        : "برد کمکی انتخاب نشده"
      : `ESP32 · GPIO ${targetPin.trim() || "—"}`;

  const resolvedGroupSummary =
    sourceMode === "virtual"
      ? selectedAuxNode?.groupName || "—"
      : groupName.trim() || groupsOrder[0] || "Test";

  const handleNext = (event?: React.MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    setStepDirection(1);
    goToNextStep();
  };

  const handlePrev = () => {
    setStepDirection(-1);
    goToPrevStep();
  };

  const handleStepClick = (targetIndex: number) => {
    setStepDirection(targetIndex >= step ? 1 : -1);
    goToStep(targetIndex);
  };

  const slideOffset = stepDirection * -14;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="min-w-0 sm:bezel-shell">
        <Card className="bezel-core !gap-5 !p-3.5 sm:!p-5">
          <div className="border-b border-border-color/80 pb-4 pt-1">
            <ProgressSteps
              steps={WIZARD_STEP_LABELS}
              current={step}
              size="md"
              reducedMotion={!animationsEnabled}
              onStepPress={(index) => {
                if (index <= Math.max(step, maxUnlockedStep)) {
                  handleStepClick(index);
                }
              }}
              labelClassName="font-sans"
            />
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {step === 0 && (
              <m.div
                key="add-segment-step-0"
                initial={animationsEnabled ? { opacity: 0, x: slideOffset } : false}
                animate={{ opacity: 1, x: 0 }}
                exit={
                  animationsEnabled
                    ? {
                        opacity: 0,
                        x: -slideOffset,
                        transition: { duration: 0.14, ease: EASE_OUT },
                      }
                    : { opacity: 0, transition: { duration: 0 } }
                }
                transition={animationsEnabled ? { duration: 0.2, ease: EASE_OUT } : { duration: 0 }}
                className="space-y-5"
              >
                <div className="space-y-2">
                  <span className="block text-xs font-medium text-text-secondary">نوع قطعه</span>
                  <fieldset aria-label="نوع قطعه" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {SEGMENT_TYPE_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const isSelected = selectedType === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => setSelectedType(option.value)}
                          className={cn(
                            "group relative flex min-h-16 cursor-pointer items-start gap-3 rounded-xl border p-3 text-start transition-[border-color,background-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset",
                            isSelected
                              ? "border-accent3 bg-accent3/10 ring-1 ring-accent3/25"
                              : "border-border-color bg-card-bg hover:border-text-muted/40 hover:bg-card-hover-bg",
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
                              isSelected
                                ? "border-accent3/30 bg-accent3 text-accent3-foreground"
                                : "border-border-color bg-bg-main text-text-secondary group-hover:text-text-primary",
                            )}
                          >
                            <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
                          </span>

                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate font-sans text-xs font-semibold text-text-primary">
                                {option.label}
                              </span>
                              {isSelected && (
                                <Check
                                  className="size-3.5 shrink-0 text-accent3"
                                  strokeWidth={2.25}
                                  aria-hidden="true"
                                />
                              )}
                            </div>
                            <p className="text-[11px] leading-5 text-text-muted">
                              {option.summary}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </fieldset>
                </div>

                <div className="space-y-2 border-t border-border-color/70 pt-4">
                  <span className="block text-xs font-medium text-text-secondary">برد متصل</span>
                  <div
                    role="tablist"
                    aria-label="انتخاب برد مبدأ قطعه"
                    className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={sourceMode === "local"}
                      onClick={() => setSourceMode("local")}
                      className={cn(
                        "flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset",
                        sourceMode === "local"
                          ? "border-accent3 bg-accent3/10 text-text-primary"
                          : "border-border-color bg-card-bg text-text-secondary hover:bg-card-hover-bg hover:text-text-primary",
                      )}
                    >
                      <Server
                        className={cn(
                          "size-4 shrink-0",
                          sourceMode === "local" ? "text-accent3" : "text-text-muted",
                        )}
                        strokeWidth={1.75}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold">
                          برد مرکزی (ESP32)
                        </span>
                        <span className="block truncate text-[11px] text-text-muted">
                          پایه‌های هاب اصلی
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      role="tab"
                      aria-selected={sourceMode === "virtual"}
                      onClick={() => setSourceMode("virtual")}
                      className={cn(
                        "flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset",
                        sourceMode === "virtual"
                          ? "border-accent3 bg-accent3/10 text-text-primary"
                          : "border-border-color bg-card-bg text-text-secondary hover:bg-card-hover-bg hover:text-text-primary",
                      )}
                    >
                      <Cpu
                        className={cn(
                          "size-4 shrink-0",
                          sourceMode === "virtual" ? "text-accent3" : "text-text-muted",
                        )}
                        strokeWidth={1.75}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-xs font-semibold">برد کمکی بی‌سیم</span>
                          {auxNodes.length > 0 && (
                            <span className="rounded-md bg-accent3/15 px-1.5 py-0.5 font-mono text-[10px] leading-none tabular-nums text-accent3">
                              {auxNodes.length}
                            </span>
                          )}
                        </div>
                        <span className="block truncate text-[11px] text-text-muted">
                          ماژول جانبی متصل به هاب
                        </span>
                      </div>
                    </button>
                  </div>
                </div>
              </m.div>
            )}

            {step === 1 && (
              <m.div
                key="add-segment-step-1"
                initial={animationsEnabled ? { opacity: 0, x: slideOffset } : false}
                animate={{ opacity: 1, x: 0 }}
                exit={
                  animationsEnabled
                    ? {
                        opacity: 0,
                        x: -slideOffset,
                        transition: { duration: 0.14, ease: EASE_OUT },
                      }
                    : { opacity: 0, transition: { duration: 0 } }
                }
                transition={animationsEnabled ? { duration: 0.2, ease: EASE_OUT } : { duration: 0 }}
                className="space-y-5"
              >
                {sourceMode === "virtual" ? (
                  <VirtualPinSelector
                    auxNodes={auxNodes}
                    selectedNodeId={selectedNodeId}
                    onSelectNodeId={setSelectedNodeId}
                    remotePin={remotePin}
                    onChangeRemotePin={setRemotePin}
                    segments={segments}
                    onOpenAuxNodeModal={() => openAuxNodeModal()}
                  />
                ) : (
                  <PinSelector
                    customPin={targetPin}
                    setCustomPin={setTargetPin}
                    selectedType={selectedType}
                    usedPins={usedPins}
                  />
                )}

                {selectedType === "gpio_toggle" && (
                  <div className="border-t border-border-color/70 pt-4">
                    <ButtonModeSelector
                      buttonMode={buttonMode}
                      setButtonMode={setButtonMode}
                      animationsEnabled={animationsEnabled}
                    />
                  </div>
                )}

                {isAnalogOutput && (
                  <div className="space-y-4 border-t border-border-color/70 pt-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium text-text-secondary">
                          شدت اولیه هنگام ساخت
                        </span>
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

                    <div className="border-t border-border-color/70 pt-3">
                      <button
                        type="button"
                        onClick={() => setShowPwmAdvanced((prev) => !prev)}
                        aria-expanded={showPwmAdvanced}
                        className="flex min-h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-lg py-1 text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3"
                      >
                        <span className="flex items-center gap-2 text-xs font-medium">
                          <Settings2 className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                          تنظیمات تخصصی PWM (دقت و فرکانس)
                        </span>
                        <ChevronDown
                          className={cn(
                            "size-4 transition-transform duration-200",
                            showPwmAdvanced && "rotate-180",
                          )}
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                      </button>

                      <AnimatePresence initial={false}>
                        {showPwmAdvanced && (
                          <m.div
                            key="pwm-advanced"
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
                                    height: { duration: 0.2, ease: TRANSITION_ENTER_QUICK.ease },
                                    opacity: { duration: 0.14, ease: TRANSITION_EXIT_QUICK.ease },
                                  }
                                : { duration: 0 }
                            }
                            className="overflow-hidden"
                            style={{ contain: "layout style", backfaceVisibility: "hidden" }}
                          >
                            <div className="grid grid-cols-1 gap-3 pt-3 sm:grid-cols-2">
                              <div className="space-y-1.5">
                                <Label htmlFor="pwm-resolution-select" className="block text-xs">
                                  دقت خروجی (بیت)
                                </Label>
                                <Select
                                  id="pwm-resolution-select"
                                  aria-label="دقت PWM"
                                  value={pwmResolution}
                                  onChange={(e) =>
                                    setPwmResolution(Number.parseInt(e.target.value, 10))
                                  }
                                  className="rounded-lg font-sans text-xs"
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
                                  فرکانس (هرتز)
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
                                  className="rounded-lg text-right font-mono text-xs tabular-nums"
                                  dir="ltr"
                                />
                                <div className="flex items-center gap-1.5" dir="ltr">
                                  {PWM_FREQUENCY_PRESETS.map((preset) => (
                                    <button
                                      key={preset}
                                      type="button"
                                      onClick={() => setPwmFrequency(preset)}
                                      className={cn(
                                        "min-h-7 cursor-pointer rounded-md border px-2 py-0.5 font-mono text-[11px] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3",
                                        pwmFrequency === preset
                                          ? "border-accent3 bg-accent3 font-semibold text-accent3-foreground"
                                          : "border-border-color bg-card-bg-solid text-text-muted hover:text-text-primary",
                                      )}
                                    >
                                      {preset >= 1000 ? `${preset / 1000}kHz` : `${preset}Hz`}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </m.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}

                {isAnalogInput && (
                  <div className="border-t border-border-color/70 pt-4">
                    <AnalogInputSettingsPanel
                      adcResolution={adcResolution}
                      onResolutionChange={handleAdcResolutionChange}
                      adcSampleIntervalMs={adcSampleIntervalMs}
                      setAdcSampleIntervalMs={setAdcSampleIntervalMs}
                      adcDeltaThreshold={adcDeltaThreshold}
                      setAdcDeltaThreshold={setAdcDeltaThreshold}
                      adcHighThreshold={adcHighThreshold}
                      setAdcHighThreshold={setAdcHighThreshold}
                      adcLowThreshold={adcLowThreshold}
                      setAdcLowThreshold={setAdcLowThreshold}
                      onApplyPreset={applyAdcPreset}
                      animationsEnabled={animationsEnabled}
                    />
                  </div>
                )}
              </m.div>
            )}

            {step === 2 && (
              <m.div
                key="add-segment-step-2"
                initial={animationsEnabled ? { opacity: 0, x: slideOffset } : false}
                animate={{ opacity: 1, x: 0 }}
                exit={
                  animationsEnabled
                    ? {
                        opacity: 0,
                        x: -slideOffset,
                        transition: { duration: 0.14, ease: EASE_OUT },
                      }
                    : { opacity: 0, transition: { duration: 0 } }
                }
                transition={animationsEnabled ? { duration: 0.2, ease: EASE_OUT } : { duration: 0 }}
                className="space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-color/80 bg-secondary/35 px-3 py-2.5 text-xs">
                  <div className="flex min-w-0 items-center gap-2">
                    <SelectedTypeIcon
                      className="size-4 shrink-0 text-accent3"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <span className="truncate font-semibold text-text-primary">
                      {customTitle.trim() || selectedTypeMeta.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                    <span className="font-mono tabular-nums" dir="ltr">
                      {resolvedPinSummary}
                    </span>
                    <span aria-hidden="true">•</span>
                    <span>گروه: {resolvedGroupSummary}</span>
                  </div>
                </div>

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
                  lockedGroupName={
                    sourceMode === "virtual" ? selectedAuxNode?.groupName : undefined
                  }
                />
              </m.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {errorText && (
              <m.div
                key={errorText}
                role="alert"
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
                className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                <span className="font-sans leading-5">{errorText}</span>
              </m.div>
            )}
          </AnimatePresence>

          <div
            className={cn(
              "flex items-center gap-2.5 border-t border-border-color/80 pt-4",
              step > 0 ? "justify-between" : "justify-end",
            )}
          >
            {step > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-border-color bg-card-bg px-4 text-xs font-medium text-text-secondary transition-colors hover:bg-card-hover-bg hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3"
              >
                <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
                <span>مرحله قبل</span>
              </button>
            )}

            {step < 2 ? (
              <m.button
                key="add-segment-next-btn"
                type="button"
                onClick={handleNext}
                whileTap={animationsEnabled ? { scale: 0.98 } : undefined}
                transition={SPRING_PRESS}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-accent3 px-5 font-sans text-xs font-semibold text-accent3-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset"
              >
                <span>مرحله بعد</span>
                <ChevronLeft className="size-4" strokeWidth={2} aria-hidden="true" />
              </m.button>
            ) : (
              <m.button
                key="add-segment-submit-btn"
                type="submit"
                whileTap={animationsEnabled ? { scale: 0.98 } : undefined}
                transition={SPRING_PRESS}
                className="group inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent3 py-2 pr-5 pl-2.5 font-sans text-xs font-semibold text-accent3-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset"
              >
                <span>ایجاد قطعه</span>
                <span className="flex size-7 items-center justify-center rounded-lg bg-accent3-foreground/15 transition-transform duration-200 ease-out group-hover:scale-105">
                  <Plus strokeWidth={2} className="size-3.5" aria-hidden="true" />
                </span>
              </m.button>
            )}
          </div>
        </Card>
      </div>
    </form>
  );
}
