import { m } from "motion/react";
import type React from "react";
import { DeleteButton } from "@/components/ui/delete-button";
import { Edit2, Mic } from "@/components/ui/hugeicons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type {
  AutomationAction,
  Macro,
  Segment,
  VoiceCommand,
} from "@/features/iot/hooks/store/types";
import { VoiceCommandEditor } from "./VoiceCommandEditor";
import { TRANSITION_ENTER_STANDARD, TRANSITION_EXIT_STANDARD } from "@/lib/ease";

interface Props {
  cmd: VoiceCommand;
  isEditing: boolean;
  onEditStart: () => void;
  onDelete: () => void;
  newCommandPhrase: string;
  setNewCommandPhrase: (val: string) => void;
  tempActions: AutomationAction[];
  setTempActions: (val: AutomationAction[]) => void;
  onSave: () => void;
  onCancel: () => void;
  segments: Segment[];
  macros: Macro[];
}

function VoiceCommandCardFrame({ children }: { children: React.ReactNode }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{
        opacity: 0,
        y: -12,
        transition: TRANSITION_EXIT_STANDARD,
      }}
      transition={TRANSITION_ENTER_STANDARD}
      className="bg-[var(--card-bg-solid)] border border-[var(--border-color)] p-4 rounded-2xl shadow-sm flex flex-col gap-3"
    >
      {children}
    </m.div>
  );
}

interface VoiceCommandViewCardProps {
  cmd: VoiceCommand;
  onEditStart: () => void;
  onDelete: () => void;
}

export function VoiceCommandViewCard({ cmd, onEditStart, onDelete }: VoiceCommandViewCardProps) {
  return (
    <VoiceCommandCardFrame>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center bg-[var(--accent3-transparent)] border border-[var(--accent3)] rounded-xl text-xl text-[var(--accent3)]">
            <Mic className="w-5 h-5" strokeWidth={2} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="font-bold text-[var(--text-primary)]">&quot;{cmd.phrase}&quot;</span>
            <span className="text-xs text-[var(--text-secondary)] opacity-80">
              {cmd.actions.length} عملیات
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={onEditStart}
                  className="p-2 bg-[var(--card-bg-solid)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--accent3)] hover:border-[var(--accent3)] rounded-xl transition-[border-color,color,scale] duration-150 ease-out active:scale-[0.96]"
                  aria-label={`ویرایش دستور ${cmd.phrase}`}
                >
                  <Edit2 className="w-4 h-4" strokeWidth={2} />
                </button>
              }
            />
            <TooltipContent>ویرایش</TooltipContent>
          </Tooltip>
          <DeleteButton
            size="sm"
            resetAfter={0}
            onConfirm={onDelete}
            label={`حذف دستور ${cmd.phrase}`}
          />
        </div>
      </div>
    </VoiceCommandCardFrame>
  );
}

interface VoiceCommandEditCardProps {
  newCommandPhrase: string;
  setNewCommandPhrase: (val: string) => void;
  tempActions: AutomationAction[];
  setTempActions: (val: AutomationAction[]) => void;
  onSave: () => void;
  onCancel: () => void;
  segments: Segment[];
  macros: Macro[];
}

export function VoiceCommandEditCard({
  newCommandPhrase,
  setNewCommandPhrase,
  tempActions,
  setTempActions,
  onSave,
  onCancel,
  segments,
  macros,
}: VoiceCommandEditCardProps) {
  return (
    <VoiceCommandCardFrame>
      <VoiceCommandEditor
        newCommandPhrase={newCommandPhrase}
        setNewCommandPhrase={setNewCommandPhrase}
        tempActions={tempActions}
        setTempActions={setTempActions}
        onSave={onSave}
        onCancel={onCancel}
        segments={segments}
        macros={macros}
      />
    </VoiceCommandCardFrame>
  );
}

export function VoiceCommandCard({
  cmd,
  isEditing,
  onEditStart,
  onDelete,
  newCommandPhrase,
  setNewCommandPhrase,
  tempActions,
  setTempActions,
  onSave,
  onCancel,
  segments,
  macros,
}: Props) {
  if (isEditing) {
    return (
      <VoiceCommandEditCard
        newCommandPhrase={newCommandPhrase}
        setNewCommandPhrase={setNewCommandPhrase}
        tempActions={tempActions}
        setTempActions={setTempActions}
        onSave={onSave}
        onCancel={onCancel}
        segments={segments}
        macros={macros}
      />
    );
  }

  return <VoiceCommandViewCard cmd={cmd} onEditStart={onEditStart} onDelete={onDelete} />;
}
