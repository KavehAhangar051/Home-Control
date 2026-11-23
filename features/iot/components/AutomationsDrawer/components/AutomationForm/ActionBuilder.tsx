import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";
import { Square } from "@/components/ui/hugeicons-groups/controls";
import { Layers, Play, Plus } from "@/components/ui/hugeicons-groups/shell";
import { Select } from "@/components/ui/select";
import type { AutomationAction } from "@/features/iot/hooks/store/types";
import { isReadOnlyInputSegment } from "@/features/iot/utils/analogInput";
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

  const controllableSegments = segments.filter(
    (seg) =>
      seg.type !== "placeholder" && !isReadOnlyInputSegment(seg) && seg.pin.trim().length > 0,
  );

  return (
    <div className="col-span-2 space-y-3 pt-2">
      <div className="block text-xs font-medium text-text-secondary">
        عملیات‌ها ({actions.length}):
      </div>

      {actions.length === 0 && (
        <p className="rounded-xl border border-dashed border-border-color bg-card-bg/60 px-3 py-4 text-center text-xs text-text-muted">
          هنوز عملیاتی اضافه نشده است؛ یکی از دکمه‌های زیر را بزنید.
        </p>
      )}

      {(() => {
        const seenKeys = new Map<string, number>();
        return actions.map((act, index) => {
          const baseKey =
            act.targetPin !== undefined
              ? `pin-${act.targetPin}-${act.actionOn ? "on" : "off"}`
              : `macro-${act.targetMacro ?? "empty"}`;
          const occurrence = (seenKeys.get(baseKey) ?? 0) + 1;
          seenKeys.set(baseKey, occurrence);
          const itemKey = occurrence === 1 ? baseKey : `${baseKey}#${occurrence}`;

          return (
            <Card
              key={itemKey}
              className="!relative !gap-2 !rounded-xl !border-border-color !bg-card-bg !p-3 group"
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
                    <span className="text-xs font-medium text-text-secondary bg-card-hover-bg border border-border-color px-2 py-1 rounded-md">
                      پایه
                    </span>
                    <Select
                      aria-label={`انتخاب پایه برای عملیات ${index + 1}`}
                      value={act.targetPin}
                      onChange={(e) => updateAction(index, { targetPin: e.target.value })}
                      wrapperClassName="min-w-0 flex-1"
                      className="h-9 bg-card-bg-solid p-2 rounded-lg text-xs"
                    >
                      {controllableSegments.map((seg) => (
                        <option key={seg.id} value={seg.pin}>
                          {seg.title} (GPIO {seg.pin})
                        </option>
                      ))}
                      {!controllableSegments.find((s) => s.pin === act.targetPin) && (
                        <option value={act.targetPin}>پایه دستی: {act.targetPin}</option>
                      )}
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-1 p-1 bg-card-bg-solid rounded-lg border border-border-color">
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => updateAction(index, { actionOn: true })}
                      className={`flex-1 min-h-9 py-1.5 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent4 ${act.actionOn ? "bg-accent4 text-accent4-foreground hover:bg-accent4 hover:text-accent4-foreground" : "bg-transparent text-text-secondary md:hover:bg-accent md:hover:text-foreground"}`}
                    >
                      <Play strokeWidth={1.5} className="size-3.5" aria-hidden="true" /> روشن
                    </Button>
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => updateAction(index, { actionOn: false })}
                      className={`flex-1 min-h-9 py-1.5 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive ${!act.actionOn ? "bg-destructive text-destructive-foreground hover:bg-destructive hover:text-destructive-foreground" : "bg-transparent text-text-secondary md:hover:bg-destructive/10 md:hover:text-destructive"}`}
                    >
                      <Square strokeWidth={1.5} className="size-3.5" aria-hidden="true" /> خاموش
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-text-secondary bg-card-hover-bg border border-border-color px-2 py-1 rounded-md flex items-center gap-1">
                    <Layers strokeWidth={1.5} className="size-3.5" />
                    ماکرو
                  </span>
                  <Select
                    aria-label={`انتخاب ماکرو برای عملیات ${index + 1}`}
                    value={act.targetMacro}
                    onChange={(e) => updateAction(index, { targetMacro: e.target.value })}
                    wrapperClassName="min-w-0 flex-1"
                    className="h-9 bg-card-bg-solid p-2 rounded-lg text-xs"
                  >
                    <option value="" disabled>
                      یک ماکرو انتخاب کنید
                    </option>
                    {macros.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </Card>
          );
        });
      })()}

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="ghost"
          type="button"
          onClick={() => addAction("pin")}
          className="flex-1 min-h-11 py-2 border border-dashed border-border-color bg-card-bg rounded-lg text-xs font-medium text-text-primary hover:text-accent-foreground hover:bg-accent hover:border-accent3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent3 transition-colors flex items-center justify-center gap-1"
        >
          <Plus strokeWidth={1.5} className="size-3.5" /> پایه
        </Button>
        <Button
          variant="ghost"
          type="button"
          onClick={() => addAction("macro")}
          className="flex-1 min-h-11 py-2 border border-dashed border-border-color bg-card-bg rounded-lg text-xs font-medium text-text-primary hover:text-accent-foreground hover:bg-accent hover:border-accent3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent3 transition-colors flex items-center justify-center gap-1"
        >
          <Plus strokeWidth={1.5} className="size-3.5" /> ماکرو
        </Button>
      </div>
    </div>
  );
}
