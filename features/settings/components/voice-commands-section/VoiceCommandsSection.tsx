import { AnimatePresence, m } from "motion/react";
import { useState } from "react";
import { Plus } from "@/components/ui/hugeicons-groups/shell";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { VoiceCommandEditCard, VoiceCommandViewCard } from "./VoiceCommandCard";
import { VoiceTranscriptOverlay } from "./VoiceTranscriptOverlay";

export default function VoiceCommandsSection() {
  const voiceCommands = useIoTStore((s) => s.voiceCommands);
  const setVoiceCommands = useIoTStore((s) => s.setVoiceCommands);
  const segments = useIoTStore((s) => s.segments);
  const macros = useIoTStore((s) => s.macros);
  const isListening = useIoTStore((s) => s.isListening);
  const voiceTranscript = useIoTStore((s) => s.voiceTranscript);
  const showToast = useIoTStore((s) => s.showToast);
  const [editingCommandId, setEditingCommandId] = useState<string | null>(null);
  const [newCommandPhrase, setNewCommandPhrase] = useState("");

  const [tempActions, setTempActions] = useState<
    Array<{ targetPin?: string; targetMacro?: string; actionOn?: boolean }>
  >([]);

  const handleAddCommand = () => {
    const newCommand = {
      id: `voice_${Date.now()}`,
      phrase: "فرمان جدید",
      actions: [],
    };

    setVoiceCommands([...(voiceCommands || []), newCommand]);
    setEditingCommandId(newCommand.id);
    setNewCommandPhrase(newCommand.phrase);
    setTempActions([]);
  };

  const handleDeleteCommand = (id: string) => {
    setVoiceCommands((voiceCommands || []).filter((cmd) => cmd.id !== id));

    if (editingCommandId === id) setEditingCommandId(null);
  };

  const handleSaveCommand = (id: string) => {
    const trimmedPhrase = newCommandPhrase.trim();

    if (!trimmedPhrase) {
      showToast("عبارت فرمان صوتی را وارد کنید.", "error");

      return;
    }

    setVoiceCommands(
      (voiceCommands || []).map((cmd) =>
        cmd.id === id
          ? { ...cmd, phrase: trimmedPhrase, actions: tempActions.map((a) => ({ ...a })) }
          : cmd,
      ),
    );
    setEditingCommandId(null);
  };

  return (
    <div className="space-y-4 text-right">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-medium tabular-nums text-text-muted">
          {(voiceCommands || []).length} فرمان ثبت‌شده
        </span>
        <button
          type="button"
          onClick={handleAddCommand}
          className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-accent3 px-4 py-2 text-xs font-semibold text-accent3-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset"
        >
          <Plus className="size-3.5" strokeWidth={2} aria-hidden="true" />
          <span>دستور جدید</span>
        </button>
      </div>

      <VoiceTranscriptOverlay isListening={isListening} voiceTranscript={voiceTranscript} />

      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {(!voiceCommands || voiceCommands.length === 0) && (
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-7 px-4 bg-card-bg-solid border border-dashed border-border-color rounded-2xl space-y-1"
            >
              <p className="text-xs font-medium text-text-secondary">فرمانی ثبت نشده است</p>
              <p className="text-xs leading-5 text-text-muted">عبارتی را که می‌خواهید بگویید وارد کنید و عملکرد آن را مشخص کنید.</p>
            </m.div>
          )}

          {(voiceCommands || []).map((cmd) =>
            editingCommandId === cmd.id ? (
              <VoiceCommandEditCard
                key={cmd.id}
                newCommandPhrase={newCommandPhrase}
                setNewCommandPhrase={setNewCommandPhrase}
                tempActions={tempActions}
                setTempActions={setTempActions}
                onSave={() => handleSaveCommand(cmd.id)}
                onCancel={() => setEditingCommandId(null)}
                segments={segments}
                macros={macros}
              />
            ) : (
              <VoiceCommandViewCard
                key={cmd.id}
                cmd={cmd}
                onEditStart={() => {
                  setEditingCommandId(cmd.id);
                  setNewCommandPhrase(cmd.phrase);
                  setTempActions(cmd.actions.map((a) => ({ ...a })));
                }}
                onDelete={() => handleDeleteCommand(cmd.id)}
              />
            ),
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
