import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";
import { ResponsiveGrid } from "@/components/ui/grid";
import { Edit2, Thermometer } from "@/components/ui/hugeicons-groups/controls";
import { Clock, Layers } from "@/components/ui/hugeicons-groups/shell";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Automation } from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
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
    <div className="@container/autolist space-y-4">
      <div className="flex items-center justify-end px-1">
        <span className="text-xs tabular-nums text-text-muted">{automations.length} مورد</span>
      </div>

      {automations.length === 0 ? (
        <Card className="!gap-2 !items-center !justify-center !rounded-2xl !border-dashed !bg-card-bg-solid !p-8 text-center shadow-none">
          <Clock strokeWidth={1.5} className="size-7 text-text-muted opacity-40" />
          <p className="text-sm font-medium text-text-primary">اتوماسیونی ثبت نشده است</p>
        </Card>
      ) : (
        <ResponsiveGrid minItemWidth="20rem" gap="0.875rem">
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
                className={`!gap-0 !rounded-2xl !border-border-color !p-4 !shadow-none transition-colors ${auto.enabled ? "!bg-card-bg-solid" : "!bg-card-bg"}`}
              >
                {/* Card Header */}
                <div className="mb-3 flex min-w-0 items-center justify-between gap-4">
                  <h4 className="min-w-0 flex-1 break-words text-sm font-medium leading-6 text-text-primary">
                    {auto.title}
                  </h4>

                  <div className="flex shrink-0 items-center gap-2.5">
                    <span
                      className={`text-xs font-medium ${auto.enabled ? "text-accent4" : "text-text-secondary"}`}
                    >
                      {auto.enabled ? "فعال" : "غیرفعال"}
                    </span>
                    <Toggle
                      pressed={auto.enabled}
                      onPressedChange={(pressed) => handleToggle(auto.id, pressed)}
                      aria-label={`وضعیت اتوماسیون ${auto.title}`}
                      className={`relative inline-flex h-6 w-11 min-w-11 shrink-0 items-center rounded-[8px] border p-0.5 transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent3 motion-reduce:transition-none ${auto.enabled ? "justify-end border-accent4 bg-accent4 hover:bg-accent4 aria-pressed:bg-accent4 data-[state=on]:bg-accent4" : "justify-start border-border-color bg-card-hover-bg hover:bg-card-hover-bg"}`}
                    >
                      <span
                        className={`pointer-events-none block size-4 rounded-[5px] shadow-sm ring-1 ring-black/10 ${auto.enabled ? "bg-accent4-foreground" : "bg-card-bg-solid dark:bg-foreground"}`}
                      />
                    </Toggle>
                  </div>
                </div>

                {/* Card Body - Time & Unboxed Metadata */}
                <div className="flex flex-col gap-2 mb-3 pt-3 border-t border-border-color/60">
                  {auto.intervalMinutes ? (
                    <div className="flex min-w-0 items-center gap-2">
                      <Thermometer strokeWidth={1.5} className="size-4 text-accent3 shrink-0" />
                      <span className="text-sm font-medium text-text-primary tabular-nums">
                        {auto.city}: دما{" "}
                        {auto.temperatureCondition === "greater" ? "بیشتر از" : "کمتر از"}{" "}
                        <span className="font-mono text-base tabular-nums" dir="ltr">
                          {auto.temperatureThreshold}°C
                        </span>
                      </span>
                    </div>
                  ) : (
                    <div className="flex min-w-0 items-center gap-2">
                      <Clock strokeWidth={1.5} className="size-4 text-accent3 shrink-0" />
                      <span
                        className="text-lg font-medium font-mono tabular-nums text-text-primary"
                        dir="ltr"
                      >
                        {auto.time}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 text-xs tabular-nums text-text-secondary">
                    <span>{scheduleTypeLabel}</span>
                    {Array.isArray(auto.segmentConditions) &&
                    auto.segmentConditions.some((c) => c.enabled !== false) ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>
                          {auto.segmentConditions.filter((c) => c.enabled !== false).length} شرط
                          سگمنت
                          {auto.segmentConditions.filter((c) => c.enabled !== false).length > 1
                            ? ` (${auto.segmentConditionLogic === "or" ? "OR" : "AND"})`
                            : ""}
                        </span>
                      </>
                    ) : null}
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
                <div className="flex flex-wrap items-center justify-between gap-3 mt-auto pt-3 border-t border-border-color">
                  <div className="text-xs tabular-nums text-text-secondary font-medium flex items-center gap-1.5">
                    <Layers className="size-3.5 opacity-70" />
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
                            className="inline-flex min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 sm:size-9 items-center justify-center rounded-lg text-text-primary transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent3"
                          >
                            <Edit2 className="size-4" />
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
        </ResponsiveGrid>
      )}
    </div>
  );
}
