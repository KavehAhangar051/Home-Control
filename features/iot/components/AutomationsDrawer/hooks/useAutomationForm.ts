import { useState } from "react";
import type { Automation } from "@/features/iot/hooks/store/types";
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
  actions: Array<{
    targetPin?: string;
    targetMacro?: string;
    actionOn?: boolean;
  }>;
}

type ValidationResult = { ok: true; automation: Automation } | { ok: false; errorMessage: string };

function computeTimerSchedule(
  delayHours: number,
  delayMinutes: number,
): { time: string; days: number[]; repeatCount: number } {
  const targetDate = new Date();
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

export function buildValidatedAutomationDraft(input: AutomationFormDraftInput): ValidationResult {
  let finalTime = input.time;
  let finalDays = [...input.days];
  let finalRepeatCount =
    input.repeatCount !== "" && input.repeatCount > 0 ? input.repeatCount : undefined;
  let finalConditionType: "time" | "weather" = "time";
  const finalTempThresh =
    input.temperatureThreshold !== "" ? input.temperatureThreshold : undefined;
  const finalIntervalMinutes =
    input.intervalMinutes !== "" && input.intervalMinutes > 0 ? input.intervalMinutes : undefined;

  if (input.autoType === "timer") {
    const dHours = Number(input.delayHours) || 0;
    const dMins = Number(input.delayMinutes) || 0;

    if (dHours === 0 && dMins === 0) {
      return { ok: false, errorMessage: "لطفاً زمان تاخیر را مشخص کنید." };
    }

    const timerSchedule = computeTimerSchedule(dHours, dMins);
    finalTime = timerSchedule.time;
    finalDays = timerSchedule.days;
    finalRepeatCount = timerSchedule.repeatCount;
  } else if (input.autoType === "weather") {
    if (!input.city || finalTempThresh === undefined || !finalIntervalMinutes) {
      return { ok: false, errorMessage: "لطفاً شهر، شرط دما و دوره بررسی را مشخص کنید." };
    }

    finalConditionType = "weather";
    finalTime = "";
    finalDays = [];
  } else if (!input.time || input.days.length === 0) {
    return { ok: false, errorMessage: "لطفاً زمان و روزهای هفته را مشخص کنید." };
  }

  if ((input.autoType === "timer" || input.autoType === "schedule") && input.hasWeatherCondition) {
    if (!input.city || finalTempThresh === undefined) {
      return { ok: false, errorMessage: "لطفاً شهر و شرط دما را مشخص کنید." };
    }

    finalConditionType = "weather";
  }

  if (!input.title) {
    return { ok: false, errorMessage: "لطفاً عنوان را وارد کنید." };
  }

  if (input.actions.length === 0) {
    return { ok: false, errorMessage: "حداقل یک عملیات مشخص کنید." };
  }

  return {
    ok: true,
    automation: {
      id: input.editingId || `auto_${Date.now()}`,
      title: input.title,
      time: finalTime,
      days: finalDays,
      repeatCount: finalRepeatCount,
      intervalMinutes: finalIntervalMinutes,
      conditionType: finalConditionType,
      city: input.city,
      temperatureThreshold: finalTempThresh,
      temperatureCondition: input.temperatureCondition,
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
      setCity("");
      setTemperatureThreshold("");
    }

    if (auto.intervalMinutes) {
      setAutoType("weather");
    } else if (auto.repeatCount) {
      setAutoType("timer");
    } else {
      setAutoType("schedule");
    }

    setActions(auto.actions ? [...auto.actions] : []);
    useIoTStore.getState().setActiveAutomationsTab("create");
  };

  const handleSave = () => {
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
      actions,
    });

    if ("errorMessage" in validation) {
      showToast(validation.errorMessage, "error");

      return;
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

    // actions
    handleGetLocation,
    resetForm,
    handleEdit,
    handleSave,
    handleDelete,
    handleToggle,
  };
}
