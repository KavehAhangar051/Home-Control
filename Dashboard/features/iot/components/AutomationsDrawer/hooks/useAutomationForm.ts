import { useState } from "react";
import type { Automation, ConditionLogic, RuleGuardCondition } from "@/features/iot/hooks/store/types";
import { normalizeRuleGuardCondition, validateConditionEntry } from "@/features/iot/utils/macroEngine";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";

interface AutomationFormDraftInput {
  editingId: string | null;
  title: string;
  autoType: "schedule" | "timer" | "weather";
  time: string;
  days: number[];
  repeatCount: number | "";
  delayHours: number | "";
  delayMinutes: number | "";
  city: string;
  temperatureThreshold: number | "";
  temperatureCondition: "greater" | "less";
  intervalMinutes: number | "";
  hasWeatherCondition: boolean;
  segmentConditions?: RuleGuardCondition[];
  segmentConditionLogic?: ConditionLogic;
  actions: Array<{
    targetPin?: string;
    targetMacro?: string;
    actionOn?: boolean;
  }>;
}

type ValidationResult = { ok: true; automation: Automation } | { ok: false; errorMessage: string };

interface ComputedTimerSchedule {
  time: string;
  days: number[];
  repeatCount: number;
}

export function computeTimerSchedule(
  delayHours: number,
  delayMinutes: number,
  now: Date = new Date(),
): ComputedTimerSchedule {
  const targetDate = new Date(now.getTime());
  targetDate.setHours(targetDate.getHours() + delayHours);
  targetDate.setMinutes(targetDate.getMinutes() + delayMinutes);

  const formattedHours = targetDate.getHours().toString().padStart(2, "0");
  const formattedMinutes = targetDate.getMinutes().toString().padStart(2, "0");

  return {
    time: `${formattedHours}:${formattedMinutes}`,
    days: [targetDate.getDay()],
    repeatCount: 1,
  };
}

function resolvePositiveNumber(value: number | ""): number | undefined {
  return value !== "" && value > 0 ? value : undefined;
}

interface ResolvedDraftTiming {
  time: string;
  days: number[];
  repeatCount: number | undefined;
  conditionType: "time" | "weather";
}

function resolveDraftTimingAndCondition(
  input: AutomationFormDraftInput,
  finalTempThresh: number | undefined,
  finalIntervalMinutes: number | undefined,
  now: Date,
): { ok: true; value: ResolvedDraftTiming } | { ok: false; errorMessage: string } {
  let time = input.time;
  let days = [...input.days];
  let repeatCount = resolvePositiveNumber(input.repeatCount);
  let conditionType: "time" | "weather" = "time";

  if (input.autoType === "timer") {
    const dHours = Number(input.delayHours) || 0;
    const dMins = Number(input.delayMinutes) || 0;

    if (dHours === 0 && dMins === 0) {
      return { ok: false, errorMessage: "لطفاً زمان تاخیر را مشخص کنید." };
    }

    const timerSchedule = computeTimerSchedule(dHours, dMins, now);
    time = timerSchedule.time;
    days = timerSchedule.days;
    repeatCount = timerSchedule.repeatCount;
  } else if (input.autoType === "weather") {
    if (!input.city || finalTempThresh === undefined || !finalIntervalMinutes) {
      return { ok: false, errorMessage: "لطفاً شهر، شرط دما و دوره بررسی را مشخص کنید." };
    }

    conditionType = "weather";
    time = "";
    days = [];
  } else if (!input.time || input.days.length === 0) {
    return { ok: false, errorMessage: "لطفاً زمان و روزهای هفته را مشخص کنید." };
  }

  if ((input.autoType === "timer" || input.autoType === "schedule") && input.hasWeatherCondition) {
    if (!input.city || finalTempThresh === undefined) {
      return { ok: false, errorMessage: "لطفاً شهر و شرط دما را مشخص کنید." };
    }

    conditionType = "weather";
  }

  return {
    ok: true,
    value: { time, days, repeatCount, conditionType },
  };
}

export function inferAutomationEditType(auto: Automation): "schedule" | "timer" | "weather" {
  if (auto.intervalMinutes) return "weather";

  if (auto.repeatCount) return "timer";

  return "schedule";
}

