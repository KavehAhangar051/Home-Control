// Pre-computed character code constants for hot-path phonetic scanning
const CODE_SPACE = 32;
const CODE_NBSP = 0x00a0;
const CODE_ZWNJ = 0x200c;

// Reusable scratch row for single-row Levenshtein DP (avoids 2x Int32Array allocations per call)
let levenshteinScratchRow = new Int32Array(64);

// Pre-compiled module-scope regexes for voice intent parsing
const TRAILING_PUNCT_REGEX = /[.،!؟]+$/;
const POLITE_VERB_SUFFIX_REGEX = /\s+(?:کن|کنید|بشه|شود)$/u;
const OBJECT_PARTICLE_SUFFIX_REGEX = /\s+(?:را|رو)$/u;
const TURN_ON_PREFIX_REGEX = /^روشن(?:\s+کردن)?\s+/u;
const TURN_OFF_PREFIX_REGEX = /^خاموش(?:\s+کردن)?\s+/u;

const VOICE_SIMILARITY_THRESHOLD = 0.8;

function isWhitespaceOrZwnj(code: number): boolean {
  return code <= CODE_SPACE || code === CODE_ZWNJ || code === CODE_NBSP;
}

function mapPhoneticCode(code: number): string | null {
  switch (code) {
    case 0x063a: // غ
      return "ق";
    case 0x0635: // ص
    case 0x062b: // ث
      return "س";
    case 0x0636: // ض
    case 0x0638: // ظ
    case 0x0630: // ذ
      return "ز";
    case 0x0647: // ه
      return "ح";
    case 0x0637: // ط
      return "ت";
    case 0x064a: // ي
      return "ی";
    case 0x0643: // ك
      return "ک";
    default:
      return null;
  }
}

/**
 * Single-pass phonetic normalizer using charCodeAt classification and range slicing.
 * Collapses whitespace/ZWNJ, trims boundaries, and folds homophones without regex callbacks.
 */
export function normalizePhonetics(text: string): string {
  const len = text.length;
  if (len === 0) return "";

  let start = 0;
  while (start < len && isWhitespaceOrZwnj(text.charCodeAt(start))) {
    start++;
  }
  if (start === len) return "";

  let end = len - 1;
  while (end > start && isWhitespaceOrZwnj(text.charCodeAt(end))) {
    end--;
  }

  let out = "";
  let chunkStart = start;
  let i = start;

  while (i <= end) {
    const code = text.charCodeAt(i);

    if (isWhitespaceOrZwnj(code)) {
      const nextIdx = i + 1;
      const isMultiOrNonAsciiSpace =
        code !== CODE_SPACE || (nextIdx <= end && isWhitespaceOrZwnj(text.charCodeAt(nextIdx)));

      if (isMultiOrNonAsciiSpace) {
        if (i > chunkStart) {
          out += text.slice(chunkStart, i);
        }
        out += " ";
        i = nextIdx;
        while (i <= end && isWhitespaceOrZwnj(text.charCodeAt(i))) {
          i++;
        }
        chunkStart = i;
        continue;
      }
      i++;
      continue;
    }

    const mapped = mapPhoneticCode(code);
    if (mapped !== null) {
      if (i > chunkStart) {
        out += text.slice(chunkStart, i);
      }
      out += mapped;
      chunkStart = i + 1;
    }

    i++;
  }

  if (chunkStart === start) {
    return start === 0 && end === len - 1 ? text : text.slice(start, end + 1);
  }

  return chunkStart <= end ? out + text.slice(chunkStart, end + 1) : out;
}

/**
 * Zero-allocation Levenshtein similarity engine.
 * Strips shared prefix/suffix in O(n) and reuses a single module-scoped Int32Array row.
 */
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

  const maxLen = lenB;

  // Trim common prefix
  let start = 0;
  while (start < lenA && strA.charCodeAt(start) === strB.charCodeAt(start)) {
    start++;
  }

  // Trim common suffix
  while (lenA > start && strA.charCodeAt(lenA - 1) === strB.charCodeAt(lenB - 1)) {
    lenA--;
    lenB--;
  }

  const trimA = lenA - start;
  const trimB = lenB - start;

  if (trimA === 0) {
    return (maxLen - trimB) / maxLen;
  }

  if (trimA + 1 > levenshteinScratchRow.length) {
    levenshteinScratchRow = new Int32Array(trimA + 1);
  }

  const row = levenshteinScratchRow;
  for (let j = 0; j <= trimA; j++) {
    row[j] = j;
  }

  for (let i = 1; i <= trimB; i++) {
    let prevDiag = row[0];
    row[0] = i;
    const bChar = strB.charCodeAt(start + i - 1);

    for (let j = 1; j <= trimA; j++) {
      const temp = row[j];
      const cost = strA.charCodeAt(start + j - 1) === bChar ? 0 : 1;
      const del = temp + 1;
      const ins = row[j - 1] + 1;
      const sub = prevDiag + cost;

      let min = del < ins ? del : ins;
      if (sub < min) min = sub;

      row[j] = min;
      prevDiag = temp;
    }
  }

  return (maxLen - row[trimA]) / maxLen;
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

