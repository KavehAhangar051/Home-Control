"use client";

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
  "⚡": { label: "high voltage power", tags: ["electricity", "energy", "switch"] },
  "🚀": { label: "rocket", tags: ["fast", "boost"] },
  "💡": { label: "light bulb lamp", tags: ["light", "led", "room"] },
  "🌙": { label: "crescent moon night", tags: ["night", "sleep"] },
  "☀️": { label: "sun day morning", tags: ["light", "weather"] },
  "🔒": { label: "locked security", tags: ["lock", "door", "alarm"] },
  "🔓": { label: "unlocked open", tags: ["unlock", "door"] },
  "🎵": { label: "musical note audio", tags: ["music", "sound"] },
  "🎬": { label: "clapper board movie", tags: ["cinema", "tv"] },
  "🚪": { label: "door entrance", tags: ["gate", "room"] },
  "🚿": { label: "shower bath", tags: ["water", "pump"] },
  "☕": { label: "hot beverage coffee", tags: ["kitchen", "kettle"] },
  "❄️": { label: "snowflake cool ac", tags: ["cold", "cooler", "fan"] },
  "🔥": { label: "fire heat heater", tags: ["warm", "gas"] },
  "💨": { label: "dashing away fan wind", tags: ["air", "ventilation"] },
  "🌿": { label: "herb plant garden", tags: ["garden", "irrigation"] },
  "🔔": { label: "bell notification alarm", tags: ["alert", "chime"] },
  "💤": { label: "zzz sleep", tags: ["night", "rest"] },
  "🎉": { label: "party popper celebration", tags: ["scene", "fun"] },
  "🎥": { label: "movie camera cctv", tags: ["security", "video"] },
  "🚗": { label: "automobile car garage", tags: ["parking", "gate"] },
  "🔌": { label: "electric plug socket", tags: ["outlet", "relay"] },
  "🔋": { label: "battery power", tags: ["ups", "solar"] },
  "📡": { label: "satellite antenna wifi", tags: ["mqtt", "signal"] },
  "🔦": { label: "flashlight torch", tags: ["light", "spot"] },
  "📱": { label: "mobile phone", tags: ["device", "app"] },
  "💻": { label: "laptop computer", tags: ["desk", "work"] },
  "🖥️": { label: "desktop monitor", tags: ["pc", "screen"] },
  "🖨️": { label: "printer", tags: ["office"] },
  "🕹️": { label: "joystick", tags: ["gaming"] },
  "🎮": { label: "video game", tags: ["console", "gaming"] },
  "📺": { label: "television tv", tags: ["living room", "media"] },
  "📻": { label: "radio", tags: ["audio", "fm"] },
  "🎙️": { label: "studio microphone voice", tags: ["mic", "audio"] },
  "🎚️": { label: "level slider dimmer", tags: ["pwm", "control"] },
  "🎛️": { label: "control knobs", tags: ["panel", "iot"] },
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
  className?: string;
  panelClassName?: string;
}

/**
 * ReUI `@reui/c-emoji-picker-1` pattern wrapped for Home-Control-Dashboard:
 * localized Persian labels, RTL-safe sizing (`[container-type:normal]` so
 * `w-fit` never collapses inside `@container/card`), and offline fallback
 * dataset when operating on an air-gapped ESP32 local network.
 */
export function CEmojiPicker1({
  value,
  onValueChange,
  size = "default",
  columns = 8,
  className,
  panelClassName,
}: CEmojiPicker1Props) {
  const isOnline = useOnlineStatus();

  return (
    <Card
      className={cn("w-fit max-w-full overflow-hidden py-0 [container-type:normal]!", className)}
    >
      <EmojiPicker
        value={value ?? null}
        onValueChange={onValueChange}
        size={size}
        columns={columns}
        data={isOnline ? undefined : OFFLINE_EMOJI_PICKER_DATA}
        locale="en"
        i18n={PERSIAN_EMOJI_PICKER_I18N}
      >
        <EmojiPickerPanel className={panelClassName} />
      </EmojiPicker>
    </Card>
  );
}
