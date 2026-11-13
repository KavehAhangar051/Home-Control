import { DeleteButton } from "@/components/ui/delete-button";

interface Props {
  tempActions: Array<{ targetPin?: string; targetMacro?: string; actionOn?: boolean }>;
  setTempActions: (
    actions: Array<{ targetPin?: string; targetMacro?: string; actionOn?: boolean }>,
  ) => void;
  segments: any[];
  macros: any[];
}

export function VoiceCommandActionsEditor({
  tempActions,
  setTempActions,
  segments,
  macros,
}: Props) {
  const handleAddAction = () => {
    if (segments.length === 0 && macros.length === 0) return;

    if (segments.length > 0) {
      setTempActions([...tempActions, { targetPin: segments[0].pin, actionOn: true }]);
    } else {
      setTempActions([...tempActions, { targetMacro: macros[0].id }]);
    }
  };

  const handleRemoveAction = (index: number) => {
    const newActions = [...tempActions];
    newActions.splice(index, 1);
    setTempActions(newActions);
  };

  const handleUpdateAction = (
    index: number,
    updates: Partial<{ targetPin?: string; targetMacro?: string; actionOn?: boolean }>,
  ) => {
    const newActions = [...tempActions];

    if (updates.targetPin !== undefined) {
      newActions[index] = {
        targetPin: updates.targetPin,
        actionOn: newActions[index].actionOn ?? true,
      };
    } else if (updates.targetMacro !== undefined) {
      newActions[index] = { targetMacro: updates.targetMacro };
    } else {
      newActions[index] = { ...newActions[index], ...updates };
    }

    setTempActions(newActions);
  };

  return (
    <div className="space-y-2 border-t border-[var(--border-color)] pt-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-[var(--text-secondary)]">عملیات‌ها</h4>
        <button
          type="button"
          onClick={handleAddAction}
          className="text-[var(--accent3)] text-xs font-bold px-2 py-1 bg-[var(--accent3-transparent)] rounded-lg hover:bg-[var(--accent3)] hover:text-[var(--bg-main)] transition-colors"
        >
          + افزودن
        </button>
      </div>

      {tempActions.length === 0 && (
        <p className="text-xs text-[var(--text-tertiary)] opacity-80 text-center py-2">
          عملیاتی اضافه نشده است
        </p>
      )}

      {tempActions.map((action, index) => {
        const isMacroAction = action.targetMacro !== undefined;

        const actionKey = isMacroAction
          ? `macro-${action.targetMacro ?? "empty"}`
          : `pin-${action.targetPin ?? "empty"}-${action.actionOn ? "on" : "off"}`;

        return (
          <div
            key={actionKey}
            className="flex flex-wrap items-center gap-2 bg-[var(--card-bg-solid)] border border-[var(--border-color)] p-2 rounded-xl"
          >
            <select
              aria-label="نوع هدف عملیات"
              value={isMacroAction ? "macro" : "pin"}
              onChange={(e) => {
                if (e.target.value === "macro" && macros.length > 0) {
                  handleUpdateAction(index, { targetMacro: macros[0].id });
                } else if (e.target.value === "pin" && segments.length > 0) {
                  handleUpdateAction(index, { targetPin: segments[0].pin });
                }
              }}
              className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent3)] focus:ring-1 focus:ring-[var(--accent3)] transition-colors"
            >
              <option value="pin">ماژول/سگمنت</option>
              <option value="macro" disabled={macros.length === 0}>
                دکمه سفارشی (ماکرو)
              </option>
            </select>

            {isMacroAction ? (
              <select
                aria-label="انتخاب ماکرو"
                value={action.targetMacro}
                onChange={(e) => handleUpdateAction(index, { targetMacro: e.target.value })}
                className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent3)] focus:ring-1 focus:ring-[var(--accent3)] transition-colors"
              >
                {macros.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <select
                  aria-label="انتخاب پایه سگمنت"
                  value={action.targetPin}
                  onChange={(e) => handleUpdateAction(index, { targetPin: e.target.value })}
                  className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent3)] focus:ring-1 focus:ring-[var(--accent3)] transition-colors"
                >
                  {segments.map((seg) => (
                    <option key={seg.id} value={seg.pin}>
                      {seg.title} ({seg.pin})
                    </option>
                  ))}
                </select>
                <select
                  aria-label="وضعیت خروجی عملیات"
                  value={action.actionOn ? "on" : "off"}
                  onChange={(e) => handleUpdateAction(index, { actionOn: e.target.value === "on" })}
                  className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent3)] focus:ring-1 focus:ring-[var(--accent3)] transition-colors"
                >
                  <option value="on">روشن شود</option>
                  <option value="off">خاموش شود</option>
                </select>
              </>
            )}

            <DeleteButton
              size="sm"
              resetAfter={0}
              onConfirm={() => handleRemoveAction(index)}
              label="حذف عملیات"
            />
          </div>
        );
      })}
    </div>
  );
}
