import { useId } from "react";
import { Button } from "@/components/ui/button";
import { MapPin } from "@/components/ui/hugeicons";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AutomationFormHookValue } from "../../context/AutomationContext";
import { DAYS_MAP } from "./constants";

export function ScheduleFields({
  time,
  setTime,
  repeatCount,
  setRepeatCount,
  days,
  setDays,
}: Pick<
  AutomationFormHookValue,
  "time" | "setTime" | "repeatCount" | "setRepeatCount" | "days" | "setDays"
>) {
  const baseId = useId();
  const timeId = `${baseId}-time`;
  const repeatId = `${baseId}-repeat`;

  return (
    <>
      <div className="col-span-2 md:col-span-1">
        <label
          htmlFor={timeId}
          className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
        >
          زمان (ساعت):
        </label>
        <input
          id={timeId}
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-full bg-[var(--card-bg)] border border-[var(--border-color)] p-2.5 rounded-xl focus:outline-none focus:border-[var(--accent3)] text-sm transition-colors text-[var(--text-primary)]"
          dir="ltr"
        />
      </div>
      <div className="col-span-2 md:col-span-1">
        <label
          htmlFor={repeatId}
          className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
        >
          تعداد تکرار:
        </label>
        <input
          id={repeatId}
          type="number"
          min="0"
          value={repeatCount}
          onChange={(e) => setRepeatCount(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="0 (بی‌نهایت)"
          className="w-full bg-[var(--card-bg)] border border-[var(--border-color)] p-2.5 rounded-xl focus:outline-none focus:border-[var(--accent3)] text-sm transition-colors text-[var(--text-primary)]"
        />
      </div>
      <div className="col-span-2">
        <div className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
          روزهای هفته:
        </div>
        <ToggleGroup
          multiple
          variant="outline"
          size="sm"
          spacing={2}
          value={days.map(String)}
          onValueChange={(vals) => setDays(vals.map(Number).sort())}
          className="flex w-full flex-wrap justify-center"
        >
          {DAYS_MAP.map((d) => (
            <ToggleGroupItem
              key={d.value}
              value={String(d.value)}
              className="px-3 h-8 rounded-xl text-xs font-bold aria-pressed:bg-[var(--accent3)] aria-pressed:text-[var(--bg-main)] aria-pressed:border-[var(--accent3)]"
            >
              {d.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </>
  );
}

export function TimerFields({
  delayHours,
  setDelayHours,
  delayMinutes,
  setDelayMinutes,
}: Pick<
  AutomationFormHookValue,
  "delayHours" | "setDelayHours" | "delayMinutes" | "setDelayMinutes"
>) {
  const baseId = useId();
  const hoursId = `${baseId}-hours`;
  const minutesId = `${baseId}-minutes`;

  return (
    <>
      <div className="col-span-2 md:col-span-1">
        <label
          htmlFor={hoursId}
          className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
        >
          تاخیر (ساعت):
        </label>
        <input
          id={hoursId}
          type="number"
          min="0"
          value={delayHours}
          onChange={(e) => setDelayHours(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="مثال: 10"
          className="w-full bg-[var(--card-bg)] border border-[var(--border-color)] p-2.5 rounded-xl focus:outline-none focus:border-[var(--accent3)] text-sm transition-colors text-[var(--text-primary)]"
        />
      </div>
      <div className="col-span-2 md:col-span-1">
        <label
          htmlFor={minutesId}
          className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
        >
          تاخیر (دقیقه):
        </label>
        <input
          id={minutesId}
          type="number"
          min="0"
          max="59"
          value={delayMinutes}
          onChange={(e) => setDelayMinutes(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="مثال: 30"
          className="w-full bg-[var(--card-bg)] border border-[var(--border-color)] p-2.5 rounded-xl focus:outline-none focus:border-[var(--accent3)] text-sm transition-colors text-[var(--text-primary)]"
        />
      </div>
    </>
  );
}

export function WeatherIntervalFields({
  intervalMinutes,
  setIntervalMinutes,
}: Pick<AutomationFormHookValue, "intervalMinutes" | "setIntervalMinutes">) {
  const intervalId = useId();

  return (
    <div className="col-span-2">
      <label
        htmlFor={intervalId}
        className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
      >
        دوره بررسی (ساعت):
      </label>
      <select
        id={intervalId}
        value={intervalMinutes ? intervalMinutes / 60 : ""}
        onChange={(e) =>
          setIntervalMinutes(e.target.value === "" ? "" : Number(e.target.value) * 60)
        }
        className="w-full bg-[var(--card-bg)] border border-[var(--border-color)] p-2.5 rounded-xl focus:outline-none focus:border-[var(--accent3)] text-sm transition-colors text-[var(--text-primary)]"
      >
        <option value="" disabled>
          انتخاب کنید...
        </option>
        {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
          <option key={h} value={h}>
            هر {h} ساعت
          </option>
        ))}
      </select>
    </div>
  );
}

export function WeatherConditionFields({
  city,
  setCity,
  handleGetLocation,
  isGettingLocation,
  temperatureCondition,
  setTemperatureCondition,
  temperatureThreshold,
  setTemperatureThreshold,
}: Pick<
  AutomationFormHookValue,
  | "city"
  | "setCity"
  | "handleGetLocation"
  | "isGettingLocation"
  | "temperatureCondition"
  | "setTemperatureCondition"
  | "temperatureThreshold"
  | "setTemperatureThreshold"
>) {
  const baseId = useId();
  const cityId = `${baseId}-city`;
  const conditionId = `${baseId}-condition`;
  const thresholdId = `${baseId}-threshold`;

  return (
    <>
      <div className="col-span-2">
        <label
          htmlFor={cityId}
          className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
        >
          نام شهر یا مختصات (انگلیسی):
        </label>
        <div className="flex min-w-0 gap-2">
          <input
            id={cityId}
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="مثال: Tehran یا 36.26,59.61"
            className="min-w-0 flex-1 bg-[var(--card-bg)] border border-[var(--border-color)] p-2.5 rounded-xl focus:outline-none focus:border-[var(--accent3)] focus-visible:ring-2 focus-visible:ring-[var(--accent3)]/40 text-sm transition-colors text-[var(--text-primary)]"
            dir="ltr"
          />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  type="button"
                  onClick={handleGetLocation}
                  disabled={isGettingLocation}
                  className={`p-2.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-center min-w-[44px] ${
                    isGettingLocation
                      ? "bg-[var(--card-bg)] border-[var(--border-color)] text-[var(--text-muted)] cursor-not-allowed"
                      : "bg-[var(--card-hover-bg)] border-[var(--border-color)] text-[var(--text-secondary)] md:hover:border-[var(--accent3)] md:hover:text-[var(--accent3)]"
                  }`}
                  aria-label="دریافت مکان فعلی"
                >
                  {isGettingLocation ? (
                    <div className="w-5 h-5 border-2 border-[var(--accent3)] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <MapPin className="w-5 h-5" />
                  )}
                </Button>
              }
            />
            <TooltipContent>دریافت مکان فعلی</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex-1">
          <label
            htmlFor={conditionId}
            className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
          >
            شرط دما:
          </label>
          <select
            id={conditionId}
            value={temperatureCondition}
            onChange={(e) => {
              const val = e.target.value;

              if (val === "greater" || val === "less") {
                setTemperatureCondition(val);
              }
            }}
            className="w-full bg-[var(--card-bg)] border border-[var(--border-color)] p-2.5 rounded-xl focus:outline-none focus:border-[var(--accent3)] text-sm transition-colors text-[var(--text-primary)]"
          >
            <option value="greater">بیشتر از</option>
            <option value="less">کمتر از</option>
          </select>
        </div>
        <div className="flex-1">
          <label
            htmlFor={thresholdId}
            className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
          >
            دما (°C):
          </label>
          <input
            id={thresholdId}
            type="number"
            value={temperatureThreshold}
            onChange={(e) =>
              setTemperatureThreshold(e.target.value === "" ? "" : Number(e.target.value))
            }
            placeholder="مثال: 30"
            className="w-full bg-[var(--card-bg)] border border-[var(--border-color)] p-2.5 rounded-xl focus:outline-none focus:border-[var(--accent3)] text-sm transition-colors text-[var(--text-primary)]"
            dir="ltr"
          />
        </div>
      </div>
    </>
  );
}
