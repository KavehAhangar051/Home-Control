/**
 * @file lib/persianText.ts
 * @description Arabic-script and Persian numeral normalization utilities that preserve
 * Zero-Width Non-Joiner (U+200C) for resilient RTL search and numeric form input.
 */

const PERSIAN_AND_ARABIC_DIGITS_REGEX = /[۰-۹٠-٩]/g;

/**
 * Converts Persian (`۰-۹`) and Eastern Arabic (`٠-٩`) numerals to ASCII `0-9`
 * without stripping other characters or altering ZWNJ (`\u200C`).
 */
export function toAsciiDigits(input: string): string {
  return input.replace(PERSIAN_AND_ARABIC_DIGITS_REGEX, (digit) => {
    const code = digit.charCodeAt(0);

    if (code >= 0x06f0 && code <= 0x06f9) {
      return String(code - 0x06f0);
    }

    if (code >= 0x0660 && code <= 0x0669) {
      return String(code - 0x0660);
    }

    return digit;
  });
}

/**
 * Normalizes text for Persian/Arabic-tolerant substring matching by unifying
 * Arabic Yeh/Kaf (`ي`/`ك`) to Persian (`ی`/`ک`), converting localized digits to
 * ASCII `0-9`, trimming, and lowercasing—while preserving ZWNJ (`\u200C`).
 */
export function normalizePersianSearch(input: string): string {
  return toAsciiDigits(input)
    .replaceAll("\u064a", "\u06cc")
    .replaceAll("\u0643", "\u06a9")
    .trim()
    .toLowerCase();
}
