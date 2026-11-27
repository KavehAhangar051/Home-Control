"use client";

import type { CSSProperties } from "react";
import {
  EmojiPicker,
  type EmojiPickerData,
  type EmojiPickerI18nOverrides,
  EmojiPickerPanel,
  type EmojiPickerProps,
} from "@/components/reui/emoji-picker";
import { Card } from "@/components/ui/card";
import { SUGGESTED_EMOJIS } from "@/features/iot/utils/icons";
import { useOnlineStatus } from "@/lib/hooks/use-pwa";
import { cn } from "@/lib/utils";

const PERSIAN_EMOJI_PICKER_I18N: EmojiPickerI18nOverrides = {
  labels: {
    trigger: "انتخاب ایموجی",
    panel: "انتخابگر ایموجی",
    search: "جستجوی ایموجی...",
    clearSearch: "پاک کردن جستجو",
    list: "فهرست ایموجی‌ها",
    categories: "دسته‌بندی ایموجی‌ها",
    frequent: "پراستفاده",
    recent: "اخیر",
    searchResults: "نتایج جستجو",
    custom: "سفارشی",
    smileys: "شکلک‌ها",
    people: "افراد",
    nature: "طبیعت",
    food: "خوراکی",
    travel: "سفر و مکان‌ها",
    activities: "فعالیت‌ها",
    objects: "ابزار و اشیا",
    symbols: "نمادها",
    flags: "پرچم‌ها",
    skinTone: "رنگ پوست",
    skinTones: ["پیش‌فرض", "روشن", "گندمی روشن", "متوسط", "گندمی تیره", "تیره"],
    empty: "ایموجی یافت نشد",
    emptyHint: "عبارت جستجو را به انگلیسی تغییر دهید",
    loading: "در حال بارگذاری ایموجی‌ها...",
    error: "بارگذاری فهرست ایموجی‌ها ناموفق بود",
    retry: "تلاش مجدد",
    preview: "یک ایموجی انتخاب کنید",
  },
  functions: {
    formatResultCount: (count) => `${count} نتیجه یافت شد`,
    formatSelected: (label) => `${label} انتخاب شد`,
  },
};

const OFFLINE_EMOJI_HINTS: Record<string, { label: string; tags: string[] }> = {
  "⚡": { label: "high voltage power", tags: ["electricity", "energy", "switch", "برق"] },
  "🚀": { label: "rocket", tags: ["fast", "boost", "سریع"] },
  "💡": { label: "light bulb lamp", tags: ["light", "led", "room", "چراغ", "لامپ"] },
  "🌙": { label: "crescent moon night", tags: ["night", "sleep", "شب"] },
  "☀️": { label: "sun day morning", tags: ["light", "weather", "خورشید", "روز"] },
  "🔒": { label: "locked security", tags: ["lock", "door", "alarm", "قفل"] },
  "🔓": { label: "unlocked open", tags: ["unlock", "door", "باز"] },
  "🎵": { label: "musical note audio", tags: ["music", "sound", "موسیقی"] },
  "🎬": { label: "clapper board movie", tags: ["cinema", "tv", "سینما"] },
  "🚪": { label: "door entrance", tags: ["gate", "room", "درب"] },
  "🚿": { label: "shower bath", tags: ["water", "pump", "حمام", "آب"] },
  "☕": { label: "hot beverage coffee", tags: ["kitchen", "kettle", "قهوه"] },
  "❄️": { label: "snowflake cool ac", tags: ["cold", "cooler", "fan", "کولر", "سرما"] },
  "🔥": { label: "fire heat heater", tags: ["warm", "gas", "گرما", "بخاری"] },
  "💨": { label: "dashing away fan wind", tags: ["air", "ventilation", "باد", "فن"] },
  "🌿": { label: "herb plant garden", tags: ["garden", "irrigation", "گیاه", "باغچه"] },
  "🔔": { label: "bell notification alarm", tags: ["alert", "chime", "زنگ"] },
  "💤": { label: "zzz sleep", tags: ["night", "rest", "خواب"] },
  "🎉": { label: "party popper celebration", tags: ["scene", "fun", "جشن"] },
  "🎥": { label: "movie camera cctv", tags: ["security", "video", "دوربین"] },
  "🚗": { label: "automobile car garage", tags: ["parking", "gate", "پارکینگ"] },
  "🔌": { label: "electric plug socket", tags: ["outlet", "relay", "پریز"] },
  "🔋": { label: "battery power", tags: ["ups", "solar", "باتری"] },
  "📡": { label: "satellite antenna wifi", tags: ["mqtt", "signal", "آنتن"] },
  "🔦": { label: "flashlight torch", tags: ["light", "spot", "چراغ"] },
  "📱": { label: "mobile phone", tags: ["device", "app", "موبایل"] },
  "💻": { label: "laptop computer", tags: ["desk", "work", "لپتاپ"] },
  "🖥️": { label: "desktop monitor", tags: ["pc", "screen", "مانیتور"] },
  "🖨️": { label: "printer", tags: ["office", "پرینتر"] },
  "🕹️": { label: "joystick", tags: ["gaming", "بازی"] },
  "🎮": { label: "video game", tags: ["console", "gaming", "گیم"] },
  "📺": { label: "television tv", tags: ["living room", "media", "تلویزیون"] },
  "📻": { label: "radio", tags: ["audio", "fm", "رادیو"] },
  "🎙️": { label: "studio microphone voice", tags: ["mic", "audio", "میکروفون"] },
  "🎚️": { label: "level slider dimmer", tags: ["pwm", "control", "دیمر"] },
  "🎛️": { label: "control knobs", tags: ["panel", "iot", "کنترل"] },
};

