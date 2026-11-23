"use client";

import { AnimatePresence, m } from "motion/react";
import { useId, useState } from "react";
import { type ProgressStepItem, ProgressSteps } from "@/components/motion/progress-steps";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Edit2, Info, Thermometer } from "@/components/ui/hugeicons-groups/controls";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Clock3,
  Plus,
} from "@/components/ui/hugeicons-groups/shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import {
  DURATION,
  EASE_IN_OUT,
  EASE_OUT,
  ERROR_SHAKE_KEYFRAMES,
  TRANSITION_ENTER_QUICK,
  TRANSITION_EXIT_QUICK,
} from "@/lib/ease";
import { cn } from "@/lib/utils";
import {
  type AutomationFormHookValue,
  useOptionalAutomationContext,
} from "../../context/AutomationContext";
import ActionBuilder from "./ActionBuilder";
import {
  ScheduleFields,
  TimerFields,
  WeatherConditionFields,
  WeatherIntervalFields,
} from "./AutomationFields";

type AutomationStep = 0 | 1 | 2;

const AUTOMATION_STEPS: readonly ProgressStepItem[] = [
  {
    id: "type",
    title: "نوع اتوماسیون",
    description: "عنوان و روش اجرای خودکار (زمان‌بندی، تایمر یا دما) را انتخاب کنید",
  },
  {
    id: "trigger",
    title: "زمان و شرط",
    description: "زمان‌بندی اجرا و در صورت نیاز شرط دمای محیط را مشخص کنید",
  },
  {
    id: "actions",
    title: "عملیات و ثبت",
    description: "قطعه‌ها یا دکمه‌هایی که باید اجرا شوند را اضافه و ذخیره کنید",
  },
];

interface AutomationTypeCardOption {
  value: "schedule" | "timer" | "weather";
  label: string;
  summary: string;
  icon: typeof Clock3;
}

const AUTOMATION_TYPE_OPTIONS: readonly AutomationTypeCardOption[] = [
  {
    value: "schedule",
    label: "زمان‌بندی دوره‌ای",
    summary: "اجرای منظم در ساعت و روزهای مشخص هفته",
    icon: Clock3,
  },
  {
    value: "timer",
    label: "تایمر یک‌بار مصرف",
    summary: "اجرای خودکار پس از گذشت ساعت و دقیقه دلخواه",
    icon: Clock,
  },
  {
    value: "weather",
    label: "مبتنی بر دما",
    summary: "بررسی دوره‌ای دمای شهر و واکنش خودکار",
    icon: Thermometer,
  },
];

interface AutomationFormProps {
  formHook?: AutomationFormHookValue;
}

