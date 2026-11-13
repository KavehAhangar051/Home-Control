import { type DashboardFontId, getDashboardFontFamilyCss } from "@/lib/fonts";

interface ThemeStylesParams {
  accent3: string;
  accent4: string;
  isDark: boolean;
  darkBlackness?: number;
  lightWhiteness?: number;
  selectedFont?: DashboardFontId;
}

function computeDarkPalette(blackness = 70) {
  const clamped = Math.max(0, Math.min(100, blackness));
  const t = (100 - clamped) / 100;
  const bgVal = Math.round(t * 24);
  const cardVal = Math.round(bgVal + 3);
  const hoverVal = Math.round(bgVal + 15);
  const borderVal = Math.round(bgVal + 28);

  const hex = (n: number) => Math.min(255, Math.max(0, n)).toString(16).padStart(2, "0");
  const bgHex = `#${hex(bgVal)}${hex(bgVal)}${hex(bgVal + 2)}`;
  const cardSolidHex = `#${hex(cardVal)}${hex(cardVal)}${hex(cardVal + 2)}`;
  const hoverHex = `#${hex(hoverVal)}${hex(hoverVal)}${hex(hoverVal + 3)}`;
  const borderHex = `#${hex(borderVal)}${hex(borderVal)}${hex(borderVal + 3)}`;

  return {
    bg: bgHex,
    card: `rgba(${cardVal}, ${cardVal}, ${cardVal + 2}, 0.92)`,
    cardSolid: cardSolidHex,
    cardHover: hoverHex,
    border: borderHex,
  };
}

function computeLightPalette(whiteness = 70) {
  const clamped = Math.max(0, Math.min(100, whiteness));
  const t = clamped / 100;
  // Neutral cool-gray scale (inspired by zinc-50 -> zinc-200):
  // At whiteness 100% -> #ffffff (pure white)
  // At whiteness 70% -> #fafafa (default crisp clean light)
  // At whiteness 0% -> #e2e4e8 (neutral cool gray, completely free of warm/pink/peach tones)
  const r = Math.round(226 + t * 29);
  const g = Math.round(228 + t * 27);
  const b = Math.round(232 + t * 23);

  const cardVal = Math.min(255, Math.round(248 + t * 7));
  const hoverR = Math.max(215, r - 6);
  const hoverG = Math.max(217, g - 6);
  const hoverB = Math.max(221, b - 6);

  const borderR = Math.max(198, r - 22);
  const borderG = Math.max(200, g - 22);
  const borderB = Math.max(204, b - 22);

  const hex = (n: number) => Math.min(255, Math.max(0, n)).toString(16).padStart(2, "0");
  const bgHex = `#${hex(r)}${hex(g)}${hex(b)}`;
  const cardHex = `#${hex(cardVal)}${hex(cardVal)}${hex(cardVal)}`;
  const hoverHex = `#${hex(hoverR)}${hex(hoverG)}${hex(hoverB)}`;
  const borderHex = `#${hex(borderR)}${hex(borderG)}${hex(borderB)}`;

  return {
    bg: bgHex,
    card: cardHex,
    cardSolid: cardHex,
    cardHover: hoverHex,
    border: borderHex,
  };
}