const OFFLINE_EMOJI_PICKER_DATA: EmojiPickerData = {
  locale: "en",
  categories: {
    objects: "Objects",
    symbols: "Symbols",
  },
  emojis: SUGGESTED_EMOJIS.map((emoji, index) => {
    const hint = OFFLINE_EMOJI_HINTS[emoji];
    return {
      id: `offline_${index}_${emoji.codePointAt(0)?.toString(16) ?? index}`,
      emoji,
      label: hint?.label ?? `smart home emoji ${index + 1}`,
      tags: hint?.tags ?? ["smart", "home", "iot"],
      shortcodes: [hint?.label.split(" ")[0] ?? `emoji_${index + 1}`],
      category: index < 20 ? "objects" : "symbols",
      version: 1,
    };
  }),
};

export interface CEmojiPicker1Props {
  value?: string | null;
  onValueChange?: (value: string | null) => void;
  size?: EmojiPickerProps["size"];
  columns?: EmojiPickerProps["columns"];
  bare?: boolean;
  className?: string;
  panelClassName?: string;
  panelStyle?: CSSProperties;
}

/**
 * ReUI `@reui/c-emoji-picker-1` pattern wrapped for Home-Control-Dashboard:
 * localized Persian labels, RTL-safe sizing, `bare` unboxed mode for sheets/modals,
 * and offline fallback dataset when operating on an air-gapped ESP32 local network.
 */
export function CEmojiPicker1({
  value,
  onValueChange,
  size = "default",
  columns,
  bare = false,
  className,
  panelClassName,
  panelStyle,
}: CEmojiPicker1Props) {
  const isOnline = useOnlineStatus();
  const resolvedColumns = columns ?? (bare ? "auto" : 8);

  const picker = (
    <EmojiPicker
      value={value ?? null}
      onValueChange={onValueChange}
      size={size}
      columns={resolvedColumns}
      data={isOnline ? undefined : OFFLINE_EMOJI_PICKER_DATA}
      locale="en"
      i18n={PERSIAN_EMOJI_PICKER_I18N}
    >
      <EmojiPickerPanel
        className={cn(bare && "[--emoji-picker-surface:var(--card-bg-solid)]", panelClassName)}
        style={panelStyle}
      />
    </EmojiPicker>
  );

  if (bare) {
    return <div className={cn("w-full min-w-0", className)}>{picker}</div>;
  }

  return (
    <Card
      className={cn("w-fit max-w-full overflow-hidden py-0 [container-type:normal]!", className)}
    >
      {picker}
    </Card>
  );
}
