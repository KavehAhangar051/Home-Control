/**
 * @file types.ts
 * تعریف تمام type ها و interface های مشترک worker
 */

export type DigitalHoldTime = -1 | 0 | 3 | 5 | 10;
export type RuleActionType = 0 | 1 | 2;
export type AnalogRangeTriggerMode = 0 | 1;
export type ConditionLogic = "and" | "or";

export type MacroNumericOperator = "gt" | "gte" | "lt" | "lte" | "eq" | "between" | "outside";
export type MacroAnalogOutputOperator = "is_on" | "is_off" | MacroNumericOperator;

export interface RuleGuardCondition {
	enabled?: boolean;
	parameter: "digital_input" | "analog_input" | "digital_output" | "analog_output";
	sourcePin: string | number;
	expectedState?: boolean;
	operator?: MacroAnalogOutputOperator;
	unit?: "raw" | "percent";
	value?: number;
	maxValue?: number;
}

/** یک اکشن قابل اجرا بر روی پین هدف (پشتیبانی از حالت دیجیتال، دابل‌کلیک، PWM و شرطی) */
export interface RuleAction {
	targetPin: string | number;
	requiredHoldTime?: DigitalHoldTime | number;
	reqHold?: DigitalHoldTime | number;
	actionState?: boolean;
	actionOn?: boolean;
	actionType?: RuleActionType | number;
	delay?: number;
	targetValue?: number | null;
	aval?: number;
	conditions?: RuleGuardCondition[];
	conditionLogic?: ConditionLogic;
}

/** یک قانون بازه‌ای برای سگمنت‌های ورودی آنالوگ (analog_input) */
export interface AnalogRangeRule {
	minValue: number;
	maxValue: number;
	hysteresis?: number;
	triggerMode: AnalogRangeTriggerMode | "enter" | "exit" | number;
	targetPin: string | number;
	actionState?: boolean;
	actionOn?: boolean;
	targetValue?: number | null;
	aval?: number;
	actionType?: RuleActionType | number;
	delay?: number;
	enabled?: boolean;
	conditions?: RuleGuardCondition[];
	conditionLogic?: ConditionLogic;
}

/** قانون مرتبط با یک پین (اکشن‌های high/low و بازه‌های آنالوگ) */
export interface PinRule {
	active?: boolean;
	highActions?: RuleAction[];
	lowActions?: RuleAction[];
	analogRanges?: AnalogRangeRule[];
}

export type AuxChipType =
	| "unknown"
	| "esp8266_01"
	| "esp8266_12"
	| "esp32"
	| "esp32_c3"
	| "esp32_s3";

export const AUX_CHIP_CODE_MAP: Readonly<Record<AuxChipType, number>> = {
	unknown: 0,
	esp8266_01: 1,
	esp8266_12: 2,
	esp32: 3,
	esp32_c3: 4,
	esp32_s3: 5,
};

/** تنظیمات یک برد کمکی ESP (فاز ۱ سگمنت‌های مجازی) */
export interface AuxNodeConfig {
	nodeId?: number;
	id?: number;
	name?: string;
	mac: string;
	pinCapacity: number;
	chipType?: AuxChipType | number;
	groupName?: string;
	online?: boolean;
}

/** تنظیمات یک پین در کانفیگ اصلی */
export interface PinConfig {
	id: string;
	type: string;
	pin: string | number;
	state?: boolean;
	auto_off?: number;
	autoOffDelay?: number;
	analogValue?: number;
	lastNonZeroValue?: number;
	pwmResolution?: number;
	pwmFrequency?: number;
	adcResolution?: number;
	adcSampleIntervalMs?: number;
	adcDeltaThreshold?: number;
	adcHighThreshold?: number;
	adcLowThreshold?: number;
	isVirtual?: boolean;
	nodeId?: number;
	remotePin?: number;
	rule?: PinRule;
}

/** وضعیت ذخیره‌شده یک پین در Durable Object */
export interface PinState {
	value?: boolean;
	analogValue?: number;
	lastNonZeroValue?: number;
	resolution?: number;
}

/** یک اتوماسیون زمانبندی‌شده */
export interface Automation {
	id: string;
	title?: string;
	time: string;
	days: number[];
	enabled: boolean;
	repeatCount?: number;
	targetTimestamp?: number;
	intervalMinutes?: number;
	conditionType?: "time" | "weather";
	city?: string;
	temperatureThreshold?: number;
	temperatureCondition?: "greater" | "less";
	segmentConditions?: RuleGuardCondition[];
	segmentConditionLogic?: ConditionLogic;
	actions: Array<{
		targetPin?: string;
		targetMacro?: string;
		actionOn?: boolean;
		targetValue?: number | null;
	}>;
}

/** تنظیمات عملیات HTTP/HTTPS در ماکروها (مثلاً کنترل WLED یا وب‌هوک‌ها) */
export interface MacroHttpRequestConfig {
	label?: string;
	method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	url: string;
	contentType?: string;
	headers?: Array<{ key: string; value: string }>;
	body?: string;
	timeoutMs?: number;
}

/** یک ماکرو (دکمه سفارشی) */
export interface Macro {
	id: string;
	title: string;
	icon?: string;
	actions: Array<{
		actionKind?: "segment" | "http";
		targetPin: string;
		actionOn: boolean;
		targetValue?: number | null;
		analogMode?: "set" | "step" | "power";
		stepDelta?: number;
		stepUnit?: "percent" | "raw";
		powerToggle?: boolean;
		httpRequest?: MacroHttpRequestConfig;
	}>;
}
