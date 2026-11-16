import { type DashboardFontId, getDashboardFontFamilyCss } from "@/lib/fonts";

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

function toHexByte(n: number): string {
  const clamped = Math.min(255, Math.max(0, n)) | 0;

  return clamped < 16 ? `0${clamped.toString(16)}` : clamped.toString(16);
}

function computeDarkPalette(blackness = 70) {
  const clamped = Math.max(0, Math.min(100, blackness));
  const t = (100 - clamped) / 100;
  // At default blackness=70 (t=0.3): deepest=#0f0f10 (15), bg=#141415 (20), card=#19191b (25), raised=#232325 (35), hairline=#27272a (39)
  const bgVal = Math.round(8 + t * 40);
  const deepestVal = Math.max(6, bgVal - 5);
  const cardVal = bgVal + 5;
  const hoverVal = bgVal + 15;
  const borderVal = bgVal + 19;

  const deepestHex = `#${toHexByte(deepestVal)}${toHexByte(deepestVal)}${toHexByte(deepestVal + 1)}`;
  const bgHex = `#${toHexByte(bgVal)}${toHexByte(bgVal)}${toHexByte(bgVal + 1)}`;
  const cardSolidHex = `#${toHexByte(cardVal)}${toHexByte(cardVal)}${toHexByte(cardVal + 2)}`;
  const hoverHex = `#${toHexByte(hoverVal)}${toHexByte(hoverVal)}${toHexByte(hoverVal + 2)}`;
  const borderHex = `#${toHexByte(borderVal)}${toHexByte(borderVal)}${toHexByte(borderVal + 3)}`;

  return {
    deepest: deepestHex,
    bg: bgHex,
    card: cardSolidHex,
    cardSolid: cardSolidHex,
    cardHover: hoverHex,
    border: borderHex,
  };
}

function computeLightPalette(whiteness = 70) {
  const clamped = Math.max(0, Math.min(100, whiteness));
  const t = clamped / 100;
  // Graphite light ramp: bg=#fafafa, card=#ffffff, raised=#f4f4f5, hairline=#e4e4e7
  const r = Math.round(234 + t * 21);
  const g = Math.round(234 + t * 21);
  const b = Math.round(236 + t * 19);

  const cardVal = Math.min(255, Math.round(250 + t * 5));
  const hoverR = Math.max(224, r - 6);
  const hoverG = Math.max(224, g - 6);
  const hoverB = Math.max(226, b - 5);

  const borderR = Math.max(206, r - 22);
  const borderG = Math.max(206, g - 22);
  const borderB = Math.max(210, b - 21);

  const cardByte = toHexByte(cardVal);
  const bgHex = `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
  const cardHex = `#${cardByte}${cardByte}${cardByte}`;
  const hoverHex = `#${toHexByte(hoverR)}${toHexByte(hoverG)}${toHexByte(hoverB)}`;
  const borderHex = `#${toHexByte(borderR)}${toHexByte(borderG)}${toHexByte(borderB)}`;

  return {
    deepest: bgHex,
    bg: bgHex,
    card: cardHex,
    cardSolid: cardHex,
    cardHover: hoverHex,
    border: borderHex,
  };
}

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

