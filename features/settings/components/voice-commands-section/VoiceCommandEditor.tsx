import { Check } from "@/components/ui/hugeicons-groups/controls";
import { X } from "@/components/ui/hugeicons-groups/shell";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AutomationAction, Macro, Segment } from "@/features/iot/hooks/store/types";
import { VoiceCommandActionsEditor } from "./VoiceCommandActionsEditor";

interface Props {
  newCommandPhrase: string;
  setNewCommandPhrase: (val: string) => void;
  tempActions: AutomationAction[];
  setTempActions: (val: AutomationAction[]) => void;
  onSave: () => void;
  onCancel: () => void;
  segments: Segment[];
  macros: Macro[];
}

export function VoiceCommandEditor({
  newCommandPhrase,
  setNewCommandPhrase,
  tempActions,
  setTempActions,
  onSave,
  onCancel,
  segments,
  macros,
}: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Input
          type="text"
          aria-label="عبارت صوتی"
          value={newCommandPhrase}
          onChange={(e) => setNewCommandPhrase(e.target.value)}
          placeholder="عبارت صوتی (مثلاً: رقص نور)..."
          className="flex-1 bg-card-bg-solid border-border-color rounded-xl px-4 py-2.5 text-sm text-text-primary focus:border-accent3"
        />
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={onSave}
                className="p-2.5 bg-accent3 text-accent3-foreground rounded-xl hover:bg-accent3-dark transition-colors shadow-xs"
                aria-label="ذخیره دستور صوتی"
              >
                <Check className="size-4" />
              </button>
            }
          />
          <TooltipContent>ذخیره</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={onCancel}
                className="p-2.5 border border-border-color text-text-secondary rounded-xl hover:border-accent4 hover:text-accent4 transition-colors bg-card-bg-solid"
                aria-label="انصراف از ویرایش دستور صوتی"
              >
                <X className="size-4" />
              </button>
            }
          />
          <TooltipContent>انصراف</TooltipContent>
        </Tooltip>
      </div>

      <VoiceCommandActionsEditor
        tempActions={tempActions}
        setTempActions={setTempActions}
        segments={segments}
        macros={macros}
      />
    </div>
  );
}
