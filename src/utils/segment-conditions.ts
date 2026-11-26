/**
 * @file utils/segment-conditions.ts
 * ارزیابی شرط‌های وضعیت سگمنت‌های ورودی/خروجی (دیجیتال و آنالوگ) در Cloudflare Worker
 * با خواندن آخرین وضعیت واقعی پین‌ها از Durable Object.
 */

import type {
	ConditionLogic,
	MacroAnalogOutputOperator,
	PinConfig,
	PinState,
	RuleGuardCondition,
} from "../types";
import { isAnalogInputType, isAnalogOutputType, parseManagedPin } from "./esp-config";

const MAX_ANALOG_VALUE = 4095;

function clampInt(val: unknown, min: number, max: number, fallback: number): number {
	const num = Number(val);
	if (!Number.isFinite(num)) return fallback;
	return Math.min(max, Math.max(min, Math.round(num)));
}

function compareNumeric(actual: number, op: MacroAnalogOutputOperator, threshold: number, maxVal: number): boolean {
	switch (op) {
		case "gt":
			return actual > threshold;
		case "gte":
			return actual >= threshold;
		case "lt":
			return actual < threshold;
		case "lte":
			return actual <= threshold;
		case "eq":
			return actual === threshold;
		case "between":
			return actual >= Math.min(threshold, maxVal) && actual <= Math.max(threshold, maxVal);
		case "outside":
			return actual < Math.min(threshold, maxVal) || actual > Math.max(threshold, maxVal);
		default:
			return false;
	}
}

function evaluateSingleCondition(
	cond: RuleGuardCondition,
	pinState: PinState | undefined,
	segment: PinConfig | undefined
): boolean {
	const isOn = pinState?.value === true;

	if (cond.parameter === "digital_input" || cond.parameter === "digital_output") {
		const expected = cond.expectedState !== false;
		return isOn === expected;
	}

	const op: MacroAnalogOutputOperator =
		cond.operator ?? (cond.parameter === "analog_output" ? "is_on" : "gt");

	if (cond.parameter === "analog_output") {
		const analogIsOn = isOn || (typeof pinState?.analogValue === "number" && pinState.analogValue > 0);
		if (op === "is_on") return analogIsOn;
		if (op === "is_off") return !analogIsOn;
	}

	const isAdc = cond.parameter === "analog_input" || (segment ? isAnalogInputType(segment.type) : false);
	const defaultRes = isAdc ? 12 : 8;
	const res = clampInt(
		pinState?.resolution ?? (isAdc ? segment?.adcResolution : segment?.pwmResolution),
		8,
		12,
		defaultRes
	);
	const maxScale = (1 << res) - 1;

	let actualRaw = 0;
	if (typeof pinState?.analogValue === "number" && Number.isFinite(pinState.analogValue)) {
		actualRaw = clampInt(pinState.analogValue, 0, MAX_ANALOG_VALUE, 0);
	} else if (cond.parameter === "analog_output" && isOn) {
		actualRaw = clampInt(pinState?.lastNonZeroValue ?? segment?.lastNonZeroValue, 0, maxScale, maxScale);
	}

	const resolveThreshold = (raw: unknown): number => {
		const num = Number(raw);
		if (!Number.isFinite(num)) return 0;
		if (cond.unit !== "raw") {
			const pct = Math.min(100, Math.max(0, Math.round(num)));
			return Math.round((pct / 100) * maxScale);
		}
		return clampInt(num, 0, MAX_ANALOG_VALUE, 0);
	};

	const threshold = resolveThreshold(cond.value ?? 0);
	const maxThreshold =
		op === "between" || op === "outside" ? resolveThreshold(cond.maxValue ?? cond.value ?? 0) : threshold;

	return compareNumeric(actualRaw, op, threshold, maxThreshold);
}

async function loadSegmentLookup(dashKv: KVNamespace | undefined): Promise<Map<number, PinConfig>> {
	const map = new Map<number, PinConfig>();
	if (!dashKv) return map;
	try {
		const raw = await dashKv.get("main_config");
		if (!raw) return map;
		const parsed = JSON.parse(raw) as Record<string, any>;
		const data = parsed?.payload ?? parsed ?? {};
		const defs: PinConfig[] = data.segments_definition ?? data.segments ?? [];
		if (!Array.isArray(defs)) return map;
		for (const seg of defs) {
			if (!seg || seg.type === "placeholder") continue;
			const pinNum = parseManagedPin(seg.pin);
			if (pinNum !== null && (isAnalogInputType(seg.type) || isAnalogOutputType(seg.type))) {
				map.set(pinNum, seg);
			}
		}
	} catch (err) {
		console.error("[Automation] Failed to read segment metadata from KV:", err);
	}
	return map;
}

/**
 * ارزیابی لیست شرط‌های سگمنت یک اتوماسیون با استفاده از آخرین وضعیت ذخیره‌شده در DO.
 */
export async function evaluateAutomationSegmentConditions(
	conditions: RuleGuardCondition[] | undefined,
	logic: ConditionLogic | undefined,
	env: Env | undefined,
	pinStateCache: Map<string, PinState>,
	segmentMetaPromise: { cached?: Promise<Map<number, PinConfig>> }
): Promise<boolean> {
	const active = (conditions ?? []).filter((c) => c && c.enabled !== false);
	if (active.length === 0) return true;
	if (!env?.MY_DURABLE_OBJECT) return false;

	const uniquePins = new Set<string>();
	for (const cond of active) {
		const pinNum = parseManagedPin(cond.sourcePin);
		if (pinNum !== null) {
			const key = String(pinNum);
			if (!pinStateCache.has(key)) uniquePins.add(key);
		}
	}

	if (!segmentMetaPromise.cached) {
		segmentMetaPromise.cached = loadSegmentLookup(env.DASH_KV);
	}

	const [segmentByPin] = await Promise.all([
		segmentMetaPromise.cached,
		Promise.all(
			Array.from(uniquePins).map(async (pinKey) => {
				try {
					const stub = env.MY_DURABLE_OBJECT.get(
						env.MY_DURABLE_OBJECT.idFromName("pin_" + pinKey)
					);
					const state = (await (stub as any).getState()) as PinState;
					pinStateCache.set(pinKey, state ?? {});
				} catch {
					pinStateCache.set(pinKey, {});
				}
			})
		),
	]);

	const results: boolean[] = [];
	for (const cond of active) {
		const pinNum = parseManagedPin(cond.sourcePin);
		if (pinNum === null) {
			results.push(false);
			continue;
		}
		const pinKey = String(pinNum);
		const passed = evaluateSingleCondition(cond, pinStateCache.get(pinKey), segmentByPin.get(pinNum));
		results.push(passed);
	}

	return logic === "or" ? results.some(Boolean) : results.every(Boolean);
}

