"use client";

import { AnimatePresence, m } from "motion/react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Edit2, Info, Thermometer } from "@/components/ui/hugeicons-groups/controls";
import { Clock, Clock3, Plus } from "@/components/ui/hugeicons-groups/shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import {
  DURATION,
  EASE_IN_OUT,
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

interface TriggerModeOption {
  value: "schedule" | "timer" | "weather";
  label: string;
  icon: typeof Clock3;
}

const TRIGGER_MODE_OPTIONS: readonly TriggerModeOption[] = [
  { value: "schedule", label: "زمان‌بندی", icon: Clock3 },
  { value: "timer", label: "تایمر", icon: Clock },
  { value: "weather", label: "آب‌وهوا", icon: Thermometer },
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

  const [formError, setFormError] = useState("");
  const [trackedEditingId, setTrackedEditingId] = useState<string | null>(editingId);

  if (trackedEditingId !== editingId) {
    setTrackedEditingId(editingId);
    setFormError("");
  }

  const validateRule = (): boolean => {
    if (!title.trim()) {
      setFormError("عنوان اتوماسیون را وارد کنید");
      return false;
    }

    if (autoType === "timer") {
      const dHours = Number(delayHours) || 0;
      const dMins = Number(delayMinutes) || 0;
      if (dHours === 0 && dMins === 0) {
        setFormError("مدت تاخیر (ساعت یا دقیقه) را مشخص کنید");
        return false;
      }
    } else if (autoType === "weather") {
      if (!city.trim() || temperatureThreshold === "" || !intervalMinutes) {
        setFormError("شهر، آستانه دما و بازه بررسی را کامل کنید");
        return false;
      }
    } else if (!time || days.length === 0) {
      setFormError("ساعت اجرا و حداقل یک روز هفته را انتخاب کنید");
      return false;
    }

    if ((autoType === "schedule" || autoType === "timer") && hasWeatherCondition) {
      if (!city.trim() || temperatureThreshold === "") {
        setFormError("نام شهر و آستانه دما را برای شرط آب‌وهوا وارد کنید");
        return false;
      }
    }

    if (actions.length === 0) {
      setFormError("حداقل یک عملیات به لیست اضافه کنید");
      return false;
    }

    return true;
  };

  const handleRuleSave = () => {
    if (!validateRule()) return;
    setFormError("");
    handleSave();
  };

  const handleCancelEdit = () => {
    setFormError("");
    resetForm();
  };

  return (
    <div className="min-w-0 sm:bezel-shell">
      <Card className="@container/autoform bezel-core !relative !gap-5 !overflow-hidden !p-3.5 sm:!p-5">
        {/* Rule Identity & Trigger Switcher */}
        <div className="grid grid-cols-1 items-end gap-3 @lg/autoform:grid-cols-[minmax(0,1fr)_auto]">
          <div className="space-y-1.5">
            <Label htmlFor={titleId} className="block">
              عنوان
            </Label>
            <Input
              id={titleId}
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (formError) setFormError("");
              }}
              placeholder="مثال: آبیاری صبحگاهی"
              className="bg-card-bg"
            />
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-text-secondary">نوع محرک</span>
            <div
              role="tablist"
              aria-label="نوع محرک اتوماسیون"
              className="grid grid-cols-3 gap-1 rounded-xl border border-border-color bg-bg-main p-1"
            >
              {TRIGGER_MODE_OPTIONS.map((option) => {
                const OptionIcon = option.icon;
                const isSelected = autoType === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => {
                      setAutoType(option.value);
                      if (formError) setFormError("");
                    }}
                    className={cn(
                      "inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3",
                      isSelected
                        ? "bg-accent3 text-accent3-foreground shadow-2xs"
                        : "text-text-secondary hover:text-text-primary",
                    )}
                  >
                    <OptionIcon
                      className="size-3.5 shrink-0"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Direct 2-Column Rule Workspace: Trigger (Leading) + Actions (Trailing) */}
        <div className="grid grid-cols-1 gap-5 border-t border-border-color/70 pt-5 @2xl/autoform:grid-cols-12">
          <div className="space-y-4 @2xl/autoform:col-span-7">
            <div className="grid grid-cols-2 gap-3.5">
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
                <div className="col-span-2 pt-1">
                  <label className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-xl border border-border-color bg-card-bg px-3 py-2 transition-colors hover:bg-card-hover-bg">
                    <input
                      type="checkbox"
                      checked={hasWeatherCondition}
                      onChange={(e) => setHasWeatherCondition(e.target.checked)}
                      className="size-4 shrink-0 accent-accent3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent3"
                    />
                    <span className="text-xs font-medium text-text-primary">شرط دمای محیط</span>
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
            </div>
          </div>

          <div className="border-t border-border-color/70 pt-4 @2xl/autoform:col-span-5 @2xl/autoform:border-s @2xl/autoform:border-t-0 @2xl/autoform:ps-5 @2xl/autoform:pt-0">
            <ActionBuilder actions={actions} setActions={setActions} />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {formError && (
            <m.div
              key={formError}
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
              <span className="leading-5">{formError}</span>
            </m.div>
          )}
        </AnimatePresence>

        <div
          className={cn(
            "flex flex-wrap items-center gap-2 border-t border-border-color/80 pt-4",
            editingId ? "justify-between" : "justify-end",
          )}
        >
          {editingId && (
            <Button
              variant="ghost"
              type="button"
              onClick={handleCancelEdit}
              className="min-h-11 rounded-xl border border-border-color bg-card-hover-bg px-4 text-xs font-medium text-text-secondary hover:text-text-primary"
            >
              انصراف از ویرایش
            </Button>
          )}

          <Button
            variant="ghost"
            type="button"
            onClick={handleRuleSave}
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
        </div>
      </Card>
    </div>
  );
}
