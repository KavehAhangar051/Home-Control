import { type DashboardFontId, getDashboardFontFamilyCss } from "@/lib/fonts";
import {
  byteToHex,
  lookupDarkPalette,
  lookupLightPalette,
  lookupRelativeLuminance,
} from "@/lib/gpuLut";

interface ThemeStylesParams {
  accent3: string;
  accent4: string;
  isDark: boolean;
  darkBlackness?: number;
  lightWhiteness?: number;
  selectedFont?: DashboardFontId;
}

const HEX_6_OR_8_REGEX = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i;
const HEX_3_OR_4_REGEX = /^#([0-9a-f]{3})([0-9a-f])?$/i;

function toSixDigitHex(color: string, fallback: string): string {
  const trimmed = color.trim();

  if (trimmed.charCodeAt(0) !== 35) return fallback;

  const sixOrEight = HEX_6_OR_8_REGEX.exec(trimmed);

  if (sixOrEight) return `#${sixOrEight[1]}`;

  const threeOrFour = HEX_3_OR_4_REGEX.exec(trimmed);

  if (threeOrFour) {
    const h = threeOrFour[1];

    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  }

  return fallback;
}

function parseTwoHexDigits(str: string, offset: number): number {
  const c0 = str.charCodeAt(offset);
  const c1 = str.charCodeAt(offset + 1);
  const d0 = c0 <= 57 ? c0 - 48 : (c0 | 32) - 87;
  const d1 = c1 <= 57 ? c1 - 48 : (c1 | 32) - 87;

  return (d0 << 4) | d1;
}

/**
 * Picks `#0f0f10` or `#ffffff` against a 6-digit hex background using the precomputed
 * WCAG 2.1 sRGB-to-linear LUT (`SRGB_TO_LINEAR_LUT`) with zero runtime `Math.pow`.
 */
function getContrastingForeground(hexColor: string, fallback: string): string {
  const match = HEX_6_OR_8_REGEX.exec(hexColor.trim());

  if (!match) return fallback;

  const hex = match[1];
  const r = parseTwoHexDigits(hex, 0);
  const g = parseTwoHexDigits(hex, 2);
  const b = parseTwoHexDigits(hex, 4);
  const luminance = lookupRelativeLuminance(r, g, b);

  return luminance > 0.36 ? "#0f0f10" : "#ffffff";
}

function computeAccentHoverHex(
  opaqueHex: string,
  isDefaultAccent3: boolean,
  isDark: boolean,
  foregroundHex: string,
): string {
  if (isDefaultAccent3) {
    return isDark ? "#d4d4d8" : "#262626";
  }

  const match = HEX_6_OR_8_REGEX.exec(opaqueHex.trim());

  if (!match) return isDark ? "#d4d4d8" : "#262626";

  const hex = match[1];
  const r = parseTwoHexDigits(hex, 0);
  const g = parseTwoHexDigits(hex, 2);
  const b = parseTwoHexDigits(hex, 4);

  // Darken bright accents slightly (keeps #0f0f10 text crisp); lift very dark accents toward white.
  if (foregroundHex === "#0f0f10") {
    return `#${byteToHex(r * 0.88)}${byteToHex(g * 0.88)}${byteToHex(b * 0.88)}`;
  }

  const maxChannel = Math.max(r, g, b);

  if (maxChannel < 64) {
    return `#${byteToHex(r + (255 - r) * 0.14)}${byteToHex(g + (255 - g) * 0.14)}${byteToHex(b + (255 - b) * 0.14)}`;
  }

  return `#${byteToHex(r * 0.84)}${byteToHex(g * 0.84)}${byteToHex(b * 0.84)}`;
}

/**
 * Computes all `:root` CSS custom properties for the active theme palette, accents, and font.
 * Returned as a flat key/value map so `DashboardStyles` can diff and apply only changed
 * properties via `document.documentElement.style.setProperty` inside a single `rAF` frame.
 */