export function getThemeStyles({
  accent3,
  accent4,
  isDark,
  darkBlackness = 70,
  lightWhiteness = 70,
  selectedFont,
}: ThemeStylesParams): string {
  const selectedFontFamily = getDashboardFontFamilyCss(selectedFont);

  const palette = isDark ? computeDarkPalette(darkBlackness) : computeLightPalette(lightWhiteness);

  const isDefaultAccent3 =
    accent3.toUpperCase() === "#E5E7EB" || accent3.toUpperCase() === "#EDEDED";
  const resolvedAccent3 = !isDark && isDefaultAccent3 ? "#171717" : accent3;
  const opaqueAccent3 = toSixDigitHex(resolvedAccent3, isDark ? "#ededed" : "#171717");
  const opaqueAccent4 = toSixDigitHex(accent4, "#3b82f6");
  const resolvedAccent3Dark = isDark ? "#d4d4d8" : "#262626";
  const resolvedAccent3Foreground = isDark ? "#0f0f10" : "#ffffff";

  return `
    :root {
      /* Selected Font Custom Configuration */
      --font-vazir: var(--font-dana), sans-serif;
      
      --selected-font: ${selectedFontFamily};
      
      --accent3: ${resolvedAccent3};
      --accent3-dark: ${resolvedAccent3Dark};
      --accent3-foreground: ${resolvedAccent3Foreground};
      --accent4: ${accent4};
      --accent3-transparent: ${isDark || !isDefaultAccent3 ? `${opaqueAccent3}14` : "rgba(23, 23, 23, 0.06)"};
      --accent4-transparent: ${opaqueAccent4}16;
      --accent3-medium: ${isDark || !isDefaultAccent3 ? `${opaqueAccent3}2e` : "rgba(23, 23, 23, 0.16)"};
      --accent4-medium: ${opaqueAccent4}33;
      --accent3-heavy: ${isDark || !isDefaultAccent3 ? `${opaqueAccent3}88` : "rgba(23, 23, 23, 0.55)"};
      --accent4-heavy: ${opaqueAccent4}88;

      /* Graphite Neutral Ramp Surfaces & 3 Text Roles */
      --bg-main: ${palette.bg};
      --bg-primary: ${palette.bg};
      --bg-gradient-from: ${palette.bg};
      --bg-gradient-via: ${palette.bg};
      --bg-gradient-to: ${palette.bg};
      --card-bg: ${palette.card};
      --card-bg-solid: ${palette.cardSolid};
      --card-hover-bg: ${palette.cardHover};
      --text-primary: ${isDark ? "#ededed" : "#171717"};
      --text-secondary: ${isDark ? "#a1a1a6" : "#525252"};
      --text-tertiary: ${isDark ? "#a1a1a6" : "#525252"};
      --text-muted: ${isDark ? "#85858b" : "#737373"};
      --border-color: ${palette.border};
      --drawer-gradient-from: ${palette.bg};
      --drawer-gradient-to: ${palette.bg};

      /* Deepest surface for sidebar rail, hairline border at 8% opacity */
      --sidebar-bg: ${palette.deepest};
      --sidebar-border: ${palette.border};
      --sidebar-text: ${isDark ? "#ededed" : "#171717"};
      --sidebar-muted: ${isDark ? "#85858b" : "#737373"};
      --sidebar-hover: ${palette.cardHover};
      --sidebar-active: ${palette.cardHover};
      --sidebar-control-bg: ${palette.cardSolid};
      --sidebar: ${palette.deepest};
      --sidebar-foreground: ${isDark ? "#ededed" : "#171717"};
      --sidebar-primary: ${isDark ? "#ededed" : "#171717"};
      --sidebar-primary-foreground: ${palette.bg};
      --sidebar-accent: ${palette.cardHover};
      --sidebar-accent-foreground: ${isDark ? "#ededed" : "#171717"};
      --sidebar-ring: ${isDark ? "#85858b" : "#737373"};

      /* ReUI / shadcn semantic tokens toned to sit inside the neutral ramp */
      --background: ${palette.bg};
      --foreground: ${isDark ? "#ededed" : "#171717"};
      --card: ${palette.cardSolid};
      --card-foreground: ${isDark ? "#ededed" : "#171717"};
      --popover: ${palette.cardSolid};
      --popover-foreground: ${isDark ? "#ededed" : "#171717"};
      --primary: ${isDark ? "#ededed" : "#171717"};
      --primary-foreground: ${palette.bg};
      --secondary: ${palette.cardHover};
      --secondary-foreground: ${isDark ? "#ededed" : "#171717"};
      --muted: ${palette.cardHover};
      --muted-foreground: ${isDark ? "#85858b" : "#737373"};
      --accent: ${palette.cardHover};
      --accent-foreground: ${isDark ? "#ededed" : "#171717"};
      --destructive: ${isDark ? "#e5484d" : "#dc2626"};
      --destructive-foreground: ${isDark ? "#ededed" : "#ffffff"};
      --border: ${palette.border};
      --input: ${palette.border};
      --ring: ${isDark ? "#85858b" : "#737373"};
      --ring-offset: ${palette.bg};
      --radius: 0.5rem;
      --success: ${isDark ? "#4cc38a" : "#16a34a"};
      --success-foreground: ${isDark ? "#0f0f10" : "#ffffff"};
      --warning: var(--color-amber-500);
      --warning-foreground: var(--color-amber-950);
      --info: var(--color-sky-500);
      --info-foreground: ${isDark ? "#ededed" : "var(--color-sky-950)"};
      --invert: ${isDark ? "var(--color-zinc-700)" : "var(--color-neutral-900)"};
      --invert-foreground: var(--color-neutral-50);
      --shadow-border: ${
        isDark
          ? "0 0 0 1px oklch(1 0 0 / 0.08)"
          : "0px 0px 0px 1px oklch(0 0 0 / 0.06), 0px 1px 2px -1px oklch(0 0 0 / 0.05)"
      };
      --shadow-border-hover: ${
        isDark
          ? "0 0 0 1px oklch(1 0 0 / 0.13)"
          : "0px 0px 0px 1px oklch(0 0 0 / 0.08), 0px 1px 2px -1px oklch(0 0 0 / 0.06)"
      };
    }

    img {
      outline: 1px solid ${isDark ? "oklch(1 0 0 / 0.1)" : "oklch(0 0 0 / 0.1)"};
      outline-offset: -1px;
    }
    
    html, body, button:not([data-font-preview]), h1:not([data-font-preview]), h2:not([data-font-preview]), h3:not([data-font-preview]), h4:not([data-font-preview]), h5:not([data-font-preview]), h6:not([data-font-preview]), select, span:not([data-font-preview]), input, textarea, .font-sans:not([data-font-preview]) {
      font-family: var(--selected-font) !important;
    }
    
  `;
}