export function buildValidatedAutomationDraft(
  input: AutomationFormDraftInput,
  now: Date = new Date(),
): ValidationResult {
  const finalTempThresh =
    input.temperatureThreshold !== "" ? input.temperatureThreshold : undefined;

  const finalIntervalMinutes = resolvePositiveNumber(input.intervalMinutes);

  const timingResult = resolveDraftTimingAndCondition(
    input,
    finalTempThresh,
    finalIntervalMinutes,
    now,
  );

  if ("errorMessage" in timingResult) {
    return timingResult;
  }

  if (!input.title) {
    return { ok: false, errorMessage: "لطفاً عنوان را وارد کنید." };
  }

  if (input.actions.length === 0) {
    return { ok: false, errorMessage: "حداقل یک عملیات مشخص کنید." };
  }

  const { time, days, repeatCount, conditionType } = timingResult.value;
  const normalizedSegmentConditions = Array.isArray(input.segmentConditions)
    ? input.segmentConditions
        .map((c) => normalizeRuleGuardCondition(c))
        .filter((c): c is RuleGuardCondition => Boolean(c))
    : [];

  return {
    ok: true,
    automation: {
      id: input.editingId || `auto_${now.getTime()}`,
      title: input.title,
      time,
      days,
      repeatCount,

      targetTimestamp:
        input.autoType === "timer"
          ? now.getTime() +
            ((Number(input.delayHours) || 0) * 60 + (Number(input.delayMinutes) || 0)) * 60_000
          : undefined,
      intervalMinutes: finalIntervalMinutes,
      conditionType,
      city: input.city,
      temperatureThreshold: finalTempThresh,
      temperatureCondition: input.temperatureCondition,
      ...(normalizedSegmentConditions.length > 0
        ? {
            segmentConditions: normalizedSegmentConditions,
            ...(input.segmentConditionLogic === "or" && normalizedSegmentConditions.length > 1
              ? { segmentConditionLogic: "or" as const }
              : {}),
          }
        : {}),
      actions: input.actions,
      enabled: true,
    },
  };
}

