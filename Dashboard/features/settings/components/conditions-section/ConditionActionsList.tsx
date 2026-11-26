import { useState } from "react";
import { Info } from "@/components/ui/hugeicons-groups/controls";
import { Plus } from "@/components/ui/hugeicons-groups/shell";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import {
  DIGITAL_HOLD_TIME_VALUES,
  MAX_RULE_ACTIONS_PER_SIDE,
  RULE_TRIGGER_DOUBLE_CLICK,
} from "@/features/iot/utils/analogInput";
import { type ConditionAction, ConditionActionItem } from "./ConditionActionItem";

interface Props {
  type: "high" | "low";
  inputPin: string;
  actions: ConditionAction[];
  onUpdate: (actions: ConditionAction[]) => void;
}

export function ConditionActionsList({ type, inputPin, actions, onUpdate }: Props) {
  const [rowKeys, setRowKeys] = useState<string[]>(() =>
    actions.map((_, pos) => `act-${pos}-${Math.random().toString(36).slice(2, 8)}`),
  );
  const showToast = useIoTStore((state) => state.showToast);
  const isHigh = type === "high";
  const colorClasses = isHigh ? "text-accent3" : "text-text-primary";
  const bgClass = isHigh ? "bg-accent3" : "bg-text-muted";

  const borderClass = isHigh ? "border-accent3-transparent" : "border-border-color";

  const containerBg = isHigh ? "bg-accent3-transparent" : "bg-bg-primary/40";

  const hasSingleClick = actions.some((action) => action.reqHold === 0);
  const hasDoubleClick = actions.some((action) => action.reqHold === RULE_TRIGGER_DOUBLE_CLICK);
  const hasClickCoexistence = hasSingleClick && hasDoubleClick;

  const addAction = () => {
    if (actions.length >= MAX_RULE_ACTIONS_PER_SIDE) {
      showToast(`حداکثر ${MAX_RULE_ACTIONS_PER_SIDE} عملیات برای هر وضعیت مجاز است`, "error");

      return;
    }

    const unusedHold = DIGITAL_HOLD_TIME_VALUES.find(
      (hold) => !actions.some((action) => action.reqHold === hold),
    );
    const defaultHold = unusedHold ?? 0;

    setRowKeys((prev) => [
      ...prev.slice(0, actions.length),
      `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ]);
    onUpdate([
      ...actions,
      { reqHold: defaultHold, targetPin: "", actionOn: true, actionType: 0, delay: 0 },
    ]);
  };

  const removeAction = (index: number) => {
    setRowKeys((prev) => prev.filter((_, i) => i !== index));
    const next = [...actions];
    next.splice(index, 1);
    onUpdate(next);
  };

  const updateAction = (index: number, updates: Partial<ConditionAction>) => {
    const next = [...actions];
    next[index] = { ...next[index], ...updates };
    onUpdate(next);
  };

  return (
    <div className={`border ${borderClass} ${containerBg} p-4 rounded-xl`}>
      <div className="flex justify-between items-center mb-4">
        <h4 className={`${colorClasses} font-bold text-sm flex items-center gap-2`}>
          <span aria-hidden="true" className={`size-2 rounded-full ${bgClass}`} />
          هنگام {isHigh ? "فعال شدن" : "غیرفعال شدن"}
        </h4>
        <button
          type="button"
          onClick={addAction}
          disabled={actions.length >= MAX_RULE_ACTIONS_PER_SIDE}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors disabled:opacity-50 ${
            isHigh
              ? "border-accent3 text-accent3 hover:bg-accent3 hover:text-accent3-foreground"
              : "border-border-color text-text-primary hover:border-accent3 hover:text-accent3"
          }`}
        >
          <Plus aria-hidden="true" className="size-3" /> افزودن عملیات
        </button>
      </div>
      {hasClickCoexistence && (
        <div
          role="note"
          className="mb-3 flex items-start gap-2 rounded-xl border border-warning/40 bg-warning-soft px-3 py-2 text-[11px] text-amber-800 dark:text-amber-300"
        >
          <Info aria-hidden="true" className="size-4 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            هنگام ترکیب تک‌کلیک و دابل‌کلیک روی یک کلید، اجرای تک‌کلیک با تأخیر ۴۰۰ میلی‌ثانیه برای
            تشخیص کلیک دوم انجام می‌شود.
          </p>
        </div>
      )}
      {actions.length === 0 ? (
        <div className="text-center py-4 text-text-tertiary text-xs bg-card-bg-solid rounded-lg border border-dashed border-border-color">
          برای این وضعیت عملیاتی ثبت نشده است.
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map((action, idx) => (
            <ConditionActionItem
              key={rowKeys[idx] ?? `act-${action.reqHold}-${idx}`}
              action={action}
              idx={idx}
              inputPin={inputPin}
              onRemove={() => removeAction(idx)}
              onUpdate={(updates) => updateAction(idx, updates)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
