/**
 * @file durable-object/alarm-manager.ts
 * منطق زمانبندی و اجرای اتوماسیون‌ها از طریق DO Alarms
 * پشتیبانی از فرمان دسته‌ای دیجیتال (0x08) و فرمان PWM آنالوگ (0x0A) روی پین‌های 0..127
 */

import { getNextTriggerTimestamp } from "../utils/scheduler";
import { getCurrentTemperature } from "../utils/weather";
import {
	evaluateAutomationSegmentConditions,
	fetchPinStatesIntoCache,
	loadSegmentLookup,
} from "../utils/segment-conditions";
import type { Automation, Macro, MacroHttpRequestConfig, PinConfig, PinState } from "../types";

/** ساختار داخلی برای نگه‌داشتن زمان محاسبه‌شده هر اتوماسیون */
interface ScheduledEntry {
	id: string;
	title: string;
	ts: number;
}

export interface ScheduleSummary {
	activeCount: number;
	scheduledCount: number;
	nextTime: number | null;
	nextAlarmIds: string[];
	nextAlarmTitles: string[];
}

export interface PendingAutomationPin {
	pin: number;
	state: boolean;
	analogValue?: number;
}

/**
 * محاسبه و ثبت آلارم بعدی بر اساس لیست اتوماسیون‌های فعال.
 */
