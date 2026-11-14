import { AnimatePresence, m } from "motion/react";
import { TRANSITION_ENTER_QUICK, TRANSITION_EXIT_QUICK } from "@/lib/ease";

interface Props {
  isListening: boolean;
  voiceTranscript: string;
}

export function VoiceTranscriptOverlay({ isListening, voiceTranscript }: Props) {
  return (
    <AnimatePresence>
      {isListening && (
        <m.div
          initial={{ opacity: 0, y: -6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.96, transition: TRANSITION_EXIT_QUICK }}
          transition={TRANSITION_ENTER_QUICK}
          className="overflow-hidden mt-4"
        >
          <div className="bg-[var(--accent4-transparent)] border border-[var(--accent4)] rounded-2xl p-4 flex flex-col items-center justify-center gap-3 relative shadow-lg shadow-[var(--accent4)]/10">
            <div className="absolute inset-0 bg-[var(--accent4)] opacity-10 animate-pulse rounded-2xl" />
            <div className="flex items-center gap-3 z-10">
              <div className="w-2 h-2 rounded-full bg-[var(--accent4)] animate-ping" />
              <span className="text-[var(--accent4)] font-semibold text-sm">در حال شنیدن...</span>
              <div className="w-2 h-2 rounded-full bg-[var(--accent4)] animate-ping" />
            </div>
            <div className="z-10 min-h-[2.5rem] flex items-center justify-center">
              <p className="text-2xl font-bold text-center text-[var(--text-primary)]">
                {voiceTranscript ? `« ${voiceTranscript} »` : "..."}
              </p>
            </div>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
