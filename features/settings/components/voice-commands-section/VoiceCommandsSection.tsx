import { AnimatePresence, m } from "motion/react";
import { useState } from "react";
import { Mic, Plus } from "@/components/ui/hugeicons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  const [editingCommandId, setEditingCommandId] = useState<string | null>(null);
  const [newCommandPhrase, setNewCommandPhrase] = useState("");

  const [tempActions, setTempActions] = useState<
    Array<{ targetPin?: string; targetMacro?: string; actionOn?: boolean }>
  >([]);

  const handleAddCommand = () => {
    const newCommand = {
      id: `voice_${Date.now()}`,
      phrase: "دستور جدید",
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
    setVoiceCommands(
      (voiceCommands || []).map((cmd) =>
        cmd.id === id ? { ...cmd, phrase: newCommandPhrase, actions: tempActions } : cmd,
      ),
    );
    setEditingCommandId(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 text-right">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold flex items-center gap-2 text-[var(--text-primary)]">
          <Mic className="w-5 h-5 text-[var(--accent3)]" />
          مدیریت دستورات صوتی
        </h3>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={handleAddCommand}
                className="bg-[var(--accent3)] text-[var(--bg-main)] p-2 rounded-xl hover:bg-[var(--accent3-dark)] transition-[background-color,scale] duration-150 ease-out active:scale-[0.96] shadow-md"
                aria-label="افزودن دستور صوتی جدید"
              >
                <Plus className="w-4 h-4" strokeWidth={2} />
              </button>
            }
          />
          <TooltipContent>افزودن دستور صوتی جدید</TooltipContent>
        </Tooltip>
      </div>

      <p className="text-sm text-[var(--text-secondary)] opacity-80 leading-relaxed">
        با تعریف دستورات صوتی، می‌توانید با گفتن یک عبارت خاص به دستیار صوتی، چندین دستور (مانند
        روشن/خاموش کردن ماژول‌ها یا اجرای ماکروها) را هم‌زمان اجرا کنید.
      </p>

      <VoiceTranscriptOverlay isListening={isListening} voiceTranscript={voiceTranscript} />

      <div className="space-y-3 mt-4">
        <AnimatePresence initial={false}>
          {(!voiceCommands || voiceCommands.length === 0) && (
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-7 px-4 bg-[var(--card-bg-solid)] border border-dashed border-[var(--border-color)] rounded-2xl space-y-1.5"
            >
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                هنوز دستور صوتی تعریف نشده است
              </p>
              <p className="text-xs text-[var(--text-secondary)] max-w-xs mx-auto leading-relaxed">
                روی دکمه «+» در بالا بزنید و عبارتی مانند «چراغ پذیرایی روشن» را به عملیات دلخواه
                متصل کنید.
              </p>
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
                  setTempActions(cmd.actions);
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
