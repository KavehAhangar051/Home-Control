export type MacroConditionParameter =
  | "time_range"
  | "digital_input"
  | "analog_input"
  | "digital_output"
  | "analog_output";

export type SegmentConditionParameter = Exclude<MacroConditionParameter, "time_range">;

export type ConditionLogic = "and" | "or";

export type MacroNumericOperator = "gt" | "gte" | "lt" | "lte" | "eq" | "between" | "outside";

export type MacroAnalogOutputOperator = "is_on" | "is_off" | MacroNumericOperator;

export type MacroValueUnit = "raw" | "percent";

export interface RuleGuardCondition {
  enabled: boolean;
  parameter: SegmentConditionParameter;
  /** Source segment GPIO pin (`0..127`, local or virtual). */
  sourcePin: string;
  /** Expected boolean state for `digital_input` / `digital_output`. */
  expectedState?: boolean;
  /** Comparison operator for `analog_input` / `analog_output`. */
  operator?: MacroAnalogOutputOperator;
  /** Threshold unit (`"percent"` or `"raw"`) for analog numeric comparisons. */
  unit?: MacroValueUnit;
  /** Primary numeric threshold or lower range bound. */
  value?: number;
  /** Upper range bound for `"between"` / `"outside"` operators. */
  maxValue?: number;
}

export interface MacroActionCondition {
  enabled: boolean;
  parameter: MacroConditionParameter;
  /** Custom user message shown in the dashboard when this condition is not met. */
  failureMessage: string;
  /** Start time ("HH:MM") when `parameter === "time_range"`. */
  startTime?: string;
  /** End time ("HH:MM") when `parameter === "time_range"` (supports overnight windows). */
  endTime?: string;
  /** Match inside or outside the configured time window. */
  timeMode?: "inside" | "outside";
  /** Optional JS weekday numbers (0=Sun..6=Sat); empty or omitted matches every day. */
  days?: number[];
  /** Source segment GPIO pin for segment-based condition parameters. */
  sourcePin?: string;
  /** Expected boolean state for `digital_input` / `digital_output`. */
  expectedState?: boolean;
  /** Comparison operator for `analog_input` / `analog_output`. */
  operator?: MacroAnalogOutputOperator;
  /** Threshold unit (`"percent"` or `"raw"`) for analog numeric comparisons. */
  unit?: MacroValueUnit;
  /** Primary numeric threshold or lower range bound. */
  value?: number;
  /** Upper range bound for `"between"` / `"outside"` operators. */
  maxValue?: number;
}

export interface MacroAction {
  targetPin: string;
  actionOn: boolean;
  /** Explicit PWM duty (`0..4095`) for `analog_output` targets; omitted/null for digital ON/OFF. */
  targetValue?: number | null;
  /** Optional client-side condition evaluated in the dashboard before sending ESP32 commands. */
  condition?: MacroActionCondition;
  /** Multiple client-side conditions evaluated in the dashboard before sending ESP32 commands. */
  conditions?: MacroActionCondition[];
  /** Logical combinator when multiple conditions are configured (`"and"` default or `"or"`). */
  conditionLogic?: ConditionLogic;
}

export interface Macro {
  id: string;
  title: string;
  icon?: string;
  actions: MacroAction[];
}

export type AuxChipType =
  | "unknown"
  | "esp8266_01"
  | "esp8266_12"
  | "esp32"
  | "esp32_c3"
  | "esp32_s3";

export const AUX_CHIP_CODE_MAP: Record<AuxChipType, number> = {
  unknown: 0,
  esp8266_01: 1,
  esp8266_12: 2,
  esp32: 3,
  esp32_c3: 4,
  esp32_s3: 5,
};

export const AUX_CHIP_FROM_CODE: Record<number, AuxChipType> = {
  0: "unknown",
  1: "esp8266_01",
  2: "esp8266_12",
  3: "esp32",
  4: "esp32_c3",
  5: "esp32_s3",
};

