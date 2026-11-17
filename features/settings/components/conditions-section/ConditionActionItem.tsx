import { useId } from "react";
import { DeleteButton } from "@/components/ui/delete-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export interface ConditionAction {
  reqHold: number;
  targetPin: string;
  actionOn: boolean;
  actionType?: number;
  delay?: number;
}

interface Props {
  action: ConditionAction;
  idx: number;
  actions: ConditionAction[];
  onRemove: () => void;
  onUpdate: (updates: Partial<ConditionAction>) => void;
  showToast: (msg: string, type: "success" | "error") => void;
}

export function ConditionActionItem({
  action,
  idx,
  actions,
  onRemove,
  onUpdate,
  showToast,
}: Props) {
  const baseId = useId();
  const holdId = `${baseId}-hold`;
  const pinId = `${baseId}-pin`;
  const stateId = `${baseId}-state`;
  const typeId = `${baseId}-type`;
  const delayId = `${baseId}-delay`;

  return (
    <div className="bg-card-bg-solid p-4 rounded-xl border border-border-color relative shadow-sm">
      <DeleteButton
        size="sm"
        resetAfter={0}
        onConfirm={onRemove}
        label="حذف عملیات"
        className="absolute top-2.5 left-2.5 z-10"
      />
      <div className="flex flex-col gap-3 text-xs pr-2">
        <div>
          <Label htmlFor={holdId} className="block font-semibold mb-1.5">
            زمان نگه‌داشتن:
          </Label>
          <Select
            id={holdId}
            aria-label="زمان نگه‌داشتن"
            value={action.reqHold}
            onChange={(e) => {
              const val = Number.parseInt(e.target.value, 10);

              if (actions.some((a, i) => i !== idx && a.reqHold === val)) {
                showToast("این زمان قبلاً استفاده شده است", "error");

                return;
              }

              onUpdate({ reqHold: val });
            }}
            className="bg-bg-primary p-2.5 rounded-lg text-xs"
          >
            <option value={0}>بدون نیاز به نگه‌داشتن (فوری)</option>
            <option value={3}>۳ ثانیه</option>
            <option value={5}>۵ ثانیه</option>
            <option value={10}>۱۰ ثانیه</option>
          </Select>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Label htmlFor={pinId} className="block font-semibold mb-1.5">
              پایه هدف (GPIO):
            </Label>
            <Input
              id={pinId}
              aria-label="پایه هدف GPIO"
              type="text"
              placeholder="مثال: 4"
              value={action.targetPin}
              onChange={(e) => onUpdate({ targetPin: e.target.value })}
              className="bg-bg-primary p-2.5 rounded-lg text-xs text-left"
              dir="ltr"
            />
          </div>
          <div className="flex-1">
            <Label htmlFor={stateId} className="block font-semibold mb-1.5">
              وضعیت:
            </Label>
            <Select
              id={stateId}
              aria-label="وضعیت خروجی"
              value={action.actionOn ? "1" : "0"}
              onChange={(e) => onUpdate({ actionOn: e.target.value === "1" })}
              className="bg-bg-primary p-2.5 rounded-lg text-xs"
            >
              <option value="1">روشن (HIGH)</option>
              <option value="0">خاموش (LOW)</option>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor={typeId} className="block font-semibold mb-1.5">
            نوع عملیات:
          </Label>
          <Select
            id={typeId}
            aria-label="نوع عملیات"
            value={action.actionType || 0}
            onChange={(e) => onUpdate({ actionType: Number.parseInt(e.target.value, 10) })}
            className="bg-bg-primary p-2.5 rounded-lg text-xs"
          >
            <option value={0}>همان لحظه تغییر کند</option>
            <option value={1}>بعد از زمان تعیین‌شده تغییر کند</option>
            <option value={2}>فقط برای مدت معین بماند</option>
          </Select>
        </div>
        {(action.actionType || 0) > 0 && (
          <div>
            <Label htmlFor={delayId} className="block font-semibold mb-1.5">
              زمان عملیات (ثانیه):
            </Label>
            <Input
              id={delayId}
              aria-label="زمان عملیات به ثانیه"
              type="number"
              min="1"
              max="60"
              value={action.delay || 10}
              onChange={(e) => {
                const raw = e.target.value;

                if (!raw) {
                  onUpdate({ delay: undefined });

                  return;
                }

                const parsed = Number.parseInt(raw, 10);

                if (!Number.isNaN(parsed)) {
                  onUpdate({ delay: parsed });
                }
              }}
              className="bg-bg-primary p-2.5 rounded-lg text-xs text-left"
              dir="ltr"
            />
          </div>
        )}
      </div>
    </div>
  );
}
