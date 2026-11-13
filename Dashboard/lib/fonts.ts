export type DashboardFontId =
  | "dana"
  | "vazirmatn"
  | "ibm-plex"
  | "noto-sans"
  | "rubik"
  | "readex-pro";

export const DEFAULT_DASHBOARD_FONT: DashboardFontId = "dana";

export const DASHBOARD_FONT_STORAGE_KEY = "dashboard_font_family";

export interface DashboardFontOption {
  id: DashboardFontId;
  name: string;
  englishName: string;
  description: string;
  cssVar: string;
  sampleText: string;
  isDefault?: boolean;
}

export const DASHBOARD_FONTS: readonly DashboardFontOption[] = [
  {
    id: "dana",
    name: "دانا",
    englishName: "Dana",
    description: "فونت پیش‌فرض داشبورد، متعادل با ارقام فارسی یکپارچه",
    cssVar: "var(--font-dana)",
    sampleText: "کنترل هوشمند روشنایی و دما · ۲۴°C — 12:45",
    isDefault: true,
  },
  {
    id: "vazirmatn",
    name: "وزیرمتن",
    englishName: "Vazirmatn",
    description: "مدرن، خوانا و استاندارد برای رابط‌های کاربری فارسی",
    cssVar: "var(--font-vazirmatn)",
    sampleText: "کنترل هوشمند روشنایی و دما · ۲۴°C — 12:45",
  },
  {
    id: "ibm-plex",
    name: "آی‌بی‌ام پلکس",
    englishName: "IBM Plex Sans Arabic",
    description: "دقیق، مهندسی‌شده و مناسب پنل‌های کنترل و وضعیت",
    cssVar: "var(--font-ibm-plex-sans-arabic)",
    sampleText: "کنترل هوشمند روشنایی و دما · ۲۴°C — 12:45",
  },
  {
    id: "noto-sans",
    name: "نوتو سنس",
    englishName: "Noto Sans Arabic",
    description: "کلاسیک، شفاف و خوانا در اندازه‌های کوچک و متوسط",
    cssVar: "var(--font-noto-sans-arabic)",
    sampleText: "کنترل هوشمند روشنایی و دما · ۲۴°C — 12:45",
  },
  {
    id: "rubik",
    name: "روبیک",
    englishName: "Rubik",
    description: "هندسی با گوشه‌های نرم و ظاهر امروزی",
    cssVar: "var(--font-rubik)",
    sampleText: "کنترل هوشمند روشنایی و دما · ۲۴°C — 12:45",
  },
  {
    id: "readex-pro",
    name: "ریدکس پرو",
    englishName: "Readex Pro",
    description: "فشرده، منظم و خوش‌فرم برای کارت‌ها و برچسب‌های کوتاه",
    cssVar: "var(--font-readex-pro)",
    sampleText: "کنترل هوشمند روشنایی و دما · ۲۴°C — 12:45",
  },
] as const;

export function resolveDashboardFontId(value?: string | null): DashboardFontId {
  if (!value) return DEFAULT_DASHBOARD_FONT;

  const normalized = value.trim().toLowerCase();
  const matched = DASHBOARD_FONTS.find((font) => font.id === normalized);

  return matched ? matched.id : DEFAULT_DASHBOARD_FONT;
}

/**
 * Returns the full metadata definition for a dashboard font identifier.
 */
export function getDashboardFontOption(id?: string | null): DashboardFontOption {
  const resolvedId = resolveDashboardFontId(id);

  return DASHBOARD_FONTS.find((font) => font.id === resolvedId) ?? DASHBOARD_FONTS[0];
}

/**
 * Builds the CSS font-family stack for a given dashboard font identifier.
 */
export function getDashboardFontFamilyCss(id?: string | null): string {
  const option = getDashboardFontOption(id);

  return `${option.cssVar}, system-ui, -apple-system, sans-serif`;
}

/**
 * Reads the persisted dashboard font selection from localStorage when available.
 */
export function getStoredDashboardFont(): DashboardFontId {
  if (typeof window === "undefined") return DEFAULT_DASHBOARD_FONT;

  try {
    const saved = window.localStorage.getItem(DASHBOARD_FONT_STORAGE_KEY);

    return resolveDashboardFontId(saved);
  } catch {
    return DEFAULT_DASHBOARD_FONT;
  }
}

/**
 * Persists the selected dashboard font identifier in localStorage.
 */
export function persistDashboardFont(fontId: DashboardFontId): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(DASHBOARD_FONT_STORAGE_KEY, fontId);
  } catch {
    // Ignore storage write failures in restricted contexts
  }
}

/**
 * Applies the selected font CSS variables directly to the document root
 * so Tailwind utilities and portals reflect the selection immediately.
 */
export function applyDashboardFontToDocument(fontId: DashboardFontId): void {
  if (typeof document === "undefined") return;

  const fontCss = getDashboardFontFamilyCss(fontId);

  document.documentElement.style.setProperty("--selected-font", fontCss);
  document.documentElement.style.setProperty("--font-sans", fontCss);
}