export function computeThemeCssVariables({
  accent3,
  accent4,
  isDark,
  darkBlackness = 70,
  lightWhiteness = 70,
  selectedFont,
}: ThemeStylesParams): Record<string, string> {
  const selectedFontFamily = getDashboardFontFamilyCss(selectedFont);
  const palette = isDark ? lookupDarkPalette(darkBlackness) : lookupLightPalette(lightWhiteness);

  const isDefaultAccent3 =
    accent3.toUpperCase() === "#E5E7EB" || accent3.toUpperCase() === "#EDEDED";

  const resolvedAccent3 = !isDark && isDefaultAccent3 ? "#171717" : accent3;
  const opaqueAccent3 = toSixDigitHex(resolvedAccent3, isDark ? "#ededed" : "#171717");
  const opaqueAccent4 = toSixDigitHex(accent4, "#3b82f6");
  const resolvedAccent3Foreground = getContrastingForeground(
    opaqueAccent3,
    isDark ? "#0f0f10" : "#ffffff",
  );
  const resolvedAccent3Dark = computeAccentHoverHex(
    opaqueAccent3,
    isDefaultAccent3,
    isDark,
    resolvedAccent3Foreground,
  );
  const resolvedAccent4Foreground = getContrastingForeground(opaqueAccent4, "#ffffff");
  const mutedTextColor = isDark ? "#96969d" : "#636369";

  return {
    "--font-vazir": "var(--font-dana), sans-serif",
    "--selected-font": selectedFontFamily,
    "--accent3": resolvedAccent3,
    "--accent3-dark": resolvedAccent3Dark,
    "--accent3-foreground": resolvedAccent3Foreground,
    "--accent4": accent4,
    "--accent4-foreground": resolvedAccent4Foreground,
    "--accent3-transparent":
      isDark || !isDefaultAccent3 ? `${opaqueAccent3}14` : "rgba(23, 23, 23, 0.06)",
    "--accent4-transparent": `${opaqueAccent4}16`,
    "--accent3-medium":
      isDark || !isDefaultAccent3 ? `${opaqueAccent3}2e` : "rgba(23, 23, 23, 0.16)",
    "--accent4-medium": `${opaqueAccent4}33`,
    "--accent3-heavy":
      isDark || !isDefaultAccent3 ? `${opaqueAccent3}88` : "rgba(23, 23, 23, 0.55)",
    "--accent4-heavy": `${opaqueAccent4}88`,
    "--bg-main": palette.bg,
    "--bg-primary": palette.bg,
    "--bg-gradient-from": palette.bg,
    "--bg-gradient-via": palette.bg,
    "--bg-gradient-to": palette.bg,
    "--card-bg": palette.card,
    "--card-bg-solid": palette.cardSolid,
    "--card-hover-bg": palette.cardHover,
    "--text-primary": isDark ? "#ededed" : "#171717",
    "--text-secondary": isDark ? "#a1a1a6" : "#525252",
    "--text-tertiary": isDark ? "#a1a1a6" : "#525252",
    "--text-muted": mutedTextColor,
    "--border-color": palette.border,
    "--drawer-gradient-from": palette.bg,
    "--drawer-gradient-to": palette.bg,
    "--sidebar-bg": palette.deepest,
    "--sidebar-border": palette.border,
    "--sidebar-text": isDark ? "#ededed" : "#171717",
    "--sidebar-muted": mutedTextColor,
    "--sidebar-hover": palette.cardHover,
    "--sidebar-active": palette.cardHover,
    "--sidebar-control-bg": palette.cardSolid,
    "--sidebar": palette.deepest,
    "--sidebar-foreground": isDark ? "#ededed" : "#171717",
    "--sidebar-primary": resolvedAccent3,
    "--sidebar-primary-foreground": resolvedAccent3Foreground,
    "--sidebar-accent": palette.cardHover,
    "--sidebar-accent-foreground": isDark ? "#ededed" : "#171717",
    "--sidebar-ring": mutedTextColor,
    "--background": palette.bg,
    "--foreground": isDark ? "#ededed" : "#171717",
    "--card": palette.cardSolid,
    "--card-foreground": isDark ? "#ededed" : "#171717",
    "--popover": palette.cardSolid,
    "--popover-foreground": isDark ? "#ededed" : "#171717",
    "--primary": resolvedAccent3,
    "--primary-foreground": resolvedAccent3Foreground,
    "--secondary": palette.cardHover,
    "--secondary-foreground": isDark ? "#ededed" : "#171717",
    "--muted": palette.cardHover,
    "--muted-foreground": mutedTextColor,
    "--accent": palette.cardHover,
    "--accent-foreground": isDark ? "#ededed" : "#171717",
    "--destructive": isDark ? "oklch(62.8% 0.225 25.3)" : "oklch(57.7% 0.245 27.3)",
    "--destructive-foreground": isDark ? "#ededed" : "#ffffff",
    "--border": palette.border,
    "--input": palette.border,
    "--ring": mutedTextColor,
    "--ring-offset": palette.bg,
    "--radius": "0.5rem",
    "--success": isDark ? "oklch(72.3% 0.16 160)" : "oklch(62.7% 0.194 149.2)",
    "--success-foreground": isDark ? "#0f0f10" : "#ffffff",
    "--warning": "oklch(79.5% 0.184 86.05)",
    "--warning-foreground": "oklch(24% 0.05 86)",
    "--info": "oklch(68.5% 0.169 237.32)",
    "--info-foreground": isDark ? "#0f0f10" : "oklch(29% 0.06 243)",
    "--invert": isDark ? "oklch(35% 0.01 264)" : "oklch(20.5% 0.01 264)",
    "--invert-foreground": "oklch(98.5% 0 0)",
    "--shadow-border": isDark
      ? "0 0 0 1px oklch(1 0 0 / 0.08)"
      : "0px 0px 0px 1px oklch(0 0 0 / 0.06), 0px 1px 2px -1px oklch(0 0 0 / 0.05)",
    "--shadow-border-hover": isDark
      ? "0 0 0 1px oklch(1 0 0 / 0.13)"
      : "0px 0px 0px 1px oklch(0 0 0 / 0.08), 0px 1px 2px -1px oklch(0 0 0 / 0.06)",
  };
}

/**
 * Returns only the structural CSS rules that depend on dark/light polarity (not dynamic sliders).
 */
export function getStaticThemeRules(isDark: boolean): string {
  return `
    img {
      outline: 1px solid ${isDark ? "oklch(1 0 0 / 0.1)" : "oklch(0 0 0 / 0.1)"};
      outline-offset: -1px;
    }

    html, body, button:not([data-font-preview]):not(.font-mono), h1:not([data-font-preview]):not(.font-mono), h2:not([data-font-preview]):not(.font-mono), h3:not([data-font-preview]):not(.font-mono), h4:not([data-font-preview]):not(.font-mono), h5:not([data-font-preview]):not(.font-mono), h6:not([data-font-preview]):not(.font-mono), select:not(.font-mono), span:not([data-font-preview]):not(.font-mono), input:not(.font-mono), textarea:not(.font-mono), .font-sans:not([data-font-preview]):not(.font-mono) {
      font-family: var(--selected-font) !important;
    }
  `;
}

export function getThemeStyles(params: ThemeStylesParams): string {
  const vars = computeThemeCssVariables(params);
  const declarations = Object.entries(vars)
    .map(([key, value]) => `      ${key}: ${value};`)
    .join("\n");

  return `
    :root {
${declarations}
    }
${getStaticThemeRules(params.isDark)}
  `;
}
