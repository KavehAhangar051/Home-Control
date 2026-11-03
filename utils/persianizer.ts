/**
 * @file utils/persianizer.ts
 * @description Helper functions for Persian character detection.
 */

/**
 * Fast numeric check if UTF-16 character code is a digit (ASCII 0-9, Arabic ٠-٩, or Persian ۰-۹).
 * Authoritative single source of truth for numeric character detection across the studio.
 *
 * @param {number} code - UTF-16 character code.
 * @returns {boolean} True if character code represents a digit.
 */
export function isDigitCode(code: number): boolean {
  return (
    (code >= 0x0030 && code <= 0x0039) ||
    (code >= 0x0660 && code <= 0x0669) ||
    (code >= 0x06f0 && code <= 0x06f9)
  );
}

/**
 * Fast character code checker for Persian/Arabic Unicode blocks.
 * Operates purely on numeric SMI character codes avoiding string materialization in hot loops.
 *
 * @param {number} code - UTF-16 character code.
 * @returns {boolean} True if character code belongs to Persian/Arabic Unicode blocks (excluding digits).
 */
export function isPersianCharCode(code: number): boolean {
  // Exclude digits (0-9, Arabic digits ٠-٩, Persian digits ۰-۹) so numbers do not get Persian font
  if (isDigitCode(code)) {
    return false;
  }

  return (
    (code >= 0x0600 && code <= 0x06ff) ||
    (code >= 0x0750 && code <= 0x077f) ||
    (code >= 0x08a0 && code <= 0x08ff) ||
    (code >= 0xfb50 && code <= 0xfdff) ||
    (code >= 0xfe70 && code <= 0xfeff) ||
    code === 0x200c ||
    code === 0x200d
  );
}

/**
 * Checks if a character is a Persian/Arabic character.
 * @param char - Single character to test.
 * @returns Boolean indicating whether the character belongs to the Persian/Arabic Unicode blocks.
 */
export function isPersianChar(char: string): boolean {
  if (!char) return false;

  return isPersianCharCode(char.charCodeAt(0));
}

/**
 * Fast check whether a string contains any non-ASCII Persian (۰-۹) or Arabic (٠-٩) digits.
 *
 * @param {string} text - Input string to check.
 * @returns {boolean} True if text contains at least one Persian or Arabic-Indic digit.
 */
export function hasNonAsciiDigit(text: string): boolean {
  if (!text) return false;

  const len = text.length;

  for (let i = 0; i < len; i++) {
    const code = text.charCodeAt(i);

    if ((code >= 0x0660 && code <= 0x0669) || (code >= 0x06f0 && code <= 0x06f9)) {
      return true;
    }
  }

  return false;
}

/**
 * Converts Persian (۰-۹) and Arabic-Indic (٠-٩) digits in a string to ASCII digits (0-9)
 * so that Latin monospace fonts like Kode Mono can render their native numeric glyphs
 * instead of falling back to system monospace fonts.
 *
 * @param {string} text - Input string potentially containing Persian/Arabic digits.
 * @returns {string} String with all digits normalized to ASCII 0-9.
 */
export function normalizeDigitsToAscii(text: string): string {
  if (!hasNonAsciiDigit(text)) {
    return text;
  }

  const len = text.length;
  let out = '';

  for (let i = 0; i < len; i++) {
    const code = text.charCodeAt(i);

    if (code >= 0x06f0 && code <= 0x06f9) {
      out += String.fromCharCode(code - 0x06f0 + 0x0030);
    } else if (code >= 0x0660 && code <= 0x0669) {
      out += String.fromCharCode(code - 0x0660 + 0x0030);
    } else {
      out += text[i];
    }
  }

  return out;
}

/**
 * Checks if a string contains any Persian/Arabic characters using the authoritative charCode rule.
 * @param text - Input string to check.
 * @returns True if text contains any non-digit Persian/Arabic glyphs.
 */
export function hasPersianText(text: string): boolean {
  if (!text) return false;

  const len = text.length;

  for (let i = 0; i < len; i++) {
    if (isPersianCharCode(text.charCodeAt(i))) {
      return true;
    }
  }

  return false;
}


