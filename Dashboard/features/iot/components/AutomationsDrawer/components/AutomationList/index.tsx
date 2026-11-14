import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";
import { Clock, Edit2, Layers, Thermometer } from "@/components/ui/hugeicons";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import type { Automation } from "@/features/iot/hooks/store/types";
import { useOptionalAutomationContext } from "../../context/AutomationContext";
import { DAYS_MAP } from "../AutomationForm/constants";

interface AutomationListProps {
  handleEdit?: (auto: Automation) => void;
  handleDelete?: (id: string) => void;
  handleToggle?: (id: string, enabled: boolean) => void;
}

export default function AutomationList({
  handleEdit: propHandleEdit,
  handleDelete: propHandleDelete,
  handleToggle: propHandleToggle,
}: AutomationListProps = {}) {
  const context = useOptionalAutomationContext();
  const storeAutomations = useIoTStore((state) => state.automations);
  const automations = context?.state.automations ?? storeAutomations;
  const handleEdit = propHandleEdit ?? context?.actions.handleEdit ?? (() => {});
  const handleDelete = propHandleDelete ?? context?.actions.handleDelete ?? (() => {});
  const handleToggle = propHandleToggle ?? context?.actions.handleToggle ?? (() => {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="font-bold text-[var(--text-primary)]">مدیریت اتوماسیون‌ها</h3>
        <span className="text-xs tabular-nums text-[var(--text-secondary)]">
          {automations.length} مورد
        </span>
      </div>

      {automations.length === 0 ? (
        <Card className="!gap-2 !items-center !justify-center !rounded-2xl !border-dashed !bg-[var(--card-bg-solid)] !p-8 text-center shadow-none">
          <Clock className="w-7 h-7 text-[var(--text-muted)] opacity-40" />
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            هنوز اتوماسیونی ثبت نشده است
          </p>
          <p className="text-xs text-[var(--text-secondary)] max-w-xs leading-relaxed">
            از بخش «افزودن اتوماسیون جدید» یک زمان‌بندی، تایمر یا شرط دمایی تعریف کنید تا تجهیزات
            خودکار عمل کنند.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {automations.map((auto) => {
            const scheduleTypeLabel = auto.intervalMinutes
              ? "پایش دمایی دوره‌ای"
              : auto.repeatCount
                ? `تکرار محدود (${auto.repeatCount} بار)`
                : "برنامه دوره‌ای";

            const activeDaysLabel =
              !auto.intervalMinutes && auto.days && auto.days.length > 0
                ? auto.days
                    .map((d: number) => DAYS_MAP.find((m) => m.value === d)?.label)
                    .filter(Boolean)
                    .join("، ")
                : null;

            return (
              <Card
                key={auto.id}
                className={`!gap-0 !rounded-2xl !border-[var(--border-color)] !p-4 !shadow-none transition-colors ${auto.enabled ? "!bg-[var(--card-bg-solid)]" : "!bg-[var(--card-bg)]"}`}
              >
                {/* Card Header */}
                <div className="mb-3 flex min-w-0 items-center justify-between gap-4">
                  <h4 className="min-w-0 flex-1 break-words text-sm font-bold leading-6 text-[var(--text-primary)]">
                    {auto.title}
                  </h4>

                  <div className="flex shrink-0 items-center gap-2.5">
                    <span
                      className={`text-xs font-semibold ${auto.enabled ? "text-emerald-700 dark:text-emerald-400" : "text-[var(--text-secondary)]"}`}
                    >
                      {auto.enabled ? "فعال" : "غیرفعال"}
                    </span>
                    <Toggle
                      pressed={auto.enabled}
                      onPressedChange={(pressed) => handleToggle(auto.id, pressed)}
                      aria-label={`وضعیت اتوماسیون ${auto.title}`}
                      className={`relative inline-flex h-6 w-11 min-w-11 shrink-0 items-center rounded-full border p-0.5 transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent3)] motion-reduce:transition-none ${auto.enabled ? "justify-end border-emerald-700 bg-emerald-600 hover:bg-emerald-600 aria-pressed:bg-emerald-600 data-[state=on]:bg-emerald-600" : "justify-start border-[var(--border-color)] bg-[var(--card-hover-bg)] hover:bg-[var(--card-hover-bg)]"}`}
                    >
                      <span className="pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-1 ring-black/10" />
                    </Toggle>
                  </div>
                </div>

                {/* Card Body - Time & Unboxed Metadata */}
                <div className="flex flex-col gap-2 mb-3 pt-3 border-t border-[var(--border-color)]/60">
                  {auto.intervalMinutes ? (
                    <div className="flex min-w-0 items-center gap-2">
                      <Thermometer className="w-4 h-4 text-[var(--accent3)] shrink-0" />
                      <span className="text-sm font-bold text-[var(--text-primary)] tabular-nums">
                        {auto.city}: دما{" "}
                        {auto.temperatureCondition === "greater" ? "بیشتر از" : "کمتر از"}{" "}
                        <span className="font-mono text-base tabular-nums" dir="ltr">
                          {auto.temperatureThreshold}°C
                        </span>
                      </span>
                    </div>
                  ) : (
                    <div className="flex min-w-0 items-center gap-2">
                      <Clock className="w-4 h-4 text-[var(--accent3)] shrink-0" />
                      <span
                        className="text-lg font-bold font-mono tabular-nums text-[var(--text-primary)] tracking-wider"
                        dir="ltr"
                      >
                        {auto.time}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 text-xs tabular-nums text-[var(--text-secondary)]">
                    <span>{scheduleTypeLabel}</span>
                    {auto.intervalMinutes ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>هر {auto.intervalMinutes / 60} ساعت</span>
                      </>
                    ) : null}
                    {!auto.intervalMinutes && auto.conditionType === "weather" && auto.city ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>
                          شرط {auto.city} (
                          {auto.temperatureCondition === "greater" ? "بیشتر از" : "کمتر از"}{" "}
                          {auto.temperatureThreshold}°C)
                        </span>
                      </>
                    ) : null}
                    {activeDaysLabel ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{activeDaysLabel}</span>
                      </>
                    ) : null}
                  </div>
                </div>

                {/* Card Footer - Actions summary & controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 mt-auto pt-3 border-t border-[var(--border-color)]">
                  <div className="text-xs tabular-nums text-[var(--text-secondary)] font-medium flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 opacity-70" />
                    <span>{auto.actions?.length || 0} عملیات تنظیم شده</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            type="button"
                            onClick={() => handleEdit(auto)}
                            aria-label={`ویرایش اتوماسیون ${auto.title}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-primary)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent3)]"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        }
                      />
                      <TooltipContent>ویرایش</TooltipContent>
                    </Tooltip>
                    <DeleteButton
                      size="sm"
                      resetAfter={0}
                      onConfirm={() => handleDelete(auto.id)}
                      label={`حذف اتوماسیون ${auto.title}`}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
