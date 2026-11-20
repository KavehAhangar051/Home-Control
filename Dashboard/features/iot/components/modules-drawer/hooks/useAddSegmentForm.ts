import { useState } from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import {
  type AnalogInputPreset,
  type AnalogInputSegmentOptions,
  clampAdcDeltaThreshold,
  clampAdcResolution,
  DEFAULT_ADC_DELTA_THRESHOLD,
  DEFAULT_ADC_HIGH_THRESHOLD,
  DEFAULT_ADC_LOW_THRESHOLD,
  DEFAULT_ADC_RESOLUTION,
  DEFAULT_ADC_SAMPLE_INTERVAL_MS,
  getAdcMaxValue,
  isAnalogInputType,
  normalizeAnalogInputConfig,
} from "@/features/iot/utils/analogInput";
import {
  type AnalogSegmentOptions,
  clampPwmFrequency,
  clampPwmResolution,
  DEFAULT_PWM_FREQUENCY,
  DEFAULT_PWM_RESOLUTION,
  isAnalogOutputType,
  percentToAnalogDuty,
} from "@/features/iot/utils/analogOutput";
import { validateEsp32Pin } from "@/features/iot/utils/pinValidation";
import type { Segment } from "../core/types";

export type OnAddSegmentFn = (
  type: string,
  pin: string,
  title?: string,
  group?: string,
  mode?: "switch" | "push",
  auto_off?: number,
  icon?: string,
  groupIcon?: string,
  analogConfig?: AnalogSegmentOptions,
  analogInputConfig?: AnalogInputSegmentOptions,
) => void;

