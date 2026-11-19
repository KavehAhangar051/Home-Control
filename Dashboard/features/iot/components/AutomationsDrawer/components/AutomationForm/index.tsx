import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Edit2 } from "@/components/ui/hugeicons-groups/controls";
import { Plus } from "@/components/ui/hugeicons-groups/shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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

interface AutomationFormProps {
  formHook?: AutomationFormHookValue;
}

export default function AutomationForm({ formHook: propFormHook }: AutomationFormProps) {
  const titleId = useId();
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
    <div className="min-w-0 sm:bezel-shell">
      <Card className="@container/autoform bezel-core !relative !gap-4 !overflow-hidden !p-3 sm:!p-5">
        <h3 className="font-medium text-sm text-text-primary flex items-center gap-2">
          {editingId ? (
            <Edit2 strokeWidth={1.5} className="size-4 text-accent3" />
          ) : (
            <Plus strokeWidth={1.5} className="size-4 text-accent3" />
          )}
          {editingId ? "ویرایش اتوماسیون" : "افزودن اتوماسیون جدید"}
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label htmlFor={titleId} className="block mb-1">
              عنوان (دلخواه)
            </Label>
            <Input
              id={titleId}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: روشن کردن پمپ آبیاری"
              className="bg-card-bg"
            />
          </div>

          <ToggleGroup
            variant="outline"
            spacing={1}
            value={[autoType]}
            onValueChange={(vals) => {
              const val = vals[0];

              if (val === "schedule" || val === "timer" || val === "weather") {
                setAutoType(val);
              }
            }}
            className="col-span-2 grid w-full grid-cols-1 @sm/autoform:grid-cols-3 bg-card-bg p-1 rounded-xl border border-border-color"
          >
            <ToggleGroupItem
              value="schedule"
              className="w-full min-w-0 h-9 px-2 text-xs font-medium border-0 rounded-lg aria-pressed:bg-card-hover-bg aria-pressed:text-text-primary"
            >
              زمان‌بندی دوره‌ای
            </ToggleGroupItem>
            <ToggleGroupItem
              value="timer"
              className="w-full min-w-0 h-9 px-2 text-xs font-medium border-0 rounded-lg aria-pressed:bg-card-hover-bg aria-pressed:text-text-primary"
            >
              تایمر یک‌بار مصرف
            </ToggleGroupItem>
            <ToggleGroupItem
              value="weather"
              className="w-full min-w-0 h-9 px-2 text-xs font-medium border-0 rounded-lg aria-pressed:bg-card-hover-bg aria-pressed:text-text-primary"
            >
              مبتنی بر دما
            </ToggleGroupItem>
          </ToggleGroup>

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
            <div className="col-span-2 mt-2 border-t border-border-color pt-3">
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border-color bg-card-bg px-3 py-2 transition-colors hover:bg-card-hover-bg">
                <input
                  type="checkbox"
                  checked={hasWeatherCondition}
                  onChange={(e) => setHasWeatherCondition(e.target.checked)}
                  className="size-4 shrink-0 accent-accent3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent3"
                />
                <span className="text-sm font-medium text-text-primary">
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

        <div className="flex flex-col-reverse gap-2 border-t border-border-color pt-4 sm:flex-row">
          <Button
            variant="ghost"
            type="button"
            onClick={handleSave}
            className="group flex-1 min-h-11 gap-2.5 py-2 pr-4 pl-2 bg-accent3 text-bg-main font-medium rounded-xl text-sm transition-colors hover:bg-accent3-dark hover:text-bg-main focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent3 active:scale-[0.98]"
          >
            <span>{editingId ? "ذخیره تغییرات" : "افزودن به لیست"}</span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-bg-main/15 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:scale-105">
              {editingId ? (
                <Edit2 strokeWidth={2} className="size-3.5" aria-hidden="true" />
              ) : (
                <Plus strokeWidth={2} className="size-3.5" aria-hidden="true" />
              )}
            </span>
          </Button>
          {editingId && (
            <Button
              variant="ghost"
              type="button"
              onClick={resetForm}
              className="min-h-11 px-4 py-2.5 bg-card-hover-bg text-text-primary border border-border-color hover:bg-accent hover:text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent3 font-medium rounded-xl text-sm transition-colors active:scale-[0.98]"
            >
              انصراف
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
