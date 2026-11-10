import React from "react";
import { Button } from "@/components/ui/button";
import { Edit2, Plus } from "lucide-react";
import ActionBuilder from "./ActionBuilder";
import {
  ScheduleFields,
  TimerFields,
  WeatherConditionFields,
  WeatherIntervalFields,
} from "./AutomationFields";
import { Card } from "@/components/ui/card";
import {
  useOptionalAutomationContext,
  type AutomationFormHookValue,
} from "../../context/AutomationContext";

interface AutomationFormProps {
  formHook?: AutomationFormHookValue;
}

export default function AutomationForm({ formHook: propFormHook }: AutomationFormProps) {
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

  return (
    <Card className="!relative !gap-4 !overflow-hidden !rounded-2xl !border-[var(--border-color)] !bg-[var(--card-bg-solid)] !p-5 shadow-sm">
      <h3 className="font-semibold text-sm text-[var(--text-primary)] flex items-center gap-2">
        {editingId ? (
          <Edit2 className="w-4 h-4 text-[var(--accent3)]" />
        ) : (
          <Plus className="w-4 h-4 text-[var(--accent3)]" />
        )}
        {editingId ? "ویرایش اتوماسیون" : "افزودن اتوماسیون جدید"}
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <div className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
            عنوان (دلخواه):
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثال: روشن کردن پمپ آبیاری"
            className="w-full bg-[var(--card-bg)] border border-[var(--border-color)] p-2.5 rounded-xl focus:outline-none focus:border-[var(--accent3)] focus-visible:ring-2 focus-visible:ring-[var(--accent3)]/50 text-sm transition-colors text-[var(--text-primary)]"
          />
        </div>

        <div className="col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-1 bg-[var(--card-bg)] p-1 rounded-xl border border-[var(--border-color)]">
          <Button
            variant="ghost"
            type="button"
            onClick={() => setAutoType("schedule")}
            className={`w-full min-w-0 px-2 py-2 text-xs font-bold rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent3)] ${
              autoType === "schedule"
                ? "bg-[var(--accent3)] text-black shadow-sm"
                : "bg-transparent text-[var(--text-secondary)] md:hover:bg-[var(--card-hover-bg)] md:hover:text-[var(--text-primary)]"
            }`}
          >
            زمان‌بندی دوره‌ای
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={() => setAutoType("timer")}
            className={`w-full min-w-0 px-2 py-2 text-xs font-bold rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent3)] ${
              autoType === "timer"
                ? "bg-[var(--accent3)] text-black shadow-sm"
                : "bg-transparent text-[var(--text-secondary)] md:hover:bg-[var(--card-hover-bg)] md:hover:text-[var(--text-primary)]"
            }`}
          >
            تایمر یک‌بار مصرف
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={() => setAutoType("weather")}
            className={`w-full min-w-0 px-2 py-2 text-xs font-bold rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent3)] ${
              autoType === "weather"
                ? "bg-[var(--accent3)] text-black shadow-sm"
                : "bg-transparent text-[var(--text-secondary)] md:hover:bg-[var(--card-hover-bg)] md:hover:text-[var(--text-primary)]"
            }`}
          >
            مبتنی بر دما
          </Button>
        </div>

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
          <div className="col-span-2 mt-2 border-t border-[var(--border-color)] pt-3">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] px-3 py-2 transition-colors hover:bg-[var(--card-hover-bg)]">
              <input
                type="checkbox"
                checked={hasWeatherCondition}
                onChange={(e) => setHasWeatherCondition(e.target.checked)}
                className="h-4 w-4 shrink-0 accent-[var(--accent3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent3)]"
              />
              <span className="text-sm font-medium text-[var(--text-primary)]">
                اضافه کردن شرط آب‌وهوایی (اختیاری)
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

        <ActionBuilder actions={actions} setActions={setActions} />
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-[var(--border-color)] pt-4 sm:flex-row">
        <Button
          variant="ghost"
          type="button"
          onClick={handleSave}
          className="flex-1 min-h-11 py-2.5 px-4 bg-[var(--accent3)] text-black font-bold rounded-xl text-sm transition-colors shadow-sm hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent3)] active:scale-[0.98]"
        >
          {editingId ? "ذخیره تغییرات" : "افزودن به لیست"}
        </Button>
        {editingId && (
          <Button
            variant="ghost"
            type="button"
            onClick={resetForm}
            className="min-h-11 px-4 py-2.5 bg-[var(--card-hover-bg)] text-[var(--text-primary)] border border-[var(--border-color)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent3)] font-bold rounded-xl text-sm transition-colors active:scale-[0.98]"
          >
            انصراف
          </Button>
        )}
      </div>
    </Card>
  );
}