function extractSegmentIntent(cleanTranscript: string): {
  targetState: boolean | null;
  segmentName: string;
} {
  const stripped = cleanTranscript.replace(POLITE_VERB_SUFFIX_REGEX, "").trim();

  if (stripped.endsWith(" روشن")) {
    return {
      targetState: true,
      segmentName: stripped.slice(0, -5).replace(OBJECT_PARTICLE_SUFFIX_REGEX, "").trim(),
    };
  }

  if (stripped.endsWith(" خاموش")) {
    return {
      targetState: false,
      segmentName: stripped.slice(0, -6).replace(OBJECT_PARTICLE_SUFFIX_REGEX, "").trim(),
    };
  }

  if (stripped.startsWith("روشن") && TURN_ON_PREFIX_REGEX.test(stripped)) {
    return {
      targetState: true,
      segmentName: stripped.replace(TURN_ON_PREFIX_REGEX, "").trim(),
    };
  }

  if (stripped.startsWith("خاموش") && TURN_OFF_PREFIX_REGEX.test(stripped)) {
    return {
      targetState: false,
      segmentName: stripped.replace(TURN_OFF_PREFIX_REGEX, "").trim(),
    };
  }

  return { targetState: null, segmentName: "" };
}

/**
 * Deep voice command resolution engine:
 * Encapsulates phonetic normalization, Levenshtein distance similarity,
 * macro action unfolding, suffix/prefix matching ("روشن" / "خاموش"), and status notifications.
 */
export function executeVoiceCommand(
  finalTranscript: string,
  context: VoiceCommandExecutionContext,
): void {
  const cleanTranscript = finalTranscript.trim().replace(TRAILING_PUNCT_REGEX, "").trim();

  if (!cleanTranscript) return;

  const normalizedTranscript = normalizePhonetics(cleanTranscript);

  // 1. Try matching configured custom voice commands
  let bestMatchCmd: NonNullable<VoiceCommandExecutionContext["voiceCommands"]>[number] | null =
    null;

  let highestSim = 0;
  const voiceCommands = context.voiceCommands;

  if (voiceCommands) {
    for (let i = 0; i < voiceCommands.length; i++) {
      const command = voiceCommands[i];
      const similarity = getSimilarity(normalizePhonetics(command.phrase), normalizedTranscript);

      if (similarity > highestSim && similarity >= VOICE_SIMILARITY_THRESHOLD) {
        highestSim = similarity;
        bestMatchCmd = command;
      }
    }
  }

  if (bestMatchCmd?.actions?.length) {
    const dedupedActions = new Map<string, boolean>();
    let macroMap: Map<string, NonNullable<VoiceCommandExecutionContext["macros"]>[number]> | null =
      null;

    for (let i = 0; i < bestMatchCmd.actions.length; i++) {
      const action = bestMatchCmd.actions[i];
      const directPin = action.targetPin?.trim();

      if (directPin) {
        dedupedActions.set(directPin, action.actionOn ?? true);
      } else if (action.targetMacro && context.macros?.length) {
        if (!macroMap) {
          macroMap = new Map();
          for (let m = 0; m < context.macros.length; m++) {
            const item = context.macros[m];
            macroMap.set(item.id, item);
          }
        }

        const macro = macroMap.get(action.targetMacro);
        if (macro) {
          for (let j = 0; j < macro.actions.length; j++) {
            const macroAction = macro.actions[j];
            const macroPin = macroAction.targetPin?.trim();
            if (macroPin) {
              dedupedActions.set(macroPin, macroAction.actionOn);
            }
          }
        }
      }
    }

    if (dedupedActions.size > 0) {
      const batchActions = Array.from(dedupedActions, ([targetPin, actionOn]) => ({
        targetPin,
        actionOn,
      }));
      context.handleBatchPinState(batchActions);
      context.showToast(`فرمان صوتی اجرا شد: ${cleanTranscript}`, "success");

      return;
    }
  }

  // 2. Try matching segment suffix/prefix commands ("روشن" or "خاموش")
  const { targetState, segmentName } = extractSegmentIntent(cleanTranscript);

  if (targetState !== null && segmentName) {
    const normalizedSegmentName = normalizePhonetics(segmentName);
    let bestSegment: NonNullable<VoiceCommandExecutionContext["segments"]>[number] | null = null;
    let highestSegmentSimilarity = 0;
    const segments = context.segments;

    if (segments) {
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        if (!segment.pin) continue;
        const similarity = getSimilarity(normalizePhonetics(segment.title), normalizedSegmentName);

        if (similarity > highestSegmentSimilarity && similarity >= VOICE_SIMILARITY_THRESHOLD) {
          highestSegmentSimilarity = similarity;
          bestSegment = segment;
        }
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
