/**
 * @file utils/scheduler.ts
 * محاسبه زمان trigger بعدی برای اتوماسیون‌های زمانبندی‌شده
 * با پشتیبانی از منطقه زمانی تهران (UTC+3:30)، تایمر دقیق targetTimestamp، و محافظ تاخیر دقیقه جاری
 */

const TEHRAN_OFFSET_MS = 3.5 * 60 * 60 * 1000;
const ONE_SHOT_CURRENT_MINUTE_GRACE_MS = 60_000;
const ONE_SHOT_TARGET_GRACE_MS = 5 * 60_000;

export interface TriggerOptions {
	repeatCount?: number;
	targetTimestamp?: number;
}

/**
 * فرمت ساعت تهران برای لاگ و پیام‌های تاییدیه WebSocket
 */
export function formatTehranTime(timestampMs: number): string {
	const d = new Date(timestampMs + TEHRAN_OFFSET_MS);
	const hh = String(d.getUTCHours()).padStart(2, "0");
	const mm = String(d.getUTCMinutes()).padStart(2, "0");
	const ss = String(d.getUTCSeconds()).padStart(2, "0");
	return `${hh}:${mm}:${ss}`;
}

/**
 * محاسبه timestamp بعدی که یک اتوماسیون باید فعال شود.
 *
 * @param timeStr         زمان به فرمت "HH:MM" یا "HH:MM:SS"
 * @param daysArray       آرایه روزهای هفته (0=یکشنبه، 6=شنبه)
 * @param referenceDate   تاریخ مرجع برای محاسبه (پیش‌فرض: now)
 * @param intervalMinutes بازه تکرار دقیقه‌ای (اتوماسیون‌های آب‌وهوا)
 * @param options         تنظیمات اختیاری شامل repeatCount و targetTimestamp دقیق
 * @returns timestamp میلی‌ثانیه‌ای یا null اگر قابل زمانبندی نباشد
 */
export function getNextTriggerTimestamp(
	timeStr: string,
	daysArray: number[],
	referenceDate?: Date,
	intervalMinutes?: number,
	options?: TriggerOptions
): number | null {
	const now = referenceDate ?? new Date();
	const nowMs = now.getTime();

	if (intervalMinutes && intervalMinutes > 0) {
		return nowMs + intervalMinutes * 60 * 1000;
	}

	const targetTs = options?.targetTimestamp;
	if (typeof targetTs === "number" && Number.isFinite(targetTs) && targetTs > 0) {
		if (targetTs > nowMs) {
			return targetTs;
		}
		if (options?.repeatCount === 1 && nowMs - targetTs <= ONE_SHOT_TARGET_GRACE_MS) {
			return nowMs + 250;
		}
		return null;
	}

	if (!timeStr || typeof timeStr !== "string") return null;
	const parts = timeStr.trim().split(":").map(Number);
	const hours = parts[0];
	const minutes = parts[1];
	const seconds = Number.isFinite(parts[2]) ? parts[2] : 0;
	if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
		return null;
	}

	const nowTehranMs = nowMs + TEHRAN_OFFSET_MS;
	const nowTehran = new Date(nowTehranMs);
	const effectiveDays = Array.isArray(daysArray) && daysArray.length > 0 ? daysArray : [nowTehran.getUTCDay()];

	let bestDelay = Infinity;

	for (const day of effectiveDays) {
		if (!Number.isInteger(day) || day < 0 || day > 6) continue;

		let dayDiff = day - nowTehran.getUTCDay();
		if (dayDiff < 0) dayDiff += 7;

		const candidate = new Date(nowTehranMs);
		candidate.setUTCDate(candidate.getUTCDate() + dayDiff);
		candidate.setUTCHours(hours, minutes, Math.min(59, Math.max(0, seconds)), 0);

		const diffFromNow = candidate.getTime() - nowTehranMs;

		if (dayDiff === 0 && diffFromNow <= 0) {
			// اگر تایمر یک‌بارمصرف برای همین دقیقه جاری تنظیم شده و به‌دلیل تاخیر شبکه/دیبانس
			// چند ثانیه از :00 گذشته باشد، به‌جای تعویق ۷ روزه بلافاصله اجرا شود.
			if (options?.repeatCount === 1 && -diffFromNow < ONE_SHOT_CURRENT_MINUTE_GRACE_MS) {
				return nowMs + 250;
			}
			candidate.setUTCDate(candidate.getUTCDate() + 7);
		}

		const delay = candidate.getTime() - nowTehranMs;
		if (delay < bestDelay) {
			bestDelay = delay;
		}
	}

	if (bestDelay === Infinity) return null;
	return nowMs + bestDelay;
}