export async function scheduleNextAlarm(storage: DurableObjectStorage): Promise<ScheduleSummary> {
	const automations = (await storage.get<Automation[]>("automations")) ?? [];
	const activeAutomations = automations.filter((a) => a.enabled);

	if (activeAutomations.length === 0) {
		await storage.deleteAlarm();
		return {
			activeCount: 0,
			scheduledCount: 0,
			nextTime: null,
			nextAlarmIds: [],
			nextAlarmTitles: [],
		};
	}

	const now = new Date();
	const scheduled: ScheduledEntry[] = activeAutomations
		.map((auto) => ({
			id: auto.id,
			title: auto.title || auto.id,
			ts: getNextTriggerTimestamp(auto.time, auto.days, now, auto.intervalMinutes, {
				repeatCount: auto.repeatCount,
				targetTimestamp: auto.targetTimestamp,
			}),
		}))
		.filter((entry): entry is ScheduledEntry => entry.ts !== null);

	if (scheduled.length === 0) {
		await storage.deleteAlarm();
		return {
			activeCount: activeAutomations.length,
			scheduledCount: 0,
			nextTime: null,
			nextAlarmIds: [],
			nextAlarmTitles: [],
		};
	}

	const nextTime = Math.min(...scheduled.map((e) => e.ts));
	const nextEntries = scheduled.filter((e) => e.ts === nextTime);
	const nextAlarmIds = nextEntries.map((e) => e.id);
	const nextAlarmTitles = nextEntries.map((e) => e.title);

	await Promise.all([
		storage.put("nextAlarmTime", nextTime),
		storage.put("nextAlarmIds", nextAlarmIds),
		storage.setAlarm(nextTime),
	]);

	return {
		activeCount: activeAutomations.length,
		scheduledCount: scheduled.length,
		nextTime,
		nextAlarmIds,
		nextAlarmTitles,
	};
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

function broadcastText(sockets: WebSocket[], message: string): void {
	for (const ws of sockets) {
		try {
			ws.send(message);
		} catch {
			// اتصال قطع شده — نادیده گرفته می‌شود
		}
	}
}

function encodeAnalogFrame(pin: number, value: number): Uint8Array {
	const clamped = Math.max(0, Math.min(4095, Math.round(value)));
	return new Uint8Array([0x0a, pin & 0xff, clamped & 0xff, (clamped >> 8) & 0xff]);
}

async function resolveExtendedMacroPinAction(
	ma: Macro["actions"][number],
	env: Env | undefined,
	pinStateCache: Map<string, PinState>,
	segmentMetaPromise: { cached?: Promise<Map<number, PinConfig>> }
): Promise<PendingAutomationPin | null> {
	const pin = Number.parseInt(ma.targetPin ?? "", 10);
	if (!Number.isInteger(pin) || pin < 0 || pin > 127) return null;
	const pinKey = String(pin);

	if (ma.analogMode === "step" && typeof ma.stepDelta === "number" && Number.isFinite(ma.stepDelta) && ma.stepDelta !== 0) {
		if (!segmentMetaPromise.cached) {
			segmentMetaPromise.cached = loadSegmentLookup(env?.DASH_KV);
		}
		const [segmentByPin] = await Promise.all([
			segmentMetaPromise.cached,
			fetchPinStatesIntoCache([pinKey], env, pinStateCache),
		]);
		const seg = segmentByPin.get(pin);
		const liveState = pinStateCache.get(pinKey);
		const resRaw = Number(liveState?.resolution ?? seg?.pwmResolution ?? 8);
		const resolution = Number.isFinite(resRaw) ? Math.min(12, Math.max(8, Math.round(resRaw))) : 8;
		const maxDuty = (1 << resolution) - 1;
		const isOff = liveState?.value === false;
		const baseDuty = isOff
			? 0
			: Math.min(
					maxDuty,
					Math.max(0, Math.round(Number(liveState?.analogValue ?? seg?.analogValue ?? 0) || 0))
			  );
		const delta = Math.round(ma.stepDelta);
		const nextDuty =
			ma.stepUnit === "raw"
				? Math.min(maxDuty, Math.max(0, baseDuty + delta))
				: Math.round(
						(Math.min(100, Math.max(0, Math.round((baseDuty / maxDuty) * 100) + delta)) / 100) * maxDuty
				  );
		pinStateCache.set(pinKey, { ...liveState, value: nextDuty > 0, analogValue: nextDuty, resolution });
		return { pin, state: nextDuty > 0, analogValue: nextDuty };
	}

	if (ma.analogMode === "power") {
		if (ma.powerToggle) {
			await fetchPinStatesIntoCache([pinKey], env, pinStateCache);
			const liveState = pinStateCache.get(pinKey);
			const nextOn = !(liveState?.value === true);
			pinStateCache.set(pinKey, { ...liveState, value: nextOn });
			return { pin, state: nextOn };
		}
		return { pin, state: !!ma.actionOn };
	}

	if (typeof ma.targetValue === "number" && Number.isFinite(ma.targetValue) && ma.targetValue >= 0) {
		const clamped = Math.min(4095, Math.round(ma.targetValue));
		return { pin, state: clamped > 0, analogValue: clamped };
	}

	return { pin, state: !!ma.actionOn };
}

async function executeMacroHttpRequest(req: MacroHttpRequestConfig | undefined): Promise<boolean> {
	if (!req || !req.url) return false;
	const trimmedUrl = req.url.trim();
	if (!/^https?:\/\//i.test(trimmedUrl)) return false;

	const controller = new AbortController();
	const timeoutMs =
		typeof req.timeoutMs === "number" && Number.isFinite(req.timeoutMs)
			? Math.min(15000, Math.max(500, Math.round(req.timeoutMs)))
			: 5000;
	const timer = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const headers = new Headers();
		if (req.contentType && req.method !== "GET" && req.body) {
			headers.set("Content-Type", req.contentType);
		}
		for (const h of req.headers ?? []) {
			if (h?.key?.trim()) headers.set(h.key.trim(), String(h.value ?? ""));
		}

		const resp = await fetch(trimmedUrl, {
			method: req.method || "GET",
			headers,
			body: req.method !== "GET" && req.body ? req.body : undefined,
			signal: controller.signal,
		});
		return resp.ok;
	} catch (err) {
		console.warn(`[Automation] HTTP macro request failed (${trimmedUrl}):`, err);
		return false;
	} finally {
		clearTimeout(timer);
	}
}

async function syncUpdatedAutomationsToKv(dashKv: KVNamespace | undefined, automations: Automation[]): Promise<void> {
	if (!dashKv) return;
	try {
		const raw = await dashKv.get("main_config");
		if (!raw) return;
		const parsed = JSON.parse(raw) as Record<string, any>;
		if (parsed?.payload && Array.isArray(parsed.payload.automations)) {
			parsed.payload.automations = automations;
		} else {
			parsed.automations = automations;
		}
		await dashKv.put("main_config", JSON.stringify(parsed));
	} catch (err) {
		console.error("[Automation] Failed to sync expired automation state to KV:", err);
	}
}

/**
 * اجرای اتوماسیون‌هایی که الان باید فعال شوند و ارسال payload به ESP از طریق WebSocket.
 */
export async function fireAlarm(
	storage: DurableObjectStorage,
	getWebSockets: () => WebSocket[],
	env?: Env
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
	const pinStateCache = new Map<string, PinState>();
	const segmentMetaPromise: { cached?: Promise<Map<number, PinConfig>> } = {};
	const allPendingPins: PendingAutomationPin[] = [];

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

		if (Array.isArray(auto.segmentConditions) && auto.segmentConditions.length > 0) {
			const segmentConditionsMet = await evaluateAutomationSegmentConditions(
				auto.segmentConditions,
				auto.segmentConditionLogic,
				env,
				pinStateCache,
				segmentMetaPromise
			);
			if (!segmentConditionsMet) {
				console.log(`[Automation] Skipped ${auto.id} due to segment condition(s)`);
				broadcastText(
					sockets,
					`[Worker][Automation] Skipped "${auto.title || auto.id}" (segment condition not met)`
				);
				continue;
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
		const httpRequests: MacroHttpRequestConfig[] = [];

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
							if (ma.actionKind === "http") {
								if (ma.httpRequest) httpRequests.push(ma.httpRequest);
								continue;
							}
							const resolved = await resolveExtendedMacroPinAction(ma, env, pinStateCache, segmentMetaPromise);
							if (resolved) allPins.push(resolved);
						}
					}
				} else {
					pushPinAction(action.targetPin, action.actionOn, action.targetValue);
				}
			}
		}

		if (httpRequests.length > 0) {
			await Promise.allSettled(httpRequests.map((req) => executeMacroHttpRequest(req)));
		}

		if (allPins.length === 0) {
			if (httpRequests.length > 0) {
				broadcastText(
					sockets,
					`[Worker][Automation] Executed "${auto.title || auto.id}" (${httpRequests.length} HTTP request(s))`
				);
			}
			continue;
		}

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

		broadcastText(
			sockets,
			`[Worker][Automation] Executed "${auto.title || auto.id}" (${allPins.length} pin(s))`
		);

		allPendingPins.push(...allPins);
	}

	if (allPendingPins.length > 0) {
		await storage.put("pending_automation_states", allPendingPins);

		if (env?.MY_DURABLE_OBJECT && sockets.length > 0) {
			await Promise.all(
				allPendingPins.map(async (p) => {
					const pinDo = env.MY_DURABLE_OBJECT.get(env.MY_DURABLE_OBJECT.idFromName("pin_" + p.pin));
					const update: Record<string, unknown> = { value: p.state };
					if (typeof p.analogValue === "number" && Number.isFinite(p.analogValue)) {
						update.analogValue = p.analogValue;
						if (p.analogValue > 0) update.lastNonZeroValue = p.analogValue;
					}
					await (pinDo as any).setState(update);
				})
			);
		}
	}

	if (automationsChanged) {
		await Promise.all([
			storage.put("automations", automations),
			syncUpdatedAutomationsToKv(env?.DASH_KV, automations),
		]);
	}

	await scheduleNextAlarm(storage);
}
