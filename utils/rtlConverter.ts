/**
 * @file utils/rtlConverter.ts
 * @description Core RTL Markdown processor. Transforms standard Markdown into RTL-optimized Markdown.
 */

/**
 * Transforms standard Markdown text into an RTL-aligned Markdown structure.
 * 
 * @param markdown - Raw Markdown string input.
 * @returns Transformed RTL Markdown string.
 */
export function convertToRtlMarkdown(markdown: string): string {
  if (!markdown) return '';

  // Ensure table columns are right-aligned if they lack explicit alignment
  return alignMarkdownTablesRtl(markdown);
}

/**
 * Authoritative pre-compiled regex for Markdown fenced code block boundaries (``` or ~~~).
 * Shared across RTL conversion and title extraction to enforce DRY knowledge representation.
 */
export const CODE_FENCE_REGEX = /^\s*(`{3,}|~{3,})/;

const CLOSING_CODE_FENCE_REGEX = /^\s*(`{3,}|~{3,})\s*$/;
const MATH_BLOCK_REGEX = /^\s*\$\$/;
const TABLE_DIVIDER_REGEX = /^\s*(?:\|(?:\s*:?-+:?\s*\|)+|:?-+:?\s*\|(?:\s*:?-+:?\s*\|?)+)\s*$/;
const ALIGN_REPLACE_REGEX = /:?-+:?/g;

/**
 * Tracks CommonMark/GFM fenced code block state across lines.
 * An opening fence of N backticks or tildes is only closed by a closing fence
 * using the same character with length >= N and no info string.
 *
 * @param {string} line - Current markdown line.
 * @param {string | null} activeFence - Currently open fence marker (e.g. "```" or "````"), or null if outside a code block.
 * @returns {{ toggled: boolean; activeFence: string | null }} Updated fence state and whether this line is a fence delimiter.
 */
export function updateCodeFenceState(
  line: string,
  activeFence: string | null
): { toggled: boolean; activeFence: string | null } {
  if (activeFence === null) {
    const openMatch = CODE_FENCE_REGEX.exec(line);

    if (openMatch) {
      return { toggled: true, activeFence: openMatch[1] };
    }

    return { toggled: false, activeFence: null };
  }

  const closeMatch = CLOSING_CODE_FENCE_REGEX.exec(line);

  if (
    closeMatch &&
    closeMatch[1][0] === activeFence[0] &&
    closeMatch[1].length >= activeFence.length
  ) {
    return { toggled: true, activeFence: null };
  }

  return { toggled: false, activeFence };
}

/**
 * Ensures Markdown tables align text to the right by modifying header separator rows.
 * Fenced code blocks and math blocks are preserved intact without modifying their inner content.
 * 
 * @param {string} md - Raw markdown text.
 * @returns {string} Processed markdown text with RTL-aligned tables.
 */
function alignMarkdownTablesRtl(md: string): string {
  // Quick character guard: skip line splitting if text contains no table delimiters
  if (!md.includes('|') || !md.includes('-')) {
    return md;
  }

  const lines = md.split('\n');
  const lineCount = lines.length;
  let activeFence: string | null = null;
  let inMathBlock = false;
  let hasModified = false;

  for (let i = 0; i < lineCount; i++) {
    const line = lines[i];

    // Check if opening or closing fenced code blocks (``` or ~~~)
    const fenceState = updateCodeFenceState(line, activeFence);
    activeFence = fenceState.activeFence;

    if (fenceState.toggled || activeFence !== null) {
      continue;
    }

    // Check if toggling math block ($$)
    if (MATH_BLOCK_REGEX.test(line) && (line.split('$$').length - 1) % 2 !== 0) {
      inMathBlock = !inMathBlock;
      continue;
    }

    // Never modify lines inside math blocks
    if (inMathBlock) {
      continue;
    }

    // Check if line is a table header divider only when both '|' and '-' are present
    if (line.includes('|') && line.includes('-') && TABLE_DIVIDER_REGEX.test(line)) {
      lines[i] = line.replace(ALIGN_REPLACE_REGEX, '---:'); // Force right-alignment for all columns
      hasModified = true;
    }
  }

  // If no table dividers were altered, return original string directly avoiding rejoining
  return hasModified ? lines.join('\n') : md;
}
