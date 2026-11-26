/**
 * @file utils/esp-config.ts
 * تولید متن پیکربندی استاندارد ESP_CFG_V2 برای فریم‌ور ESP32.
 * پشتیبانی کامل از:
 * - بردهای کمکی (خطوط E ) و سگمنت‌های مجازی (virt=1 node=... rpin=...)
 * - خروجی آنالوگ PWM (analog_output) و ورودی آنالوگ ADC (analog_input)
 * - قوانین نسخه ۲ شامل دابل‌کلیک (hld=-1)، اکشن‌های PWM (aval=...)،
 *   قوانین چندبازه‌ای آنالوگ (خطوط RR ) و پیش‌شرط‌های ترکیبی (cnd/clog)
 */

import {
	AUX_CHIP_CODE_MAP,
	type AnalogRangeRule,
	type AuxChipType,
	type AuxNodeConfig,
	type ConditionLogic,
	type MacroAnalogOutputOperator,
	type PinConfig,
	type PinState,
	type RuleAction,
	type RuleGuardCondition,
} from "../types";

const LOCAL_GPIO_MAX = 39;
const VIRTUAL_PIN_MIN = 40;
const VIRTUAL_PIN_MAX = 127;
const MAX_AUX_NODES = 16;
const MAX_RULE_ACTIONS_PER_SIDE = 4;
const MAX_ANALOG_RANGE_RULES = 6;
const MAX_RULE_CONDITIONS_PER_ACTION = 4;
const MAX_ANALOG_VALUE = 4095;
const VALID_HOLD_TIMES = new Set([-1, 0, 3, 5, 10]);

const RULE_CONDITION_OP_CODE: Readonly<Record<MacroAnalogOutputOperator, number>> = {
	is_on: 0,
	is_off: 1,
	gt: 2,
	gte: 3,
	lt: 4,
	lte: 5,
	eq: 6,
	between: 7,
	outside: 8,
};

const clampInt = (val: unknown, min: number, max: number, fallback: number): number => {
	const num = Number(val);
	if (!Number.isFinite(num)) return fallback;
	return Math.min(max, Math.max(min, Math.round(num)));
};

export const parseManagedPin = (raw: unknown): number | null => {
	if (raw === null || raw === undefined) return null;
	const str = String(raw).trim();
	if (!/^\d+$/.test(str)) return null;
	const pin = Number.parseInt(str, 10);
	return pin >= 0 && pin <= VIRTUAL_PIN_MAX ? pin : null;
};

export const isAnalogOutputType = (type: string): boolean =>
	type === "analog_output" || type === "pwm_output";

export const isAnalogInputType = (type: string): boolean =>
	type === "analog_input" || type === "adc_input";

const normalizeUnicastMac = (rawMac: unknown): string | null => {
	if (typeof rawMac !== "string") return null;
	const cleaned = rawMac.trim().replace(/[:-]/g, "").toUpperCase();
	if (!/^[0-9A-F]{12}$/.test(cleaned)) return null;

	const bytes: number[] = [];
	for (let i = 0; i < 6; i++) {
		bytes.push(Number.parseInt(cleaned.slice(i * 2, i * 2 + 2), 16));
	}
	if (bytes.every((b) => b === 0x00) || bytes.every((b) => b === 0xff)) return null;
	if ((bytes[0] & 0x01) !== 0) return null;

	return bytes.map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(":");
};

const truncateUtf8ByBytes = (input: string, maxBytes: number): string => {
	const encoder = new TextEncoder();
	let result = "";
	let byteCount = 0;
	for (const ch of input) {
		const chBytes = encoder.encode(ch).length;
		if (byteCount + chBytes > maxBytes) break;
		result += ch;
		byteCount += chBytes;
	}
	return result;
};

const buildAuxNodeLines = (rawAuxNodes: unknown): string => {
	if (!Array.isArray(rawAuxNodes)) return "";

	const validNodes: Array<{ nodeId: number; mac: string; cap: number; chip: number; name: string }> = [];
	const seenIds = new Set<number>();

	for (const raw of rawAuxNodes as AuxNodeConfig[]) {
		if (!raw || typeof raw !== "object") continue;
		const nodeId = clampInt(raw.nodeId ?? raw.id, 0, MAX_AUX_NODES, 0);
		if (nodeId < 1 || seenIds.has(nodeId)) continue;
		const mac = normalizeUnicastMac(raw.mac);
		if (!mac) continue;

		seenIds.add(nodeId);
		const cap = clampInt(raw.pinCapacity, 1, 32, 4);
		const chip =
			typeof raw.chipType === "number"
				? clampInt(raw.chipType, 0, 5, 0)
				: (AUX_CHIP_CODE_MAP[(raw.chipType as AuxChipType) ?? "unknown"] ?? 0);
		const cleanName = truncateUtf8ByBytes(
			(raw.name || `Node_${nodeId}`).trim().replace(/\s+/g, "_"),
			31
		) || `Node_${nodeId}`;

		validNodes.push({ nodeId, mac, cap, chip, name: cleanName });
	}

	let text = `E n=${validNodes.length}\n`;
	for (const n of validNodes) {
		text += `E id=${n.nodeId} mac=${n.mac} cap=${n.cap} chip=${n.chip} name=${encodeURIComponent(n.name)}\n`;
	}
	return text;
};