export function useAddSegmentForm(
  segments: Segment[],
  onAddSegment: OnAddSegmentFn,
  onClose: () => void,
) {
  const showToast = useIoTStore((s) => s.showToast);
  const groupsOrder = useIoTStore((s) => s.groupsOrder);
  const [selectedType, setSelectedType] = useState("gpio_toggle");
  const [targetPin, setTargetPin] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [groupName, setGroupName] = useState(groupsOrder.length > 0 ? groupsOrder[0] : "Test");
  const [segmentIcon, setSegmentIcon] = useState("");
  const [groupIcon, setGroupIcon] = useState("");
  const [errorText, setErrorText] = useState("");
  const [buttonMode, setButtonMode] = useState<"switch" | "push">("switch");
  const [pwmResolution, setPwmResolution] = useState<number>(DEFAULT_PWM_RESOLUTION);
  const [pwmFrequency, setPwmFrequency] = useState<number>(DEFAULT_PWM_FREQUENCY);
  const [initialPercent, setInitialPercent] = useState<number>(0);
  const [adcResolution, setAdcResolution] = useState<number>(DEFAULT_ADC_RESOLUTION);
  const [adcSampleIntervalMs, setAdcSampleIntervalMs] = useState<number>(
    DEFAULT_ADC_SAMPLE_INTERVAL_MS,
  );
  const [adcDeltaThreshold, setAdcDeltaThreshold] = useState<number>(DEFAULT_ADC_DELTA_THRESHOLD);
  const [adcHighThreshold, setAdcHighThreshold] = useState<number>(DEFAULT_ADC_HIGH_THRESHOLD);
  const [adcLowThreshold, setAdcLowThreshold] = useState<number>(DEFAULT_ADC_LOW_THRESHOLD);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleAdcResolutionChange = (nextRes: number) => {
    const clampedRes = clampAdcResolution(nextRes);
    const nextMax = getAdcMaxValue(clampedRes);
    setAdcResolution(clampedRes);
    setAdcDeltaThreshold((prev) => clampAdcDeltaThreshold(prev, clampedRes));
    setAdcHighThreshold((prev) => Math.min(nextMax, prev));
    setAdcLowThreshold((prev) => Math.min(nextMax, prev));
  };

  const applyAdcPreset = (preset: AnalogInputPreset) => {
    setAdcResolution(preset.config.adcResolution);
    setAdcSampleIntervalMs(preset.config.adcSampleIntervalMs);
    setAdcDeltaThreshold(preset.config.adcDeltaThreshold);
    setAdcHighThreshold(preset.config.adcHighThreshold);
    setAdcLowThreshold(preset.config.adcLowThreshold);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText("");

    const finalPin = targetPin.trim();

    if (!finalPin) {
      setErrorText("لطفاً شماره پایه را مشخص کنید.");

      return;
    }

    const validation = validateEsp32Pin(finalPin, selectedType);

    if (!validation.isValid) {
      showToast(validation.message, "error");

      return;
    }

    if (validation.isWarning) {
      showToast(validation.message, "success");
    }

    if (segments.some((s) => s.type !== "placeholder" && s.pin === finalPin)) {
      setErrorText(`ماژولی برای پایه GPIO ${finalPin} قبلاً اضافه شده است.`);

      return;
    }

    const isAnalogOutput = isAnalogOutputType(selectedType);
    const isAnalogInput = isAnalogInputType(selectedType);

    if (isAnalogInput && adcHighThreshold > 0 && adcLowThreshold > adcHighThreshold) {
      setErrorText("آستانه پایین (ATL) نمی‌تواند از آستانه بالا (ATH) بزرگ‌تر باشد.");

      return;
    }

    const resolvedResolution = clampPwmResolution(pwmResolution);
    const resolvedFrequency = clampPwmFrequency(pwmFrequency);
    const analogConfig: AnalogSegmentOptions | undefined = isAnalogOutput
      ? {
          pwmResolution: resolvedResolution,
          pwmFrequency: resolvedFrequency,
          initialValue: percentToAnalogDuty(initialPercent, resolvedResolution),
        }
      : undefined;

    const analogInputConfig: AnalogInputSegmentOptions | undefined = isAnalogInput
      ? normalizeAnalogInputConfig({
          adcResolution,
          adcSampleIntervalMs,
          adcDeltaThreshold,
          adcHighThreshold,
          adcLowThreshold,
        })
      : undefined;

    const defaultTitle =
      selectedType === "input"
        ? `ورودی دیجیتال (GPIO ${finalPin})`
        : isAnalogOutput
          ? `خروجی آنالوگ PWM (GPIO ${finalPin})`
          : isAnalogInput
            ? `ورودی آنالوگ ADC (GPIO ${finalPin})`
            : `کنترل پایه دیجیتال (GPIO ${finalPin})`;

    onAddSegment(
      selectedType,
      finalPin,
      customTitle.trim() || defaultTitle,
      groupName.trim() || "Test",
      isAnalogOutput || isAnalogInput ? undefined : buttonMode,
      undefined,
      segmentIcon || undefined,
      groupIcon || undefined,
      analogConfig,
      analogInputConfig,
    );

    setCustomTitle("");
    setGroupName(groupsOrder.length > 0 ? groupsOrder[0] : "Test");
    setTargetPin("");
    setSegmentIcon("");
    setGroupIcon("");
    setButtonMode("switch");
    setPwmResolution(DEFAULT_PWM_RESOLUTION);
    setPwmFrequency(DEFAULT_PWM_FREQUENCY);
    setInitialPercent(0);
    setAdcResolution(DEFAULT_ADC_RESOLUTION);
    setAdcSampleIntervalMs(DEFAULT_ADC_SAMPLE_INTERVAL_MS);
    setAdcDeltaThreshold(DEFAULT_ADC_DELTA_THRESHOLD);
    setAdcHighThreshold(DEFAULT_ADC_HIGH_THRESHOLD);
    setAdcLowThreshold(DEFAULT_ADC_LOW_THRESHOLD);
    setErrorText("");
    onClose();
  };

  return {
    selectedType,
    setSelectedType,
    targetPin,
    setTargetPin,
    customTitle,
    setCustomTitle,
    groupName,
    setGroupName,
    segmentIcon,
    setSegmentIcon,
    groupIcon,
    setGroupIcon,
    errorText,
    buttonMode,
    setButtonMode,
    pwmResolution,
    setPwmResolution,
    pwmFrequency,
    setPwmFrequency,
    initialPercent,
    setInitialPercent,
    adcResolution,
    handleAdcResolutionChange,
    adcSampleIntervalMs,
    setAdcSampleIntervalMs,
    adcDeltaThreshold,
    setAdcDeltaThreshold,
    adcHighThreshold,
    setAdcHighThreshold,
    adcLowThreshold,
    setAdcLowThreshold,
    applyAdcPreset,
    showAdvanced,
    setShowAdvanced,
    groupsOrder,
    handleSubmit,
  };
}
