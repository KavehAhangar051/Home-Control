import {
  Activity,
  Cpu,
  Home,
  Layers,
  Lightbulb,
  type LucideIcon,
  Music,
  ShieldCheck,
  Thermometer,
} from "lucide-react";

export type IconCategoryId =
  | "lighting"
  | "climate"
  | "security"
  | "rooms"
  | "media"
  | "sensors"
  | "network"
  | "general";

export interface IconCatalogEntry {
  key: string;
  label: string;
  keywords: readonly string[];
  category: IconCategoryId;
}

export interface IconCategoryMeta {
  id: IconCategoryId;
  label: string;
  icon: LucideIcon;
  items: readonly IconCatalogEntry[];
}

function entry(
  category: IconCategoryId,
  key: string,
  label: string,
  keywords: readonly string[] = [],
): IconCatalogEntry {
  return {
    key,
    label,
    keywords: [key.toLowerCase(), label, ...keywords],
    category,
  };
}

export const ICON_CATEGORIES: readonly IconCategoryMeta[] = [
  {
    id: "lighting",
    label: "روشنایی و برق",
    icon: Lightbulb,
    items: [
      entry("lighting", "Lightbulb", "لامپ", ["نور", "روشنایی", "چراغ", "light", "bulb"]),
      entry("lighting", "LampDesk", "چراغ رومیزی", ["آباژور", "مطالعه", "desk", "lamp"]),
      entry("lighting", "LampFloor", "آباژور ایستاده", ["پذیرایی", "نور", "floor", "lamp"]),
      entry("lighting", "LampCeiling", "لوستر و سقفی", ["نور سقف", "آویز", "ceiling", "lamp"]),
      entry("lighting", "Flashlight", "نور نقطه‌ای", ["چراغ قوه", "پروژکتور", "spot"]),
      entry("lighting", "Zap", "برق و رله", ["ولتاژ", "کلید", "power", "electric"]),
      entry("lighting", "Bolt", "جریان برق", ["اتصال", "برق", "energy"]),
      entry("lighting", "Power", "دکمه پاور", ["روشن", "خاموش", "سوئیچ", "switch"]),
      entry("lighting", "Plug", "پریز برق", ["دوشاخه", "socket", "outlet"]),
      entry("lighting", "PlugZap", "پریز هوشمند", ["شارژ", "smart plug"]),
      entry("lighting", "ToggleRight", "کلید دوحالته", ["تاگل", "سوئیچ", "toggle"]),
      entry("lighting", "SlidersHorizontal", "دیمر نور", ["شدت", "تنظیم", "dimmer", "pwm"]),
      entry("lighting", "Sun", "نور روز", ["آفتاب", "صبح", "day"]),
      entry("lighting", "Moon", "حالت شب", ["خواب", "تاریکی", "night", "sleep"]),
      entry("lighting", "Sunrise", "طلوع", ["بیداری", "صبح", "morning"]),
      entry("lighting", "Sunset", "غروب", ["عصر", "شامگاه", "evening"]),
      entry("lighting", "Sparkles", "نورپردازی", ["مهمانی", "جشن", "rgb", "scene"]),
      entry("lighting", "Sparkle", "درخشش", ["تزئینی", "نور"]),
      entry("lighting", "Battery", "باتری", ["شارژ", "پاوربانک", "ups"]),
      entry("lighting", "BatteryCharging", "در حال شارژ", ["شارژر", "اینورتر", "charging"]),
      entry("lighting", "BatteryFull", "باتری پر", ["ذخیره", "full"]),
    ],
  },
  {
    id: "climate",
    label: "اقلیم و دما",
    icon: Thermometer,
    items: [
      entry("climate", "Thermometer", "دماسنج", ["دما", "حرارت", "temp"]),
      entry("climate", "ThermometerSun", "دمای بالا", ["گرما", "بخاری", "warm"]),
      entry("climate", "ThermometerSnowflake", "دمای پایین", ["سرما", "چیلر", "cold"]),
      entry("climate", "Fan", "فن و کولر", ["پروانه", "تهویه", "blower"]),
      entry("climate", "AirVent", "داکت و اسپیلیت", ["کولر گازی", "هواساز", "ac", "hvac"]),
      entry("climate", "Heater", "شوفاژ و بخاری", ["گرمایش", "پکیج", "رادیاتور"]),
      entry("climate", "Flame", "شعله و شومینه", ["گاز", "حرارت", "fire"]),
      entry("climate", "Snowflake", "سرمایش", ["یخ", "برف", "cool", "ac"]),
      entry("climate", "Wind", "باد و تهویه", ["هواکش", "اگزوزفن", "air"]),
      entry("climate", "Droplet", "قطره آب", ["رطوبت", "شیر برقی", "water"]),
      entry("climate", "Droplets", "آبیاری و پمپ", ["پمپ آب", "مه پاش", "irrigation"]),
      entry("climate", "Waves", "جریان و موج", ["سیال", "استخر", "water"]),
      entry("climate", "Cloud", "ابر و هوا", ["آب و هوا", "weather"]),
      entry("climate", "CloudSun", "نیمه‌ابری", ["هوا", "روز"]),
      entry("climate", "CloudMoon", "شب صاف", ["هوا", "شب"]),
      entry("climate", "CloudRain", "بارانی", ["سنسور باران", "آبیاری", "rain"]),
      entry("climate", "Umbrella", "سایبان و چتر", ["پرده برقی", "سقف بازشو"]),
      entry("climate", "Rainbow", "تغییر رنگ", ["نوار نورانی", "rgb"]),
    ],
  },
  {
    id: "security",
    label: "امنیت و ورود",
    icon: ShieldCheck,
    items: [
      entry("security", "Lock", "قفل بسته", ["امنیت", "درب", "closed"]),
      entry("security", "Unlock", "قفل باز", ["ورود", "درب", "open"]),
      entry("security", "Key", "کلید", ["دسترسی", "رمز", "access"]),
      entry("security", "KeyRound", "قفل هوشمند", ["رمز", "کارت", "smart lock"]),
      entry("security", "DoorOpen", "درب باز", ["ورودی", "حسگر درب"]),
      entry("security", "DoorClosed", "درب بسته", ["ورودی", "سنسور درب"]),
      entry("security", "Shield", "سپر امنیتی", ["دزدگیر", "حفاظت", "alarm"]),
      entry("security", "ShieldCheck", "ایمن و مسلح", ["تایید امنیت", "armed"]),
      entry("security", "ShieldAlert", "هشدار امنیتی", ["خطر", "آژیر", "alert"]),
      entry("security", "Siren", "آژیر و آژانس", ["چشمک زن", "اعلام حریق", "alarm"]),
      entry("security", "Cctv", "دوربین مداربسته", ["نظارت", "پایش", "camera"]),
      entry("security", "Camera", "دوربین", ["عکس", "سنسور تصویر"]),
      entry("security", "Video", "ضبط تصویر", ["ویدیو", "آیفون تصویری"]),
      entry("security", "Eye", "سنسور حضور", ["چشمی", "حرکت", "pir", "motion"]),
      entry("security", "ScanFace", "تشخیص چهره", ["کنترل تردد", "face"]),
      entry("security", "Fingerprint", "اثر انگشت", ["بیومتریک", "قفل"]),
      entry("security", "Bell", "زنگ و اعلان", ["زنگ درب", "chime"]),
      entry("security", "BellRing", "زنگ در حال صدا", ["هشدار", "اعلان"]),
      entry("security", "BellOff", "حالت بی‌صدا", ["سایلنت", "mute"]),
    ],
  },
  {
    id: "rooms",
    label: "خانه و اتاق‌ها",
    icon: Home,
    items: [
      entry("rooms", "Home", "خانه", ["اصلی", "منزل", "house"]),
      entry("rooms", "Building2", "ساختمان و لابی", ["آپارتمان", "مجتمع"]),
      entry("rooms", "Warehouse", "پارکینگ و انباری", ["گاراژ", "جک برقی", "garage"]),
      entry("rooms", "Sofa", "پذیرایی و نشیمن", ["سالن", "هال", "living"]),
      entry("rooms", "Armchair", "اتاق استراحت", ["مبل", "نشیمن"]),
      entry("rooms", "BedDouble", "اتاق خواب", ["تخت", "استراحت", "bedroom"]),
      entry("rooms", "Bath", "حمام و سرویس", ["روشویی", "وان", "bathroom"]),
      entry("rooms", "Utensils", "آشپزخانه", ["غذاخوری", "kitchen"]),
      entry("rooms", "CookingPot", "اجاق و هود", ["آشپزی", "پخت", "hood"]),
      entry("rooms", "Refrigerator", "یخچال", ["آشپزخانه", "سردخانه"]),
      entry("rooms", "WashingMachine", "لباسشویی", ["رختشویخانه", "laundry"]),
      entry("rooms", "Coffee", "قهوه‌ساز و چای‌ساز", ["کافه", "آشپزخانه", "kettle"]),
      entry("rooms", "Fence", "حیاط و حصار", ["باغچه", "درب حیاط", "yard"]),
      entry("rooms", "Trees", "باغ و فضای سبز", ["درخت", "آبیاری", "garden"]),
      entry("rooms", "Leaf", "گیاه و گلخانه", ["گلدان", "طبیعت", "plant"]),
      entry("rooms", "Sprout", "رشد گیاه", ["نور رشد", "خاک", "garden"]),
      entry("rooms", "Flower2", "تراس و بالکن", ["گل", "پاسیو"]),
      entry("rooms", "Tent", "آلاچیق و روف‌گاردن", ["کمپ", "حیاط"]),
      entry("rooms", "Car", "پارکینگ خودرو", ["درب پارکینگ", "ماشین", "garage"]),
    ],
  },
  {
    id: "media",
    label: "رسانه و صوت",
    icon: Music,
    items: [
      entry("media", "Tv", "تلویزیون", ["سینما", "نمایشگر", "smart tv"]),
      entry("media", "Monitor", "مانیتور و میز کار", ["کامپیوتر", "صفحه نمایش"]),
      entry("media", "Speaker", "بلندگو و باند", ["صوت", "اسپیکر", "audio"]),
      entry("media", "Volume2", "صدای بلند", ["تنظیم صدا", "volume"]),
      entry("media", "VolumeOff", "قطع صدا", ["بی‌صدا", "mute"]),
      entry("media", "Mic", "میکروفون", ["فرمان صوتی", "voice"]),
      entry("media", "Headphones", "هدفون", ["موسیقی", "گوشی"]),
      entry("media", "Music", "موسیقی", ["آهنگ", "پلیر", "player"]),
      entry("media", "Radio", "رادیو", ["گیرنده", "fm"]),
      entry("media", "Podcast", "پخش زنده", ["پادکست", "استریم"]),
      entry("media", "Airplay", "ارسال تصویر", ["پخش بی‌سیم", "stream"]),
      entry("media", "Cast", "کست روی نمایشگر", ["اتصال تصویر", "chromecast"]),
      entry("media", "Film", "حالت سینما", ["فیلم", "movie"]),
      entry("media", "Clapperboard", "سناریو فیلم", ["سینما", "صحنه"]),
      entry("media", "Disc3", "دیسک و پلیر", ["دی‌وی‌دی", "آلبوم"]),
      entry("media", "Play", "پخش", ["شروع", "start"]),
      entry("media", "Pause", "توقف موقت", ["مکث", "hold"]),
      entry("media", "Square", "توقف", ["ایست", "stop"]),
      entry("media", "SquareStop", "ایست کامل", ["قطع پخش", "stop"]),
      entry("media", "SkipBack", "قبلی", ["عقب", "prev"]),
      entry("media", "SkipForward", "بعدی", ["جلو", "next"]),
      entry("media", "Shuffle", "پخش تصادفی", ["ترکیبی"]),
      entry("media", "Repeat", "تکرار", ["حلقه", "loop"]),
      entry("media", "Gamepad2", "کنسول بازی", ["گیم", "سرگرمی", "gaming"]),
    ],
  },
  {
    id: "sensors",
    label: "سنسور و پایش",
    icon: Activity,
    items: [
      entry("sensors", "Activity", "سنسور و نبض", ["پایش", "فعالیت", "sensor"]),
      entry("sensors", "Gauge", "گیج و فشار", ["سرعت", "آمپر", "meter"]),
      entry("sensors", "Radar", "رادار و حضور", ["موج", "تشخیص", "mmwave"]),
      entry("sensors", "Magnet", "سنسور مگنت", ["درب و پنجره", "reed"]),
      entry("sensors", "Compass", "جهت و قطب‌نما", ["موقعیت", "جهت"]),
      entry("sensors", "Clock", "ساعت و زمان‌بندی", ["برنامه زمانی", "schedule"]),
      entry("sensors", "AlarmClock", "زنگ هشدار", ["بیدارباش", "یادآور"]),
      entry("sensors", "Timer", "تایمر", ["شمارش معکوس", "تاخیر"]),
      entry("sensors", "Hourglass", "زمان انتظار", ["تایمر", "تاخیر"]),
      entry("sensors", "Calendar", "تقویم", ["برنامه هفتگی", "روز"]),
      entry("sensors", "Scale", "وزن و ترازو", ["سنسور فشار", "load cell"]),
      entry("sensors", "Ruler", "فاصله و ارتفاع", ["اولتراسونیک", "سطح آب"]),
      entry("sensors", "MapPin", "موقعیت مکانی", ["جی‌پی‌اس", "مکان"]),
    ],
  },
  {
    id: "network",
    label: "شبکه و سخت‌افزار",
    icon: Cpu,
    items: [
      entry("network", "Cpu", "میکروکنترلر ESP32", ["پردازنده", "برد", "chip"]),
      entry("network", "CircuitBoard", "مدار و برد", ["الکترونیک", "pcb"]),
      entry("network", "Server", "سرور و هاب", ["مرکزی", "کنترلر"]),
      entry("network", "Router", "روتر و مودم", ["اینترنت", "شبکه"]),
      entry("network", "Wifi", "وای‌فای", ["بی‌سیم", "سیگنال", "wireless"]),
      entry("network", "Bluetooth", "بلوتوث", ["اتصال نزدیک", "ble"]),
      entry("network", "RadioTower", "آنتن رادیویی", ["RF", "برد کمکی"]),
      entry("network", "SatelliteDish", "دیش و گیرنده", ["ماهواره", "آنتن"]),
      entry("network", "Cable", "کابل اتصال", ["سیم", "سیمی"]),
      entry("network", "EthernetPort", "پورت شبکه", ["لن", "lan"]),
      entry("network", "Usb", "درگاه USB", ["پورت", "تغذیه"]),
      entry("network", "HardDrive", "حافظه و ماژول", ["ذخیره‌سازی", "sd"]),
      entry("network", "Database", "پایگاه داده", ["لاگ", "ثبت"]),
      entry("network", "CloudCog", "سرویس ابری", ["MQTT", "کلودفلر"]),
      entry("network", "Smartphone", "موبایل", ["گوشی", "کنترل"]),
      entry("network", "Phone", "تلفن و تماس", ["تلفن ثابت", "آیفون"]),
      entry("network", "Globe", "اینترنت و وب", ["HTTP", "وب‌هوک"]),
      entry("network", "Link2", "اتصال و لینک", ["همگام‌سازی", "bridge"]),
    ],
  },
  {
    id: "general",
    label: "عمومی و کاربردی",
    icon: Layers,
    items: [
      entry("general", "Layers", "گروه و دسته‌بندی", ["لایه‌ها", "بخش"]),
      entry("general", "Settings", "تنظیمات", ["چرخ‌دنده", "پیکربندی"]),
      entry("general", "Sliders", "کنترل دستی", ["تنظیم", "دیمر"]),
      entry("general", "Wrench", "تعمیر و سرویس", ["آچار", "نگهداری"]),
      entry("general", "Hammer", "ساخت و کارگاه", ["ابزار", "کارگاه"]),
      entry("general", "Book", "کتابخانه و مطالعه", ["دفتر", "اتاق کار"]),
      entry("general", "Bookmark", "نشانه‌گذاری", ["علاقه‌مندی", "پین"]),
      entry("general", "Star", "ویژه و محبوب", ["ستاره", "مهم"]),
      entry("general", "Heart", "مورد علاقه", ["سلامت", "قلب"]),
      entry("general", "Flag", "نشانه و هدف", ["پرچم", "اولویت"]),
      entry("general", "Tag", "برچسب", ["تگ", "نام"]),
      entry("general", "Folder", "پوشه", ["دسته", "بایگانی"]),
      entry("general", "Check", "تایید و انجام", ["تیک", "فعال"]),
      entry("general", "RefreshCw", "بازنشانی و همگام", ["رفرش", "ریست"]),
      entry("general", "Plus", "افزودن", ["اضافه", "بیشتر"]),
      entry("general", "Minus", "کاهش", ["کم کردن", "منفی"]),
      entry("general", "X", "بستن و لغو", ["خروج", "حذف"]),
      entry("general", "Search", "جستجو", ["ذره‌بین", "یافتن"]),
      entry("general", "Menu", "فهرست", ["منو", "لیست"]),
      entry("general", "Download", "دریافت", ["دانلود", "ورود"]),
      entry("general", "Upload", "ارسال", ["آپلود", "خروج"]),
      entry("general", "Send", "اجرای فرمان", ["ارسال", "تایید"]),
      entry("general", "Trash2", "حذف و بازیافت", ["سطل", "پاک"]),
      entry("general", "Rocket", "حالت سریع", ["توربو", "بوست"]),
      entry("general", "AlertTriangle", "هشدار", ["اخطار", "احتیاط"]),
      entry("general", "Info", "اطلاعات", ["راهنما", "جزئیات"]),
    ],
  },
] as const;

