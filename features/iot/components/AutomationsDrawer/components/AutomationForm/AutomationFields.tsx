import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AutomationFormHookValue } from "../../context/AutomationContext";

/**
 * Authoritative Persian day-of-week mapping (0 = Sunday .. 6 = Saturday).
 * Shared between AutomationForm and AutomationList (DRY).
 */
export const DAYS_MAP = [
  { value: 6, label: "شنبه" },
  { value: 0, label: "یکشنبه" },
  { value: 1, label: "دوشنبه" },
  { value: 2, label: "سه‌شنبه" },
  { value: 3, label: "چهارشنبه" },
  { value: 4, label: "پنج‌شنبه" },
  { value: 5, label: "جمعه" },
] as const;

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
  return (
    <>
      <div className="col-span-2 md:col-span-1">
        <div className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
          زمان (ساعت):
        </div>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-full bg-[var(--card-bg)] border border-[var(--border-color)] p-2.5 rounded-xl focus:outline-none focus:border-[var(--accent3)] text-sm transition-colors text-[var(--text-primary)]"
          dir="ltr"
        />
      </div>
      <div className="col-span-2 md:col-span-1">
        <div className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
          تعداد تکرار:
        </div>
        <input
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
        <div className="flex flex-wrap justify-center gap-2">
          {DAYS_MAP.map((d) => (
            <Button
              variant="ghost"
              type="button"
              key={d.value}
              onClick={() => {
                if (days.includes(d.value)) setDays(days.filter((x: number) => x !== d.value));
                else setDays([...days, d.value].sort());
              }}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent3)] ${
                days.includes(d.value)
                  ? "bg-[var(--accent3)] text-black shadow-sm"
                  : "bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-secondary)] md:hover:bg-[var(--card-hover-bg)] md:hover:text-[var(--text-primary)] md:hover:border-[var(--accent3)]"
              }`}
            >
              {d.label}
            </Button>
          ))}
        </div>
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
  return (
    <>
      <div className="col-span-2 md:col-span-1">
        <div className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
          تاخیر (ساعت):
        </div>
        <input
          type="number"
          min="0"
          value={delayHours}
          onChange={(e) => setDelayHours(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="مثال: 10"
          className="w-full bg-[var(--card-bg)] border border-[var(--border-color)] p-2.5 rounded-xl focus:outline-none focus:border-[var(--accent3)] text-sm transition-colors text-[var(--text-primary)]"
        />
      </div>
      <div className="col-span-2 md:col-span-1">
        <div className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
          تاخیر (دقیقه):
        </div>
        <input
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
  return (
    <div className="col-span-2">
      <div className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
        دوره بررسی (ساعت):
      </div>
      <select
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
  return (
    <>
      <div className="col-span-2">
        <div className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
          نام شهر یا مختصات (انگلیسی):
        </div>
        <div className="flex min-w-0 gap-2">
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="مثال: Tehran یا 36.26,59.61"
            className="min-w-0 flex-1 bg-[var(--card-bg)] border border-[var(--border-color)] p-2.5 rounded-xl focus:outline-none focus:border-[var(--accent3)] focus-visible:ring-2 focus-visible:ring-[var(--accent3)]/40 text-sm transition-colors text-[var(--text-primary)]"
            dir="ltr"
          />
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
            title="دریافت مکان فعلی"
          >
            {isGettingLocation ? (
              <div className="w-5 h-5 border-2 border-[var(--accent3)] border-t-transparent rounded-full animate-spin" />
            ) : (
              <MapPin className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>
      <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex-1">
          <div className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
            شرط دما:
          </div>
          <select
            value={temperatureCondition}
            onChange={(e) => setTemperatureCondition(e.target.value as "greater" | "less")}
            className="w-full bg-[var(--card-bg)] border border-[var(--border-color)] p-2.5 rounded-xl focus:outline-none focus:border-[var(--accent3)] text-sm transition-colors text-[var(--text-primary)]"
          >
            <option value="greater">بیشتر از</option>
            <option value="less">کمتر از</option>
          </select>
        </div>
        <div className="flex-1">
          <div className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
            دما (°C):
          </div>
          <input
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
