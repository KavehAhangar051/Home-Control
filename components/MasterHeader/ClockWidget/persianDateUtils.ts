const ZOROASTRIAN_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "امرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"] as const;

const toPersianDigits = (num: number | string): string => {
  const str = String(num);
  const len = str.length;
  let out = "";

  for (let i = 0; i < len; i++) {
    const d = str.charCodeAt(i) - 48;
    out += d >= 0 && d <= 9 ? PERSIAN_DIGITS[d] : str[i];
  }

  return out;
};

const PERSIAN_DATE_FORMATTER = new Intl.DateTimeFormat("en-US-u-ca-persian", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

const PERSIAN_TIME_FORMATTER = new Intl.DateTimeFormat("fa-IR", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

let cachedDateDayKey = -1;
let cachedPersianDate = "";

export const getPersianDateString = (time: Date) => {
  const dayKey = time.getFullYear() * 512 + time.getMonth() * 32 + time.getDate();

  if (dayKey === cachedDateDayKey && cachedPersianDate) {
    return cachedPersianDate;
  }

  const parts = PERSIAN_DATE_FORMATTER.formatToParts(time);
  let jYear = 1400;
  let jMonth = 1;
  let jDay = 1;

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];

    if (p.type === "year") jYear = Number.parseInt(p.value, 10);
    else if (p.type === "month") jMonth = Number.parseInt(p.value, 10);
    else if (p.type === "day") jDay = Number.parseInt(p.value, 10);
  }

  const shahanshahiYear = jYear + 1180;
  const monthName = ZOROASTRIAN_MONTHS[jMonth - 1] || "نامشخص";
  const formatted = `${toPersianDigits(jDay)} ${monthName} ${toPersianDigits(shahanshahiYear)}`;

  cachedDateDayKey = dayKey;
  cachedPersianDate = formatted;

  return formatted;
};

export const getTimeString = (time: Date) => {
  return PERSIAN_TIME_FORMATTER.format(time);
};