const buildConditionSuffix = (
	conditions: RuleGuardCondition[] | undefined,
	conditionLogic: ConditionLogic | undefined,
	segmentByPin: Map<number, PinConfig>
): string => {
	if (!Array.isArray(conditions) || conditions.length === 0) return "";

	const items: string[] = [];
	for (const cond of conditions) {
		if (items.length >= MAX_RULE_CONDITIONS_PER_ACTION) break;
		if (!cond || cond.enabled === false) continue;

		const sourcePin = parseManagedPin(cond.sourcePin);
		if (sourcePin === null) continue;

		if (cond.parameter === "digital_input" || cond.parameter === "digital_output") {
			const opCode = cond.expectedState ? 0 : 1;
			items.push(`${sourcePin}:${opCode}:0:0`);
			continue;
		}

		const op: MacroAnalogOutputOperator =
			cond.operator ?? (cond.parameter === "analog_output" ? "is_on" : "gt");
		const opCode = RULE_CONDITION_OP_CODE[op] ?? 2;

		if (op === "is_on" || op === "is_off") {
			items.push(`${sourcePin}:${opCode}:0:0`);
			continue;
		}

		const matchedSeg = segmentByPin.get(sourcePin);
		const res =
			cond.parameter === "analog_input"
				? clampInt(matchedSeg?.adcResolution, 8, 12, 12)
				: clampInt(matchedSeg?.pwmResolution, 8, 12, 8);
		const maxScale = (1 << res) - 1;

		const resolveVal = (v: unknown): number => {
			const num = Number(v);
			if (!Number.isFinite(num)) return 0;
			if (cond.unit !== "raw") {
				const pct = Math.min(100, Math.max(0, Math.round(num)));
				return Math.round((pct / 100) * maxScale);
			}
			return clampInt(num, 0, MAX_ANALOG_VALUE, 0);
		};

		const val = resolveVal(cond.value ?? 0);
		const maxVal = op === "between" || op === "outside" ? resolveVal(cond.maxValue ?? val) : 0;
		const low = op === "between" || op === "outside" ? Math.min(val, maxVal) : val;
		const high = op === "between" || op === "outside" ? Math.max(val, maxVal) : 0;
		items.push(`${sourcePin}:${opCode}:${low}:${high}`);
	}

	if (items.length === 0) return "";
	let suffix = ` cnd=${items.join(",")}`;
	if (conditionLogic === "or" && items.length > 1) {
		suffix += " clog=or";
	}
	return suffix;
};

const resolveAnalogTarget = (rawTargetValue: unknown): number | null => {
	if (rawTargetValue === null || rawTargetValue === undefined) return null;
	const num = Number(rawTargetValue);
	if (!Number.isFinite(num) || num < 0) return null;
	return Math.min(MAX_ANALOG_VALUE, Math.round(num));
};

