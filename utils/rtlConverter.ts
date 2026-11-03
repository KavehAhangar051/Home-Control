/**
 * @file utils/rtlConverter.ts
 * @description Core RTL Markdown processor. Transforms standard Markdown into RTL-optimized Markdown.
 */

/**
 * Transforms standard Markdown text into an RTL-aligned Markdown structure
 * and normalizes ChatGPT/Claude/Gemini math delimiters (`$$...$$`, `\[...\]`, `\(...\)`)
 * outside code blocks so `remark-math` renders both display and inline math accurately.
 *
 * @param {string} markdown - Raw Markdown string input.
 * @returns {string} Transformed RTL Markdown string.
 */
export function convertToRtlMarkdown(markdown: string): string {
  if (!markdown) return '';

  return transformMarkdownOutsideCodeFences(markdown);
}

/**
 * Authoritative pre-compiled regex for Markdown fenced code block boundaries (``` or ~~~).
 * Shared across RTL conversion and title extraction to enforce DRY knowledge representation.
 */
export const CODE_FENCE_REGEX = /^\s*(`{3,}|~{3,})/;

const CLOSING_CODE_FENCE_REGEX = /^\s*(`{3,}|~{3,})\s*$/;
const MATH_BLOCK_REGEX = /^\s*\$\$/;
const SINGLE_LINE_DISPLAY_MATH_REGEX = /^(\s*(?:>\s*)*)\$\$\s*(.+?)\s*\$\$\s*$/;
const SINGLE_LINE_BRACKET_MATH_REGEX = /^(\s*(?:>\s*)*)\\\[\s*(.+?)\s*\\\]\s*$/;
const OPEN_BRACKET_MATH_REGEX = /^(\s*(?:>\s*)*)\\\[\s*$/;
const CLOSE_BRACKET_MATH_REGEX = /^(\s*(?:>\s*)*)\\\]\s*$/;
const INLINE_PAREN_MATH_REGEX = /(`+[^`]*`+)|\\\((.+?)\\\)/g;
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
 * Single-pass line scanner that:
 * 1. Aligns GFM table separator rows to RTL (`---:`).
 * 2. Expands standalone single-line `$$ formula $$` and `\[ formula \]` into multi-line
 *    `$$\nformula\n$$` so `remark-math` v6 renders them as true `.katex-display` blocks.
 * 3. Converts ChatGPT/Claude `\[ ... \]` and `\( ... \)` delimiters into standard `$` / `$$`
 *    while leaving fenced code blocks and inline code spans untouched.
 *
 * @param {string} md - Raw markdown text.
 * @returns {string} Processed markdown text.
 */
function transformMarkdownOutsideCodeFences(md: string): string {
  const hasTableCandidate = md.includes('|') && md.includes('-');
  const hasMathCandidate = md.includes('$$') || md.includes('\\[') || md.includes('\\(');

  if (!hasTableCandidate && !hasMathCandidate) {
    return md;
  }

  const lines = md.split('\n');
  const lineCount = lines.length;
  let activeFence: string | null = null;
  let inMathBlock = false;
  let hasModified = false;

  for (let i = 0; i < lineCount; i++) {
    let line = lines[i];

    // 1. Preserve fenced code blocks (``` or ~~~) intact
    const fenceState = updateCodeFenceState(line, activeFence);
    activeFence = fenceState.activeFence;

    if (fenceState.toggled || activeFence !== null) {
      continue;
    }

    // 2. Expand standalone single-line `$$ formula $$` into multi-line `$$\nformula\n$$`
    if (!inMathBlock && line.includes('$$')) {
      const singleDollarMatch = SINGLE_LINE_DISPLAY_MATH_REGEX.exec(line);

      if (singleDollarMatch) {
        const prefix = singleDollarMatch[1];
        const formula = singleDollarMatch[2];
        lines[i] = `${prefix}$$\n${prefix}${formula}\n${prefix}$$`;
        hasModified = true;
        continue;
      }
    }

    // 3. Expand standalone single-line `\[ formula \]` (ChatGPT/Claude style)
    if (!inMathBlock && line.includes('\\[')) {
      const singleBracketMatch = SINGLE_LINE_BRACKET_MATH_REGEX.exec(line);

      if (singleBracketMatch) {
        const prefix = singleBracketMatch[1];
        const formula = singleBracketMatch[2];
        lines[i] = `${prefix}$$\n${prefix}${formula}\n${prefix}$$`;
        hasModified = true;
        continue;
      }

      if (OPEN_BRACKET_MATH_REGEX.test(line)) {
        lines[i] = line.replace('\\[', '$$');
        inMathBlock = true;
        hasModified = true;
        continue;
      }
    }

    if (inMathBlock && line.includes('\\]') && CLOSE_BRACKET_MATH_REGEX.test(line)) {
      lines[i] = line.replace('\\]', '$$');
      inMathBlock = false;
      hasModified = true;
      continue;
    }

    // 4. Track multi-line `$$` blocks
    if (MATH_BLOCK_REGEX.test(line) && (line.split('$$').length - 1) % 2 !== 0) {
      inMathBlock = !inMathBlock;
      continue;
    }

    if (inMathBlock) {
      continue;
    }

    // 5. Convert inline `\( ... \)` to `$...$` outside inline backtick spans
    if (line.includes('\\(') && line.includes('\\)')) {
      const replaced = line.replace(
        INLINE_PAREN_MATH_REGEX,
        (match, codeSpan: string | undefined, formula: string | undefined) => {
          if (codeSpan !== undefined) return codeSpan;
          return `$${(formula ?? '').trim()}$`;
        }
      );

      if (replaced !== line) {
        line = replaced;
        lines[i] = line;
        hasModified = true;
      }
    }

    // 6. Force right-alignment on GFM table divider rows
    if (hasTableCandidate && line.includes('|') && line.includes('-') && TABLE_DIVIDER_REGEX.test(line)) {
      lines[i] = line.replace(ALIGN_REPLACE_REGEX, '---:');
      hasModified = true;
    }
  }

  return hasModified ? lines.join('\n') : md;
}
