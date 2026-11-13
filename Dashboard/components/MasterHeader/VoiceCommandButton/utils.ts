const PHONETIC_MAP = {
  غ: "ق",
  ص: "س",
  ث: "س",
  ض: "ز",
  ظ: "ز",
  ذ: "ز",
  ه: "ح",
  ط: "ت",
  ي: "ی",
  ك: "ک",
} satisfies Record<string, string>;

const PHONETIC_REGEX = /[غصثضظذهطيك]|[\u200C\s]+/g;

export function normalizePhonetics(text: string): string {
  if (!text) return "";

  return text
    .replace(PHONETIC_REGEX, (match) => {
      const code = match.charCodeAt(0);

      if (code === 32 || code === 0x200c || match.length > 1) {
        return " ";
      }

      if (match in PHONETIC_MAP) {
        // SAFETY: in operator verifies match is a valid key of PHONETIC_MAP
        return PHONETIC_MAP[match as keyof typeof PHONETIC_MAP];
      }

      return match;
    })
    .trim();
}

export function getSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const aLen = a.length;
  const bLen = b.length;

  if (aLen === 0) return bLen === 0 ? 1 : 0;

  if (bLen === 0) return 0;

  let strA = a;
  let strB = b;
  let lenA = aLen;
  let lenB = bLen;

  if (lenA > lenB) {
    strA = b;
    strB = a;
    lenA = bLen;
    lenB = aLen;
  }

  const row0 = new Int32Array(lenA + 1);
  const row1 = new Int32Array(lenA + 1);

  for (let j = 0; j <= lenA; j++) {
    row0[j] = j;
  }

  for (let i = 1; i <= lenB; i++) {
    row1[0] = i;
    const bChar = strB.charCodeAt(i - 1);

    for (let j = 1; j <= lenA; j++) {
      const cost = strA.charCodeAt(j - 1) === bChar ? 0 : 1;
      const del = row0[j] + 1;
      const ins = row1[j - 1] + 1;
      const sub = row0[j - 1] + cost;

      let min = del < ins ? del : ins;

      if (sub < min) min = sub;
      row1[j] = min;
    }

    for (let j = 0; j <= lenA; j++) {
      row0[j] = row1[j];
    }
  }

  const dist = row0[lenA];
  const maxLen = lenB;

  return (maxLen - dist) / maxLen;
}

export interface VoiceCommandExecutionContext {
  voiceCommands?: Array<{
    phrase: string;
    actions?: Array<{ targetPin?: string; actionOn?: boolean; targetMacro?: string }>;
  }>;
  macros?: Array<{ id: string; actions: Array<{ targetPin: string; actionOn: boolean }> }>;
  segments?: Array<{ pin: string; title: string }>;
  handleSetPinState: (pin: string, state: boolean) => void;
  handleBatchPinState: (actions: Array<{ targetPin: string; actionOn: boolean }>) => void;
  showToast: (message: string, type: "success" | "error") => void;
}

/**
 * Deep voice command resolution engine:
 * Encapsulates phonetic normalization, Levenshtein distance similarity,
 * macro action unfolding, suffix matching (" روشن" / " خاموش"), and status notifications.
 */
export function executeVoiceCommand(
  finalTranscript: string,
  context: VoiceCommandExecutionContext,
): void {
  const cleanTranscript = finalTranscript
    .trim()
    .replace(/[.،!؟]+$/, "")
    .trim();

  if (!cleanTranscript) return;

  const normalizedTranscript = normalizePhonetics(cleanTranscript);

  // 1. Try matching configured custom voice commands
  let bestMatchCmd: NonNullable<VoiceCommandExecutionContext["voiceCommands"]>[number] | null =
    null;

  let highestSim = 0;

  const VOICE_SIMILARITY_THRESHOLD = 0.8;
  const SUFFIX_TURN_ON = " روشن";
  const SUFFIX_TURN_OFF = " خاموش";

  for (const command of context.voiceCommands ?? []) {
    const similarity = getSimilarity(normalizePhonetics(command.phrase), normalizedTranscript);

    if (similarity > highestSim && similarity >= VOICE_SIMILARITY_THRESHOLD) {
      highestSim = similarity;
      bestMatchCmd = command;
    }
  }

  if (bestMatchCmd?.actions?.length) {
    const batchActions: Array<{ targetPin: string; actionOn: boolean }> = [];

    bestMatchCmd.actions.forEach((action) => {
      if (action.targetPin) {
        batchActions.push({ targetPin: action.targetPin, actionOn: action.actionOn ?? true });
      } else if (action.targetMacro) {
        const macro = context.macros?.find((item) => item.id === action.targetMacro);

        if (macro) batchActions.push(...macro.actions);
      }
    });

    if (batchActions.length > 0) {
      context.handleBatchPinState(batchActions);
      context.showToast(`فرمان صوتی اجرا شد: ${cleanTranscript}`, "success");

      return;
    }
  }

  // 2. Try matching segment suffix commands (" روشن" or " خاموش")
  let targetState: boolean | null = null;
  let segmentName = "";

  if (cleanTranscript.endsWith(SUFFIX_TURN_ON)) {
    targetState = true;
    segmentName = cleanTranscript.slice(0, -SUFFIX_TURN_ON.length).trim();
  } else if (cleanTranscript.endsWith(SUFFIX_TURN_OFF)) {
    targetState = false;
    segmentName = cleanTranscript.slice(0, -SUFFIX_TURN_OFF.length).trim();
  }

  if (targetState !== null) {
    const normalizedSegmentName = normalizePhonetics(segmentName);
    let bestSegment: NonNullable<VoiceCommandExecutionContext["segments"]>[number] | null = null;
    let highestSegmentSimilarity = 0;

    for (const segment of context.segments ?? []) {
      const similarity = getSimilarity(normalizePhonetics(segment.title), normalizedSegmentName);

      if (similarity > highestSegmentSimilarity && similarity >= VOICE_SIMILARITY_THRESHOLD) {
        highestSegmentSimilarity = similarity;
        bestSegment = segment;
      }
    }

    if (bestSegment) {
      context.handleSetPinState(bestSegment.pin, targetState);
      context.showToast(`فرمان صوتی اجرا شد: ${cleanTranscript}`, "success");
    } else {
      context.showToast(`سگمنتی با نام مشابه «${segmentName}» یافت نشد.`, "error");
    }
  } else {
    context.showToast(`فرمان نامعتبر: ${cleanTranscript}`, "error");
  }
}