export function useAutomationForm() {
  const automations = useIoTStore((state) => state.automations);
  const setAutomations = useIoTStore((state) => state.setAutomations);
  const showToast = useIoTStore((state) => state.showToast);

  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [days, setDays] = useState<number[]>([]);
  const [repeatCount, setRepeatCount] = useState<number | "">("");

  const [autoType, setAutoType] = useState<"schedule" | "timer" | "weather">("schedule");
  const [delayHours, setDelayHours] = useState<number | "">("");
  const [delayMinutes, setDelayMinutes] = useState<number | "">("");

  const [city, setCity] = useState("");
  const [temperatureThreshold, setTemperatureThreshold] = useState<number | "">("");
  const [temperatureCondition, setTemperatureCondition] = useState<"greater" | "less">("greater");

  const [intervalMinutes, setIntervalMinutes] = useState<number | "">("");
  const [hasWeatherCondition, setHasWeatherCondition] = useState<boolean>(false);
  const [segmentConditions, setSegmentConditions] = useState<RuleGuardCondition[]>([]);
  const [segmentConditionLogic, setSegmentConditionLogic] = useState<ConditionLogic>("and");
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const [actions, setActions] = useState<
    Array<{
      targetPin?: string;
      targetMacro?: string;
      actionOn?: boolean;
    }>
  >([]);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      showToast("مرورگر شما از قابلیت مکان‌یابی پشتیبانی نمی‌کند.", "error");

      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(4);
        const lon = position.coords.longitude.toFixed(4);
        setCity(`${lat},${lon}`);
        setIsGettingLocation(false);
        showToast("مکان شما با موفقیت ثبت شد.", "success");
      },
      (_error) => {
        setIsGettingLocation(false);
        showToast("خطا در دریافت مکان. لطفاً دسترسی دستگاه را بررسی کنید.", "error");
      },
    );
  };

  const resetForm = () => {
    setTitle("");
    setTime("");
    setDays([]);
    setRepeatCount("");
    setAutoType("schedule");
    setDelayHours("");
    setDelayMinutes("");
    setCity("");
    setTemperatureThreshold("");
    setTemperatureCondition("greater");
    setIntervalMinutes("");
    setHasWeatherCondition(false);
    setSegmentConditions([]);
    setSegmentConditionLogic("and");
    setActions([]);
    setEditingId(null);
  };

  const handleEdit = (auto: Automation) => {
    setEditingId(auto.id);
    setTitle(auto.title);
    setTime(auto.time || "");
    setDays(auto.days ? [...auto.days] : []);
    setRepeatCount(auto.repeatCount || "");
    setIntervalMinutes(auto.intervalMinutes || "");

    if (auto.city && auto.temperatureThreshold !== undefined) {
      setHasWeatherCondition(true);
      setCity(auto.city);
      setTemperatureThreshold(auto.temperatureThreshold);
      setTemperatureCondition(auto.temperatureCondition || "greater");
    } else {
      setHasWeatherCondition(false);
    setSegmentConditions([]);
    setSegmentConditionLogic("and");
      setCity("");
      setTemperatureThreshold("");
    }

    setSegmentConditions(
      Array.isArray(auto.segmentConditions)
        ? auto.segmentConditions
            .map((c) => normalizeRuleGuardCondition(c))
            .filter((c): c is RuleGuardCondition => Boolean(c))
        : [],
    );
    setSegmentConditionLogic(auto.segmentConditionLogic === "or" ? "or" : "and");
    setAutoType(inferAutomationEditType(auto));

    setActions(auto.actions ? [...auto.actions] : []);
    useIoTStore.getState().setActiveAutomationsTab("create");
  };

  const handleSave = () => {
    const currentSegments = useIoTStore.getState().segments;
    for (let i = 0; i < segmentConditions.length; i++) {
      const condErr = validateConditionEntry(
        segmentConditions[i],
        segmentConditions.length > 1 ? `شرط سگمنت ${i + 1}` : "شرط سگمنت",
        currentSegments,
      );
      if (condErr) {
        showToast(condErr, "error");
        return false;
      }
    }

    const validation = buildValidatedAutomationDraft({
      editingId,
      title,
      autoType,
      time,
      days,
      repeatCount,

      delayHours,
      delayMinutes,
      city,
      temperatureThreshold,
      temperatureCondition,
      intervalMinutes,
      hasWeatherCondition,
      segmentConditions,
      segmentConditionLogic,
      actions,
    });

    if ("errorMessage" in validation) {
      showToast(validation.errorMessage, "error");

      return false;
    }

    const newAuto = validation.automation;

    if (editingId) {
      setAutomations(
        automations.map((a) => (a.id === editingId ? { ...newAuto, enabled: a.enabled } : a)),
      );
    } else {
      setAutomations([...automations, newAuto]);
    }

    resetForm();
    showToast("اتوماسیون با موفقیت ثبت شد.", "success");

    return true;
  };

  const handleDelete = (id: string) => {
    setAutomations(automations.filter((a) => a.id !== id));
    showToast("اتوماسیون حذف شد.", "success");
  };

  const handleToggle = (id: string, enabled: boolean) => {
    setAutomations(automations.map((a) => (a.id === id ? { ...a, enabled } : a)));
  };

  return {
    // states
    editingId,
    title,
    setTitle,
    time,
    setTime,
    days,
    setDays,
    repeatCount,
    setRepeatCount,
    autoType,
    setAutoType,
    delayHours,
    setDelayHours,
    delayMinutes,
    setDelayMinutes,
    city,
    setCity,
    temperatureThreshold,
    setTemperatureThreshold,
    temperatureCondition,
    setTemperatureCondition,
    intervalMinutes,
    setIntervalMinutes,
    hasWeatherCondition,
    setHasWeatherCondition,
    isGettingLocation,
    actions,
    setActions,
    segmentConditions,
    setSegmentConditions,
    segmentConditionLogic,
    setSegmentConditionLogic,

    // actions
    handleGetLocation,
    resetForm,
    handleEdit,
    handleSave,
    handleDelete,
    handleToggle,
  };
}
