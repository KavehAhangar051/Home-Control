import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";
import { Layers, Play, Plus, Square } from "@/components/ui/hugeicons";
import type { AutomationAction } from "@/features/iot/hooks/store/types";
import { useAutomationActions } from "../../hooks/useAutomationActions";

interface ActionBuilderProps {
  actions: AutomationAction[];
  setActions: (actions: AutomationAction[]) => void;
}

export default function ActionBuilder({ actions, setActions }: ActionBuilderProps) {
  const { addAction, updateAction, removeAction, segments, macros } = useAutomationActions(
    actions,
    setActions,
  );

  return (
    <div className="col-span-2 space-y-3 pt-2">
      <div className="block text-xs font-medium text-[var(--text-secondary)]">
        عملیات‌ها ({actions.length}):
      </div>

      {actions.map((act, index) => (
        <Card
          key={act.targetPin ?? act.targetMacro}
          className="!relative !gap-2 !rounded-xl !border-[var(--border-color)] !bg-[var(--card-bg)] !p-3 group"
        >
          <DeleteButton
            size="xs"
            resetAfter={0}
            onConfirm={() => removeAction(index)}
            label={`حذف عملیات ${index + 1}`}
            className="absolute -top-3 -left-2 z-10"
          />

          {act.targetPin !== undefined ? (
            <>
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-xs font-medium text-[var(--text-secondary)] bg-[var(--card-hover-bg)] border border-[var(--border-color)] px-2 py-1 rounded-md">
                  پایه
                </span>
                <select
                  aria-label={`انتخاب پایه برای عملیات ${index + 1}`}
                  value={act.targetPin}
                  onChange={(e) => updateAction(index, { targetPin: e.target.value })}
                  className="min-w-0 flex-1 bg-[var(--card-bg-solid)] border border-[var(--border-color)] p-2 rounded-lg focus:outline-none focus:border-[var(--accent3)] focus:ring-2 focus:ring-[var(--accent3)]/20 text-xs transition-colors text-[var(--text-primary)]"
                >
                  {segments.map((seg) => (
                    <option key={seg.id} value={seg.pin}>
                      {seg.title} (GPIO {seg.pin})
                    </option>
                  ))}
                  {!segments.find((s) => s.pin === act.targetPin) && (
                    <option value={act.targetPin}>پایه دستی: {act.targetPin}</option>
                  )}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-1 p-1 bg-[var(--card-bg-solid)] rounded-lg border border-[var(--border-color)]">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => updateAction(index, { actionOn: true })}
                  className={`flex-1 min-h-9 py-1.5 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent4)] ${act.actionOn ? "bg-[var(--accent4)] text-white" : "bg-transparent text-[var(--text-secondary)] md:hover:bg-[var(--accent)] md:hover:text-[var(--foreground)]"}`}
                >
                  <Play strokeWidth={1.5} className="w-3.5 h-3.5" /> روشن
                </Button>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => updateAction(index, { actionOn: false })}
                  className={`flex-1 min-h-9 py-1.5 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--destructive)] ${!act.actionOn ? "bg-[var(--destructive)] text-white" : "bg-transparent text-[var(--text-secondary)] md:hover:bg-[var(--destructive)]/10 md:hover:text-[var(--destructive)]"}`}
                >
                  <Square strokeWidth={1.5} className="w-3.5 h-3.5" /> خاموش
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--text-secondary)] bg-[var(--card-hover-bg)] border border-[var(--border-color)] px-2 py-1 rounded-md flex items-center gap-1">
                <Layers strokeWidth={1.5} className="w-3.5 h-3.5" />
                ماکرو
              </span>
              <select
                aria-label={`انتخاب ماکرو برای عملیات ${index + 1}`}
                value={act.targetMacro}
                onChange={(e) => updateAction(index, { targetMacro: e.target.value })}
                className="min-w-0 flex-1 bg-[var(--card-bg-solid)] border border-[var(--border-color)] p-2 rounded-lg focus:outline-none focus:border-[var(--accent3)] focus:ring-2 focus:ring-[var(--accent3)]/20 text-xs transition-colors text-[var(--text-primary)]"
              >
                <option value="" disabled>
                  یک ماکرو انتخاب کنید
                </option>
                {macros.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </Card>
      ))}

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="ghost"
          type="button"
          onClick={() => addAction("pin")}
          className="flex-1 min-h-11 py-2 border border-dashed border-[var(--border-color)] bg-[var(--card-bg)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:text-[var(--accent-foreground)] hover:bg-[var(--accent)] hover:border-[var(--accent3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent3)] transition-colors flex items-center justify-center gap-1"
        >
          <Plus strokeWidth={1.5} className="w-3.5 h-3.5" /> پایه
        </Button>
        <Button
          variant="ghost"
          type="button"
          onClick={() => addAction("macro")}
          className="flex-1 min-h-11 py-2 border border-dashed border-[var(--border-color)] bg-[var(--card-bg)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:text-[var(--accent-foreground)] hover:bg-[var(--accent)] hover:border-[var(--accent3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent3)] transition-colors flex items-center justify-center gap-1"
        >
          <Plus strokeWidth={1.5} className="w-3.5 h-3.5" /> ماکرو
        </Button>
      </div>
    </div>
  );
}