export interface AuxNodeConfig {
  /** شناسه ۱ تا ۱۶ تخصیص‌یافته به برد کمکی */
  nodeId: number;
  /** نام نمایشی برد کمکی (مثلاً «پارکینگ ESP-01») — حداکثر ۳۱ بایت UTF-8 */
  name: string;
  /** آدرس MAC نرمال‌شده با حروف بزرگ (مثلاً "AA:BB:CC:DD:EE:FF") */
  mac: string;
  /** تعداد پایه‌های مجاز برای این برد کمکی (۱ تا ۳۲) */
  pinCapacity: number;
  /** نوع چیپ برای پیشنهاد پایه‌های مجاز در UI */
  chipType: AuxChipType;
  /** نام گروه متناظر در layout.groups_order (به‌طور پیش‌فرض برابر name) */
  groupName: string;
  /** وضعیت آنلاین آخرین تله‌متری از برد مرکزی (در فاز ۲ فعال می‌شود) */
  online?: boolean;
}

export interface EspConfig {
  version: string;
  device: {
    name: string;
    chip: string;
    firmware: string;
    reboot_count: number;
    last_boot: string;
  };
  preferences: {
    theme_mode: "dark" | "light";
    accent_color_3: string;
    accent_color_4: string;
    font_family: string;
    animations_enabled: boolean;
    animations_fps?: number;
    header_animation: "fade" | "chase";
    header_title: string;
    matrix_density?: number;
    matrix_size?: number;
    matrix_hover_size?: number;
    matrix_color?: string;
    matrix_moving?: boolean;
    matrix_mouse_effect?: boolean;
    matrix_twinkle_effect?: boolean;
    matrix_twinkle_speed?: number;
    cuneiform_opacity?: number;
    cuneiform_color?: "accent3" | "accent4" | "white" | "muted";
    header_position?: "top" | "left";
    manual_save_mode?: boolean;
    dashboard_width?: 1 | 2 | 3 | 4 | 5;
    dashboard_bg_color?: string;
    dashboard_bg_opacity?: number;
  };
  layout: {
    groups_order: string[];
    groups_cols: number;
    group_configs: Record<string, { maxCols: number; icon?: string }>;
  };
  auxNodes?: AuxNodeConfig[];
  segments: Array<{
    id: string;
    type: string;
    pin: string;
    title: string;
    group: string;
    icon?: string;
    state?: boolean;
    mode?: "switch" | "push";
    auto_off?: number;
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
    rule?: {
      active?: boolean;
      highActions?: Array<{
        reqHold: number;
        targetPin: string;
        actionOn: boolean;
        actionType?: number;
        delay?: number;
        targetValue?: number | null;
        aval?: number;
        conditions?: RuleGuardCondition[];
        conditionLogic?: ConditionLogic;
      }>;
      lowActions?: Array<{
        reqHold: number;
        targetPin: string;
        actionOn: boolean;
        actionType?: number;
        delay?: number;
        targetValue?: number | null;
        aval?: number;
        conditions?: RuleGuardCondition[];
        conditionLogic?: ConditionLogic;
      }>;
      analogRanges?: Array<{
        minValue: number;
        maxValue: number;
        hysteresis: number;
        triggerMode: 0 | 1;
        targetPin: string;
        actionState: boolean;
        targetValue?: number | null;
        actionType: 0 | 1 | 2;
        delay: number;
        enabled?: boolean;
        conditions?: RuleGuardCondition[];
        conditionLogic?: ConditionLogic;
      }>;
      targetPinHigh?: string;
      actionOnHigh?: boolean;
      actionTypeHigh?: number;
      delayHigh?: number;
      reqHoldHigh?: number;
      targetPinLow?: string;
      actionOnLow?: boolean;
      actionTypeLow?: number;
      delayLow?: number;
      reqHoldLow?: number;
      targetPin?: string;
      triggerState?: boolean;
      actionState?: boolean;
    };
  }>;
  automations?: Array<{
    id: string;
    title: string;
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
    actions: Array<{
      targetPin?: string;
      targetMacro?: string;
      actionOn?: boolean;
    }>;
  }>;
  macros?: Macro[];
  voiceCommands?: Array<{
    id: string;
    phrase: string;
    actions: Array<{
      targetPin?: string;
      targetMacro?: string;
      actionOn?: boolean;
    }>;
  }>;
  mqtt?: {
    broker_ws_url: string;
    broker_host: string;
    broker_port: number;
    base_topic: string;
    qos: 0 | 1 | 2;
  };
  wifi?: {
    networks?: Array<{
      id: string;
      ssid: string;
      password?: string;
    }>;
    access_point?: { ssid: string; password: string };
  };
  worker_url?: string;
}