const buildSegmentLine = (seg: PinConfig, pinNum: number, pinState: PinState): string => {
	const ao = clampInt(seg.auto_off ?? seg.autoOffDelay, 0, 86400, 0);
	let line: string;

	if (isAnalogOutputType(seg.type)) {
		const res = clampInt(seg.pwmResolution, 8, 12, 8);
		const freq = clampInt(seg.pwmFrequency, 100, 40000, 5000);
		const maxScale = (1 << res) - 1;

		let val = 0;
		if (typeof pinState.analogValue === "number" && Number.isFinite(pinState.analogValue)) {
			val = clampInt(pinState.analogValue, 0, maxScale, 0);
		} else if (pinState.value === true) {
			val = clampInt(seg.analogValue ?? seg.lastNonZeroValue, 0, maxScale, maxScale);
		} else if (pinState.value === undefined && typeof seg.analogValue === "number") {
			val = clampInt(seg.analogValue, 0, maxScale, 0);
		}

		line = `S id=${seg.id} type=analog_output pin=${pinNum} val=${val} res=${res} freq=${freq} ao=${ao}`;
	} else if (isAnalogInputType(seg.type)) {
		const res = clampInt(seg.adcResolution, 8, 12, 12);
		const maxScale = (1 << res) - 1;
		const sint = clampInt(seg.adcSampleIntervalMs, 50, 60000, 500);
		const delta = clampInt(seg.adcDeltaThreshold, 1, maxScale, Math.min(40, maxScale));
		const ath = clampInt(seg.adcHighThreshold, 0, maxScale, 0);
		const atl = ath === 0 ? 0 : clampInt(seg.adcLowThreshold, 0, ath, 0);

		line = `S id=${seg.id} type=analog_input pin=${pinNum} res=${res} sint=${sint} delta=${delta} ath=${ath} atl=${atl}`;
	} else {
		const val = (pinState.value ?? seg.state) ? 1 : 0;
		line = `S id=${seg.id} type=${seg.type} pin=${pinNum} val=${val} ao=${ao}`;
	}

	const isVirtual = seg.isVirtual === true || pinNum >= VIRTUAL_PIN_MIN;
	const nodeId = clampInt(seg.nodeId, 0, MAX_AUX_NODES, 0);
	const remotePin = parseManagedPin(seg.remotePin);
	if (isVirtual && pinNum >= VIRTUAL_PIN_MIN && nodeId >= 1 && remotePin !== null && remotePin <= LOCAL_GPIO_MAX) {
		line += ` virt=1 node=${nodeId} rpin=${remotePin}`;
	}

	return line + "\n";
};

const buildDigitalRuleActionLine = (
	prefix: "RH" | "RL",
	act: RuleAction,
	segmentByPin: Map<number, PinConfig>
): string => {
	const targetPin = parseManagedPin(act.targetPin);
	if (targetPin === null) return "";

	const rawHold = Number(act.reqHold ?? act.requiredHoldTime ?? 0);
	const hld = VALID_HOLD_TIMES.has(rawHold) ? rawHold : 0;
	const atp = clampInt(act.actionType, 0, 2, 0);
	const dly = clampInt(act.delay, 0, 60, 0);
	const targetVal = resolveAnalogTarget(act.targetValue ?? act.aval);

	const statePart =
		targetVal !== null
			? `ast=${targetVal > 0 ? 1 : 0} aval=${targetVal}`
			: `ast=${(act.actionState ?? act.actionOn) ? 1 : 0}`;

	const condSuffix = buildConditionSuffix(act.conditions, act.conditionLogic, segmentByPin);
	return `${prefix} tgt=${targetPin} hld=${hld} ${statePart} atp=${atp} dly=${dly}${condSuffix}\n`;
};

const buildAnalogRangeRuleLine = (
	range: AnalogRangeRule,
	maxAdcScale: number,
	segmentByPin: Map<number, PinConfig>
): string => {
	if (!range || range.enabled === false) return "";
	const targetPin = parseManagedPin(range.targetPin);
	if (targetPin === null) return "";

	const rawMin = clampInt(range.minValue, 0, maxAdcScale, 0);
	const rawMax = clampInt(range.maxValue, 0, maxAdcScale, maxAdcScale);
	const minVal = Math.min(rawMin, rawMax);
	const maxVal = Math.max(rawMin, rawMax);
	const hyst = clampInt(range.hysteresis, 0, Math.floor(maxAdcScale / 2), 0);
	const trg = range.triggerMode === 1 || range.triggerMode === "exit" ? "exit" : "enter";
	const atp = clampInt(range.actionType, 0, 2, 0);
	const dly = clampInt(range.delay, 0, 60, 0);
	const targetVal = resolveAnalogTarget(range.targetValue ?? range.aval);

	const targetPart =
		targetVal !== null
			? `aval=${targetVal}`
			: `ast=${(range.actionState ?? range.actionOn ?? true) ? 1 : 0}`;

	const condSuffix = buildConditionSuffix(range.conditions, range.conditionLogic, segmentByPin);
	return `RR min=${minVal} max=${maxVal} hyst=${hyst} tgt=${targetPin} ${targetPart} trg=${trg} atp=${atp} dly=${dly}${condSuffix}\n`;
};

