import { Plus } from "@/components/ui/hugeicons-groups/shell";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { type ConditionAction, ConditionActionItem } from "./ConditionActionItem";

interface Props {
  type: "high" | "low";
  actions: ConditionAction[];
  onUpdate: (actions: ConditionAction[]) => void;
}

export function ConditionActionsList({ type, actions, onUpdate }: Props) {
  const showToast = useIoTStore((state) => state.showToast);
  const isHigh = type === "high";
  const colorClasses = isHigh ? "text-accent4" : "text-accent3";
  const bgClass = isHigh ? "bg-accent4" : "bg-accent3";

  const borderClass = isHigh ? "border-accent4-transparent" : "border-accent3-transparent";

  const containerBg = isHigh ? "bg-accent4-transparent" : "bg-accent3-transparent";

  const addAction = () => {
    if (actions.length >= 4) {
      showToast("حداکثر ۴ عملیات برای هر وضعیت مجاز است", "error");

      return;
    }

    const availableHolds = [0, 3, 5, 10].filter(
      (hold) => !actions.some((action) => action.reqHold === hold),
    );

    if (availableHolds.length === 0) return;
    onUpdate([
      ...actions,
      { reqHold: availableHolds[0], targetPin: "", actionOn: true, actionType: 0, delay: 0 },
    ]);
  };

  const removeAction = (index: number) => {
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
          disabled={actions.length >= 4}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors disabled:opacity-50 ${isHigh ? "border-accent4 text-accent4 hover:bg-accent4 hover:text-white" : "border-accent3 text-accent3 hover:bg-accent3 hover:text-bg-main"}`}
        >
          <Plus aria-hidden="true" className="size-3" /> افزودن
        </button>
      </div>
      {actions.length === 0 ? (
        <div className="text-center py-4 text-text-tertiary text-xs bg-card-bg-solid rounded-lg border border-dashed border-border-color">
          هیچ عملیاتی تعریف نشده
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map((action, idx) => (
            <ConditionActionItem
              key={action.reqHold}
              action={action}
              idx={idx}
              actions={actions}
              onRemove={() => removeAction(idx)}
              onUpdate={(updates) => updateAction(idx, updates)}
              showToast={showToast}
            />
          ))}
        </div>
      )}
    </div>
  );
}