export const ICON_CATALOG_BY_KEY: ReadonlyMap<string, IconCatalogEntry> = new Map(
  ICON_CATEGORIES.flatMap((category) => category.items.map((item) => [item.key, item])),
);

export function getIconCatalogEntry(iconKey?: string): IconCatalogEntry | undefined {
  if (!iconKey) return undefined;
  return ICON_CATALOG_BY_KEY.get(iconKey);
}

export function getIconPersianLabel(iconKey?: string): string | undefined {
  return getIconCatalogEntry(iconKey)?.label;
}

export function searchIconCatalog(query: string): IconCatalogEntry[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const terms = normalized.split(/\s+/).filter(Boolean);
  const scored: Array<{ item: IconCatalogEntry; score: number }> = [];

  for (const category of ICON_CATEGORIES) {
    for (const item of category.items) {
      let score = 0;
      let matchedAll = true;

      for (const term of terms) {
        const keyLower = item.key.toLowerCase();
        const labelLower = item.label.toLowerCase();
        let termScore = 0;

        if (keyLower === term || labelLower === term) {
          termScore = 100;
        } else if (labelLower.startsWith(term) || keyLower.startsWith(term)) {
          termScore = 80;
        } else if (item.keywords.some((kw) => kw.toLowerCase().includes(term))) {
          termScore = 40;
        } else if (category.label.toLowerCase().includes(term)) {
          termScore = 25;
        }

        if (termScore === 0) {
          matchedAll = false;
          break;
        }

        score += termScore;
      }

      if (matchedAll) {
        scored.push({ item, score });
      }
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map((entryItem) => entryItem.item);
}
