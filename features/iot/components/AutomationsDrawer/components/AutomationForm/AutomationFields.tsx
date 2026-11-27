import { useId } from "react";
import { Button } from "@/components/ui/button";
import { MapPin } from "@/components/ui/hugeicons-groups/controls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
        <Label htmlFor={timeId} className="block mb-1">
          ساعت اجرا
        </Label>
        <Input
          id={timeId}
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="bg-card-bg"
          dir="ltr"
        />
      </div>
      <div className="col-span-2 md:col-span-1">
        <Label htmlFor={repeatId} className="block mb-1">
          حداکثر دفعات اجرا
        </Label>
        <Input
          id={repeatId}
          type="number"
          min="0"
          value={repeatCount}
          onChange={(e) => setRepeatCount(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="0 (بی‌نهایت)"
          className="bg-card-bg"
        />
        <p className="mt-1 text-xs leading-5 text-text-secondary">
          ۰ یعنی بدون محدودیت؛ مقدارهای دیگر حداکثر دفعات اجرای اتوماسیون را مشخص می‌کنند.
        </p>
      </div>
      <div className="col-span-2">
        <div className="block text-xs font-medium text-text-secondary mb-2">روزهای هفته</div>
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
              className="px-3 min-h-10 sm:min-h-8 rounded-lg text-xs font-medium aria-pressed:bg-accent3 aria-pressed:text-accent3-foreground aria-pressed:border-accent3"
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
        <Label htmlFor={hoursId} className="block mb-1">
          تاخیر (ساعت)
        </Label>
        <Input
          id={hoursId}
          type="number"
          min="0"
          value={delayHours}
          onChange={(e) => setDelayHours(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="مثال: 10"
          className="bg-card-bg"
        />
      </div>
      <div className="col-span-2 md:col-span-1">
        <Label htmlFor={minutesId} className="block mb-1">
          تاخیر (دقیقه)
        </Label>
        <Input
          id={minutesId}
          type="number"
          min="0"
          max="59"
          value={delayMinutes}
          onChange={(e) => setDelayMinutes(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="مثال: 30"
          className="bg-card-bg"
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
      <p className="mb-2 text-xs leading-5 text-text-secondary">
        وضعیت آب‌وهوا با این فاصله دوباره بررسی می‌شود.
      </p>
      <Label htmlFor={intervalId} className="block mb-1">
        فاصله بررسی وضعیت هوا
      </Label>
      <Select
        id={intervalId}
        value={intervalMinutes ? intervalMinutes / 60 : ""}
        onChange={(e) =>
          setIntervalMinutes(e.target.value === "" ? "" : Number(e.target.value) * 60)
        }
        className="bg-card-bg"
      >
        <option value="" disabled>
          انتخاب کنید...
        </option>
        {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
          <option key={h} value={h}>
            هر {h} ساعت
          </option>
        ))}
      </Select>
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
        <Label htmlFor={cityId} className="block mb-1">
          نام شهر یا مختصات جغرافیایی
        </Label>
        <p className="mb-2 text-xs leading-5 text-text-secondary">
          نام شهر را وارد کنید یا مختصات را به‌شکل عرض و طول جغرافیایی بنویسید.
        </p>
        <div className="flex min-w-0 gap-2">
          <Input
            id={cityId}
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="مثال: Tehran یا 36.26,59.61"
            wrapperClassName="min-w-0 flex-1"
            className="bg-card-bg"
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
                  className={`p-2.5 rounded-lg text-xs font-medium transition-[color,background-color,border-color,transform] duration-150 ease-out border flex items-center justify-center min-w-[44px] ${
                    isGettingLocation
                      ? "bg-card-bg border-border-color text-text-muted cursor-not-allowed"
                      : "bg-card-hover-bg border-border-color text-text-secondary md:hover:border-accent3 md:hover:text-accent3"
                  }`}
                  aria-label="دریافت مکان فعلی"
                >
                  {isGettingLocation ? (
                    <div className="size-5 border-2 border-accent3 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <MapPin strokeWidth={1.5} className="size-5" />
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
          <Label htmlFor={conditionId} className="block mb-1">
            شرط مقایسه دما
          </Label>
          <Select
            id={conditionId}
            value={temperatureCondition}
            onChange={(e) => {
              const val = e.target.value;

              if (val === "greater" || val === "less") {
                setTemperatureCondition(val);
              }
            }}
            className="bg-card-bg"
          >
            <option value="greater">بیشتر از</option>
            <option value="less">کمتر از</option>
          </Select>
        </div>
        <div className="flex-1">
          <Label htmlFor={thresholdId} className="block mb-1">
            دما (°C)
          </Label>
          <Input
            id={thresholdId}
            type="number"
            value={temperatureThreshold}
            onChange={(e) =>
              setTemperatureThreshold(e.target.value === "" ? "" : Number(e.target.value))
            }
            placeholder="مثال: 30"
            className="bg-card-bg"
            dir="ltr"
          />
        </div>
      </div>
    </>
  );
}
