/**
 * Authoritative Persian day-of-week mapping (0 = Sunday .. 6 = Saturday).
 * Shared between AutomationForm and AutomationList.
 */
export const DAYS_MAP = [
  { value: 6, label: "شنبه" },
  { value: 0, label: "یکشنبه" },
  { value: 1, label: "دوشنبه" },
  { value: 2, label: "سه‌شنبه" },
  { value: 3, label: "چهارشنبه" },
  { value: 4, label: "پنج‌شنبه" },
  { value: 5, label: "جمعه" },
] as const;
