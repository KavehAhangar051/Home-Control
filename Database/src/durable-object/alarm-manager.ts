/**
 * @file durable-object/alarm-manager.ts
 * منطق زمانبندی و اجرای اتوماسیون‌ها از طریق DO Alarms
 * پشتیبانی از فرمان دسته‌ای دیجیتال (0x08) و فرمان PWM آنالوگ (0x0A) روی پین‌های 0..127
 */

import { getNextTriggerTimestamp } from "../utils/scheduler";
import { getCurrentTemperature } from "../utils/weather";
import type { Automation, Macro } from "../types";

/** ساختار داخلی برای نگه‌داشتن زمان محاسبه‌شده هر اتوماسیون */
interface ScheduledEntry {
	id: string;
	ts: number;
}

export interface PendingAutomationPin {
	pin: number;
	state: boolean;
	analogValue?: number;
}

/**
 * محاسبه و ثبت آلارم بعدی بر اساس لیست اتوماسیون‌های فعال.
 */
export async function scheduleNextAlarm(storage: DurableObjectStorage): Promise<void> {
	const automations = (await storage.get<Automation[]>("automations")) ?? [];
	const activeAutomations = automations.filter((a) => a.enabled);

	if (activeAutomations.length === 0) {
		await storage.deleteAlarm();
		return;
	}

	const now = new Date();
	const scheduled: ScheduledEntry[] = activeAutomations
		.map((auto) => ({ id: auto.id, ts: getNextTriggerTimestamp(auto.time, auto.days, now, auto.intervalMinutes) }))
		.filter((entry): entry is ScheduledEntry => entry.ts !== null);

	if (scheduled.length === 0) {
		await storage.deleteAlarm();
		return;
	}

	const nextTime = Math.min(...scheduled.map((e) => e.ts));
	const nextAlarmIds = scheduled.filter((e) => e.ts === nextTime).map((e) => e.id);

	await Promise.all([
		storage.put("nextAlarmTime", nextTime),
		storage.put("nextAlarmIds", nextAlarmIds),
		storage.setAlarm(nextTime),
	]);
}

function broadcastBinary(sockets: WebSocket[], payload: Uint8Array): void {
	for (const ws of sockets) {
		try {
			ws.send(payload);
		} catch {
			// اتصال قطع شده — نادیده گرفته می‌شود
		}
	}
}

function encodeAnalogFrame(pin: number, value: number): Uint8Array {
	const clamped = Math.max(0, Math.min(4095, Math.round(value)));
	return new Uint8Array([0x0a, pin & 0xff, clamped & 0xff, (clamped >> 8) & 0xff]);
}

/**
 * اجرای اتوماسیون‌هایی که الان باید فعال شوند و ارسال payload به ESP از طریق WebSocket.
 */
export async function fireAlarm(
	storage: DurableObjectStorage,
	getWebSockets: () => WebSocket[]
): Promise<void> {
	const [automations, nextAlarmIds, macros] = await Promise.all([
		storage.get<Automation[]>("automations").then((v) => v ?? []),
		storage.get<string[]>("nextAlarmIds").then((v) => v ?? []),
		storage.get<Macro[]>("macros").then((v) => v ?? []),
	]);

	const idSet = new Set(nextAlarmIds);
	const fired = automations.filter((a) => idSet.has(a.id));
	const sockets = getWebSockets();
	let automationsChanged = false;
	const weatherCache = new Map<string, number | null>();

	for (const auto of fired) {
		if (auto.conditionType === "weather" && auto.city) {
			let currentTemp: number | null = null;
			if (weatherCache.has(auto.city)) {
				currentTemp = weatherCache.get(auto.city) ?? null;
			} else {
				currentTemp = await getCurrentTemperature(auto.city);
				weatherCache.set(auto.city, currentTemp);
			}

			if (currentTemp !== null && auto.temperatureThreshold !== undefined) {
				const isGreater = auto.temperatureCondition === "greater";
				const conditionMet = isGreater
					? currentTemp > auto.temperatureThreshold
					: currentTemp < auto.temperatureThreshold;

				if (!conditionMet) {
					console.log(`[Automation] Skipped ${auto.id} due to weather condition (${currentTemp}°C vs threshold ${auto.temperatureThreshold}°C)`);
					continue;
				}
			}
		}

		if (auto.repeatCount !== undefined && auto.repeatCount > 0) {
			auto.repeatCount -= 1;
			automationsChanged = true;
			if (auto.repeatCount === 0) {
				auto.enabled = false;
				console.log(`[Automation] Disabled ${auto.id} as repeatCount reached 0.`);
			}
		}

		const allPins: PendingAutomationPin[] = [];

		const pushPinAction = (rawPin: string | undefined, actionOn: boolean | undefined, targetValue?: number | null) => {
			if (!rawPin) return;
			const pin = Number.parseInt(rawPin, 10);
			if (!Number.isInteger(pin) || pin < 0 || pin > 127) return;

			if (typeof targetValue === "number" && Number.isFinite(targetValue) && targetValue >= 0) {
				const clamped = Math.min(4095, Math.round(targetValue));
				allPins.push({ pin, state: clamped > 0, analogValue: clamped });
			} else {
				allPins.push({ pin, state: !!actionOn });
			}
		};

		if (auto.actions) {
			for (const action of auto.actions) {
				if (action.targetMacro) {
					const m = macros.find((macro) => macro.id === action.targetMacro);
					if (m?.actions) {
						for (const ma of m.actions) {
							pushPinAction(ma.targetPin, ma.actionOn, ma.targetValue);
						}
					}
				} else {
					pushPinAction(action.targetPin, action.actionOn, action.targetValue);
				}
			}
		}

		if (allPins.length === 0) continue;

		const digitalPins = allPins.filter((p) => p.analogValue === undefined);
		const analogPins = allPins.filter((p) => p.analogValue !== undefined);

		if (digitalPins.length > 0) {
			const count = Math.min(digitalPins.length, 32);
			const payload = new Uint8Array(2 + count * 2);
			payload[0] = 0x08;
			payload[1] = count;
			for (let i = 0; i < count; i++) {
				payload[2 + i * 2] = digitalPins[i].pin & 0xff;
				payload[3 + i * 2] = digitalPins[i].state ? 1 : 0;
			}
			broadcastBinary(sockets, payload);
		}

		for (const ap of analogPins) {
			broadcastBinary(sockets, encodeAnalogFrame(ap.pin, ap.analogValue!));
		}

		await storage.put("pending_automation_states", allPins);
	}

	if (automationsChanged) {
		await storage.put("automations", automations);
	}

	await scheduleNextAlarm(storage);
}