export default function AutomationForm({ formHook: propFormHook }: AutomationFormProps) {
  const titleId = useId();
  const animationsEnabled = useIoTStore((s) => s.animationsEnabled);
  const context = useOptionalAutomationContext();
  const resolvedHook = propFormHook ?? context?.formHook;

  if (!resolvedHook) {
    throw new Error("AutomationForm requires AutomationProvider or a formHook prop");
  }

  const {
    editingId,
    title,
    setTitle,
    time,
    setTime,
    days,
    setDays,
    repeatCount,
    setRepeatCount,
    autoType,
    setAutoType,
    delayHours,
    setDelayHours,
    delayMinutes,
    setDelayMinutes,
    city,
    setCity,
    temperatureThreshold,
    setTemperatureThreshold,
    temperatureCondition,
    setTemperatureCondition,
    intervalMinutes,
    setIntervalMinutes,
    hasWeatherCondition,
    setHasWeatherCondition,
    isGettingLocation,
    actions,
    setActions,
    handleGetLocation,
    resetForm,
    handleSave,
  } = resolvedHook;

  const [step, setStep] = useState<AutomationStep>(0);
  const [maxUnlockedStep, setMaxUnlockedStep] = useState<AutomationStep>(0);
  const [stepDirection, setStepDirection] = useState<1 | -1>(1);
  const [stepError, setStepError] = useState("");
  const [trackedEditingId, setTrackedEditingId] = useState<string | null>(editingId);

  if (trackedEditingId !== editingId) {
    setTrackedEditingId(editingId);
    setStep(0);
    setMaxUnlockedStep(editingId ? 2 : 0);
    setStepError("");
  }

  const effectiveMaxReachable = editingId ? 2 : maxUnlockedStep;
  const activeTypeMeta =
    AUTOMATION_TYPE_OPTIONS.find((opt) => opt.value === autoType) ?? AUTOMATION_TYPE_OPTIONS[0];
  const ActiveTypeIcon = activeTypeMeta.icon;

  const validateStep = (targetStep: AutomationStep): boolean => {
    setStepError("");

    if (targetStep === 0) {
      if (!title.trim()) {
        setStepError("لطفاً یک عنوان کوتاه برای اتوماسیون وارد کنید.");
        return false;
      }
      return true;
    }

    if (targetStep === 1) {
      if (autoType === "timer") {
        const dHours = Number(delayHours) || 0;
        const dMins = Number(delayMinutes) || 0;
        if (dHours === 0 && dMins === 0) {
          setStepError("لطفاً مدت تاخیر (ساعت یا دقیقه) را مشخص کنید.");
          return false;
        }
      } else if (autoType === "weather") {
        if (!city.trim() || temperatureThreshold === "" || !intervalMinutes) {
          setStepError("لطفاً نام شهر، آستانه دما و دوره بررسی را تکمیل کنید.");
          return false;
        }
      } else if (!time || days.length === 0) {
        setStepError("لطفاً ساعت اجرا و حداقل یک روز هفته را انتخاب کنید.");
        return false;
      }

      if ((autoType === "schedule" || autoType === "timer") && hasWeatherCondition) {
        if (!city.trim() || temperatureThreshold === "") {
          setStepError("برای شرط آب‌وهوایی، نام شهر و آستانه دما را وارد کنید.");
          return false;
        }
      }

      return true;
    }

    return true;
  };

  const handleNext = () => {
    if (!validateStep(step)) return;
    const next = Math.min(2, step + 1) as AutomationStep;
    setStepDirection(1);
    setStep(next);
    setMaxUnlockedStep((prev) => Math.max(prev, next) as AutomationStep);
  };

  const handlePrev = () => {
    setStepError("");
    setStepDirection(-1);
    setStep((prev) => (prev > 0 ? ((prev - 1) as AutomationStep) : 0));
  };

  const handleStepClick = (targetIndex: number) => {
    if (targetIndex < 0 || targetIndex > 2) return;
    const target = targetIndex as AutomationStep;

    if (target > step && !validateStep(step)) {
      return;
    }

    setStepError("");
    setStepDirection(target >= step ? 1 : -1);
    setStep(target);
  };

  const handleFinalSave = () => {
    if (actions.length === 0) {
      setStepError("حداقل یک عملیات (پایه یا دکمه سفارشی) به لیست اضافه کنید.");
      return;
    }

    setStepError("");
    const saved = handleSave();
    if (saved) {
      setStep(0);
      setMaxUnlockedStep(0);
    }
  };

  const handleCancelEdit = () => {
    setStepError("");
    setStep(0);
    setMaxUnlockedStep(0);
    resetForm();
  };

  const triggerSummaryText = (() => {
    if (autoType === "timer") {
      const h = Number(delayHours) || 0;
      const mins = Number(delayMinutes) || 0;
      return `پس از ${h > 0 ? `${h} ساعت` : ""}${h > 0 && mins > 0 ? " و " : ""}${mins > 0 ? `${mins} دقیقه` : h === 0 ? "—" : ""}`;
    }

    if (autoType === "weather") {
      const hrs = intervalMinutes ? Math.round(Number(intervalMinutes) / 60) : 0;
      return `${city.trim() || "شهر نامشخص"} · هر ${hrs || "—"} ساعت`;
    }

    return `${time || "ساعت نامشخص"} · ${days.length} روز هفته`;
  })();

  const slideOffset = stepDirection * -14;

  return (
    <div className="min-w-0 sm:bezel-shell">
      <Card className="@container/autoform bezel-core !relative !gap-5 !overflow-hidden !p-3.5 sm:!p-5">
        <div className="space-y-4 border-b border-border-color/80 pb-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-sans text-sm font-semibold text-text-primary">
              {editingId ? (
                <Edit2 strokeWidth={1.75} className="size-4 text-accent3" aria-hidden="true" />
              ) : (
                <Plus strokeWidth={1.75} className="size-4 text-accent3" aria-hidden="true" />
              )}
              <span>{editingId ? "ویرایش اتوماسیون" : "افزودن اتوماسیون جدید"}</span>
            </h3>
            <span className="text-[11px] font-medium tabular-nums text-text-muted">
              مرحله {step + 1} از {AUTOMATION_STEPS.length}
            </span>
          </div>

          <ProgressSteps
            steps={AUTOMATION_STEPS}
            currentStep={step}
            maxReachableStep={effectiveMaxReachable}
            onStepClick={handleStepClick}
            animationsEnabled={animationsEnabled}
            ariaLabel="مراحل ساخت اتوماسیون"
          />
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {step === 0 && (
            <m.div
              key="automation-step-0"
              initial={animationsEnabled ? { opacity: 0, x: slideOffset } : false}
              animate={{ opacity: 1, x: 0 }}
              exit={
                animationsEnabled
                  ? { opacity: 0, x: -slideOffset, transition: { duration: 0.14, ease: EASE_OUT } }
                  : { opacity: 0, transition: { duration: 0 } }
              }
              transition={animationsEnabled ? { duration: 0.2, ease: EASE_OUT } : { duration: 0 }}
              className="space-y-5"
            >
              <div className="space-y-1.5">
                <Label htmlFor={titleId} className="block">
                  عنوان اتوماسیون
                </Label>
                <Input
                  id={titleId}
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (stepError) setStepError("");
                  }}
                  placeholder="مثال: روشن کردن پمپ آبیاری صبحگاهی"
                  className="bg-card-bg"
                />
              </div>

              <div className="space-y-2 border-t border-border-color/70 pt-4">
                <span className="block text-xs font-medium text-text-secondary">
                  روش اجرای اتوماسیون
                </span>
                <fieldset
                  aria-label="نوع اتوماسیون"
                  className="grid grid-cols-1 gap-2 @sm/autoform:grid-cols-3"
                >
                  {AUTOMATION_TYPE_OPTIONS.map((option) => {
                    const OptionIcon = option.icon;
                    const isSelected = autoType === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => {
                          setAutoType(option.value);
                          if (stepError) setStepError("");
                        }}
                        className={cn(
                          "group flex min-h-20 cursor-pointer flex-col justify-between gap-2 rounded-xl border p-3 text-start transition-[border-color,background-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset",
                          isSelected
                            ? "border-accent3 bg-accent3/10 ring-1 ring-accent3/25"
                            : "border-border-color bg-card-bg hover:border-text-muted/40 hover:bg-card-hover-bg",
                        )}
                      >
                        <div className="flex w-full items-center justify-between gap-2">
                          <span
                            className={cn(
                              "flex size-8 items-center justify-center rounded-lg border transition-colors",
                              isSelected
                                ? "border-accent3/30 bg-accent3 text-accent3-foreground"
                                : "border-border-color bg-bg-main text-text-secondary group-hover:text-text-primary",
                            )}
                          >
                            <OptionIcon className="size-4" strokeWidth={1.75} aria-hidden="true" />
                          </span>
                          {isSelected && (
                            <Check
                              className="size-3.5 text-accent3"
                              strokeWidth={2.25}
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        <div className="space-y-0.5">
                          <span className="block text-xs font-semibold text-text-primary">
                            {option.label}
                          </span>
                          <span className="block text-[11px] leading-4 text-text-muted">
                            {option.summary}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </fieldset>
              </div>
            </m.div>
          )}

          {step === 1 && (
            <m.div
              key="automation-step-1"
              initial={animationsEnabled ? { opacity: 0, x: slideOffset } : false}
              animate={{ opacity: 1, x: 0 }}
              exit={
                animationsEnabled
                  ? { opacity: 0, x: -slideOffset, transition: { duration: 0.14, ease: EASE_OUT } }
                  : { opacity: 0, transition: { duration: 0 } }
              }
              transition={animationsEnabled ? { duration: 0.2, ease: EASE_OUT } : { duration: 0 }}
              className="grid grid-cols-2 gap-4"
            >
              {autoType === "schedule" && (
                <ScheduleFields
                  time={time}
                  setTime={setTime}
                  repeatCount={repeatCount}
                  setRepeatCount={setRepeatCount}
                  days={days}
                  setDays={setDays}
                />
              )}

              {autoType === "timer" && (
                <TimerFields
                  delayHours={delayHours}
                  setDelayHours={setDelayHours}
                  delayMinutes={delayMinutes}
                  setDelayMinutes={setDelayMinutes}
                />
              )}

              {autoType === "weather" && (
                <WeatherIntervalFields
                  intervalMinutes={intervalMinutes}
                  setIntervalMinutes={setIntervalMinutes}
                />
              )}

              {(autoType === "timer" || autoType === "schedule") && (
                <div className="col-span-2 border-t border-border-color/70 pt-3">
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border-color bg-card-bg px-3 py-2 transition-colors hover:bg-card-hover-bg">
                    <input
                      type="checkbox"
                      checked={hasWeatherCondition}
                      onChange={(e) => setHasWeatherCondition(e.target.checked)}
                      className="size-4 shrink-0 accent-accent3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent3"
                    />
                    <span className="text-xs font-medium text-text-primary sm:text-sm">
                      افزودن شرط دمای آب‌وهوا (اختیاری)
                    </span>
                  </label>
                </div>
              )}

              {(autoType === "weather" || hasWeatherCondition) && (
                <WeatherConditionFields
                  city={city}
                  setCity={setCity}
                  handleGetLocation={handleGetLocation}
                  isGettingLocation={isGettingLocation}
                  temperatureCondition={temperatureCondition}
                  setTemperatureCondition={setTemperatureCondition}
                  temperatureThreshold={temperatureThreshold}
                  setTemperatureThreshold={setTemperatureThreshold}
                />
              )}
            </m.div>
          )}

          {step === 2 && (
            <m.div
              key="automation-step-2"
              initial={animationsEnabled ? { opacity: 0, x: slideOffset } : false}
              animate={{ opacity: 1, x: 0 }}
              exit={
                animationsEnabled
                  ? { opacity: 0, x: -slideOffset, transition: { duration: 0.14, ease: EASE_OUT } }
                  : { opacity: 0, transition: { duration: 0 } }
              }
              transition={animationsEnabled ? { duration: 0.2, ease: EASE_OUT } : { duration: 0 }}
              className="space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-color/80 bg-secondary/35 px-3 py-2.5 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                  <ActiveTypeIcon
                    className="size-4 shrink-0 text-accent3"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <span className="truncate font-semibold text-text-primary">
                    {title.trim() || activeTypeMeta.label}
                  </span>
                </div>
                <span className="text-[11px] tabular-nums text-text-muted">
                  {activeTypeMeta.label} · {triggerSummaryText}
                </span>
              </div>

              <div className="grid grid-cols-2">
                <ActionBuilder actions={actions} setActions={setActions} />
              </div>
            </m.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {stepError && (
            <m.div
              key={stepError}
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
              <span className="leading-5">{stepError}</span>
            </m.div>
          )}
        </AnimatePresence>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-color/80 pt-4">
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button
                variant="ghost"
                type="button"
                onClick={handlePrev}
                className="min-h-11 gap-1.5 rounded-xl border border-border-color bg-card-bg px-4 text-xs font-medium text-text-secondary hover:bg-card-hover-bg hover:text-text-primary"
              >
                <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
                <span>مرحله قبل</span>
              </Button>
            )}
            {editingId && (
              <Button
                variant="ghost"
                type="button"
                onClick={handleCancelEdit}
                className="min-h-11 rounded-xl border border-border-color bg-card-hover-bg px-4 text-xs font-medium text-text-secondary hover:text-text-primary"
              >
                انصراف
              </Button>
            )}
          </div>

          {step < 2 ? (
            <Button
              variant="ghost"
              type="button"
              onClick={handleNext}
              className="min-h-11 gap-1.5 rounded-xl bg-accent3 px-5 text-xs font-semibold text-accent3-foreground transition-opacity hover:bg-accent3 hover:text-accent3-foreground hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent3 active:scale-[0.98]"
            >
              <span>مرحله بعد</span>
              <ChevronLeft className="size-4" strokeWidth={2} aria-hidden="true" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              type="button"
              onClick={handleFinalSave}
              className="group min-h-11 gap-2 rounded-xl bg-accent3 py-2 pr-5 pl-2.5 text-xs font-semibold text-accent3-foreground transition-opacity hover:bg-accent3 hover:text-accent3-foreground hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent3 active:scale-[0.98]"
            >
              <span>{editingId ? "ذخیره تغییرات" : "ثبت اتوماسیون"}</span>
              <span className="flex size-7 items-center justify-center rounded-lg bg-accent3-foreground/15 transition-transform duration-200 ease-out group-hover:scale-105">
                {editingId ? (
                  <Edit2 strokeWidth={2} className="size-3.5" aria-hidden="true" />
                ) : (
                  <Plus strokeWidth={2} className="size-3.5" aria-hidden="true" />
                )}
              </span>
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