const buildRuleLines = (seg: PinConfig, segmentByPin: Map<number, PinConfig>): string => {
	if (!seg.rule) return "";
	let lines = "";

	for (const act of (seg.rule.highActions ?? []).slice(0, MAX_RULE_ACTIONS_PER_SIDE)) {
		lines += buildDigitalRuleActionLine("RH", act, segmentByPin);
	}
	for (const act of (seg.rule.lowActions ?? []).slice(0, MAX_RULE_ACTIONS_PER_SIDE)) {
		lines += buildDigitalRuleActionLine("RL", act, segmentByPin);
	}

	if (isAnalogInputType(seg.type) && Array.isArray(seg.rule.analogRanges)) {
		const res = clampInt(seg.adcResolution, 8, 12, 12);
		const maxAdcScale = (1 << res) - 1;
		let count = 0;
		for (const range of seg.rule.analogRanges) {
			if (count >= MAX_ANALOG_RANGE_RULES) break;
			const rrLine = buildAnalogRangeRuleLine(range, maxAdcScale, segmentByPin);
			if (rrLine) {
				lines += rrLine;
				count++;
			}
		}
	}

	return lines;
};

/**
 * ساخت متن فرمت ESP_CFG_V2 برای ارسال به میکروکنترلر.
 * وضعیت همه پین‌ها به‌صورت موازی از Durable Object خوانده می‌شود.
 */
export async function buildEspConfigText(env: Env, value: string | null): Promise<string> {
	const parsed = JSON.parse(value ?? "{}");
	const data = parsed?.payload ?? parsed ?? {};
	const segmentDefinitions = data.segments_definition ?? data.segments;
	const rawSegments: PinConfig[] = Array.isArray(segmentDefinitions) ? segmentDefinitions : [];

	const activeSegments: Array<{ seg: PinConfig; pinNum: number }> = [];
	const segmentByPin = new Map<number, PinConfig>();

	for (const seg of rawSegments) {
		if (!seg || seg.type === "placeholder") continue;
		const pinNum = parseManagedPin(seg.pin);
		if (pinNum === null || !seg.id || !seg.type) continue;
		activeSegments.push({ seg, pinNum });
		segmentByPin.set(pinNum, seg);
	}

	const pinStates = await Promise.all(
		activeSegments.map(async ({ pinNum }) => {
			try {
				const stub = env.MY_DURABLE_OBJECT.get(
					env.MY_DURABLE_OBJECT.idFromName("pin_" + pinNum)
				);
				return (await (stub as any).getState()) as PinState;
			} catch {
				return {} as PinState;
			}
		})
	);

	let text = "ESP_CFG_V2\n";
	text += buildAuxNodeLines(data.auxNodes ?? data.aux_nodes);
	if (Array.isArray(segmentDefinitions)) {
		text += `C n=${activeSegments.length}\n`;
	}

	const encodeValue = (v: string): string => encodeURIComponent(v);

	if (data.mqtt) {
		const m = data.mqtt;
		if (m.broker_host && m.base_topic) {
			text += `M h=${encodeValue(m.broker_host)} p=${m.broker_port || 1883} t=${encodeValue(m.base_topic)} q=${m.qos ?? 1}`;
			const mqttUser = m.username ?? m.user;
			const mqttPass = m.password ?? m.pass;
			if (typeof mqttUser === "string" && mqttUser.length > 0) {
				text += ` u=${encodeValue(mqttUser)}`;
			}
			if (typeof mqttPass === "string" && mqttPass.length > 0) {
				text += ` pw=${encodeValue(mqttPass)}`;
			}
			text += "\n";
		}
	}

	if (data.wifi && Array.isArray(data.wifi.networks)) {
		text += "W n=1\n";
		for (const net of data.wifi.networks.slice(0, 5)) {
			if (net?.ssid) {
				text += `W s=${encodeValue(net.ssid)} p=${encodeValue(net.password ?? "")}\n`;
			}
		}
	}

	const accessPoint = data.wifi?.access_point;
	const mdnsHost = data.wifi?.mdns_host ?? data.mdnsHost ?? data.device?.mdns_host;
	if (accessPoint && typeof accessPoint.ssid === "string" && typeof accessPoint.password === "string") {
		text += `A s=${encodeValue(accessPoint.ssid)} p=${encodeValue(accessPoint.password)}`;
		if (typeof mdnsHost === "string" && mdnsHost.trim().length > 0) {
			text += ` m=${encodeValue(mdnsHost.trim())}`;
		}
		text += "\n";
	} else if (typeof mdnsHost === "string" && mdnsHost.trim().length > 0) {
		text += `N m=${encodeValue(mdnsHost.trim())}\n`;
	}

	for (let i = 0; i < activeSegments.length; i++) {
		const { seg, pinNum } = activeSegments[i];
		text += buildSegmentLine(seg, pinNum, pinStates[i] ?? {});
		text += buildRuleLines(seg, segmentByPin);
	}

	return text;
}