function toSixDigitHex(color: string, fallback: string): string {
  const trimmed = color.trim();
  const sixOrEight = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(trimmed);

  if (sixOrEight) return `#${sixOrEight[1]}`;

  const threeOrFour = /^#([0-9a-f]{3})([0-9a-f])?$/i.exec(trimmed);

  if (threeOrFour) {
    const [r, g, b] = threeOrFour[1].split("");

    return `#${r}${r}${g}${g}${b}${b}`;
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

  const isDefaultAccent3 = accent3.toUpperCase() === "#E5E7EB";
  const resolvedAccent3 = !isDark && isDefaultAccent3 ? "#171717" : accent3;
  const opaqueAccent3 = toSixDigitHex(resolvedAccent3, isDark ? "#e5e7eb" : "#171717");
  const opaqueAccent4 = toSixDigitHex(accent4, "#3b82f6");
  const resolvedAccent3Dark = isDark ? "#d4d4d8" : "#262626";
  const resolvedAccent3Foreground = isDark ? "#09090b" : "#ffffff";

  return `
    :root {
      /* Selected Font Custom Configuration */
      --font-vazir: var(--font-dana), sans-serif;
      
      --selected-font: ${selectedFontFamily};
      
      --accent3: ${resolvedAccent3};
      --accent3-dark: ${resolvedAccent3Dark};
      --accent3-foreground: ${resolvedAccent3Foreground};
      --accent4: ${accent4};
      --accent3-transparent: ${isDark || !isDefaultAccent3 ? `${opaqueAccent3}18` : "rgba(23, 23, 23, 0.07)"};
      --accent4-transparent: ${opaqueAccent4}18;
      --accent3-medium: ${isDark || !isDefaultAccent3 ? `${opaqueAccent3}44` : "rgba(23, 23, 23, 0.22)"};
      --accent4-medium: ${opaqueAccent4}44;
      --accent3-heavy: ${isDark || !isDefaultAccent3 ? `${opaqueAccent3}99` : "rgba(23, 23, 23, 0.6)"};
      --accent4-heavy: ${opaqueAccent4}99;

      /* Dynamic Theme Solvers */
      --bg-main: ${palette.bg};
      --bg-primary: ${palette.bg};
      --bg-gradient-from: ${palette.bg};
      --bg-gradient-via: ${palette.bg};
      --bg-gradient-to: ${palette.bg};
      --card-bg: ${palette.card};
      --card-bg-solid: ${palette.cardSolid};
      --card-hover-bg: ${palette.cardHover};
      --text-primary: ${isDark ? "#fafafa" : "#171717"};
      --text-secondary: ${isDark ? "#e4e4e7" : "#262626"};
      --text-tertiary: ${isDark ? "#a1a1aa" : "#525252"};
      --text-muted: ${isDark ? "#a1a1aa" : "#737373"};
      --border-color: ${palette.border};
      --drawer-gradient-from: ${palette.bg};
      --drawer-gradient-to: ${palette.bg};

      /* ReUI-inspired sidebar surfaces: pure neutral scale, restrained borders. */
      --sidebar-bg: ${palette.cardSolid};
      --sidebar-border: ${palette.border};
      --sidebar-text: ${isDark ? "#fafafa" : "#171717"};
      --sidebar-muted: ${isDark ? "#a1a1aa" : "#525252"};
      --sidebar-hover: ${palette.cardHover};
      --sidebar-active: ${isDark ? "#3f3f46" : "#e5e5e5"};
      --sidebar-control-bg: ${palette.bg};
      --sidebar: ${palette.cardSolid};
      --sidebar-foreground: ${isDark ? "#fafafa" : "#171717"};
      --sidebar-primary: ${isDark ? "#fafafa" : "#171717"};
      --sidebar-primary-foreground: ${palette.bg};
      --sidebar-accent: ${palette.cardHover};
      --sidebar-accent-foreground: ${isDark ? "#fafafa" : "#171717"};
      --sidebar-ring: ${isDark ? "#a1a1aa" : "#737373"};

      /* ReUI / shadcn semantic tokens for components installed from the registry. */
      --background: ${palette.bg};
      --foreground: ${isDark ? "#fafafa" : "#171717"};
      --card: ${palette.cardSolid};
      --card-foreground: ${isDark ? "#fafafa" : "#171717"};
      --popover: ${palette.cardSolid};
      --popover-foreground: ${isDark ? "#fafafa" : "#171717"};
      --primary: ${isDark ? "#fafafa" : "#171717"};
      --primary-foreground: ${palette.bg};
      --secondary: ${palette.cardHover};
      --secondary-foreground: ${isDark ? "#fafafa" : "#262626"};
      --muted: ${palette.cardHover};
      --muted-foreground: ${isDark ? "#a1a1aa" : "#737373"};
      --accent: ${palette.cardHover};
      --accent-foreground: ${isDark ? "#fafafa" : "#171717"};
      --destructive: var(--color-red-600);
      --destructive-foreground: ${isDark ? "var(--color-zinc-50)" : "var(--color-white)"};
      --border: ${palette.border};
      --input: ${palette.border};
      --ring: ${isDark ? "#a1a1aa" : "#737373"};
      --radius: 0.5rem;
      --success: var(--color-emerald-500);
      --success-foreground: ${isDark ? "var(--color-zinc-50)" : "var(--color-emerald-950)"};
      --warning: var(--color-yellow-500);
      --warning-foreground: var(--color-yellow-950);
      --info: var(--color-sky-500);
      --info-foreground: ${isDark ? "var(--color-zinc-50)" : "var(--color-sky-950)"};
      --invert: ${isDark ? "var(--color-zinc-700)" : "var(--color-neutral-900)"};
      --invert-foreground: var(--color-neutral-50);
      --shadow-border: ${
        isDark
          ? "0 0 0 1px oklch(1 0 0 / 0.08)"
          : "0px 0px 0px 1px oklch(0 0 0 / 0.06), 0px 1px 2px -1px oklch(0 0 0 / 0.06), 0px 2px 4px 0px oklch(0 0 0 / 0.04)"
      };
      --shadow-border-hover: ${
        isDark
          ? "0 0 0 1px oklch(1 0 0 / 0.13)"
          : "0px 0px 0px 1px oklch(0 0 0 / 0.08), 0px 1px 2px -1px oklch(0 0 0 / 0.08), 0px 2px 4px 0px oklch(0 0 0 / 0.06)"
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
