import { useEffect, useState } from "react";
import type { VirtualSegmentAddOptions } from "@/features/iot/hooks/achaemenidState/useSegmentManagement";
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
import {
  getAuxNodeActiveSegmentCount,
  getOccupiedRemotePins,
  isValidRemotePin,
  MAX_TOTAL_SEGMENTS,
} from "@/features/iot/utils/auxNodeUtils";
import { validateEsp32Pin } from "@/features/iot/utils/pinValidation";
import type { Segment } from "../core/types";

export type SegmentSourceMode = "local" | "virtual";
export type AddSegmentWizardStep = 0 | 1 | 2;

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
  virtualOptions?: VirtualSegmentAddOptions,
) => void;

export function useAddSegmentForm(
  segments: Segment[],
  onAddSegment: OnAddSegmentFn,
  onClose: () => void,
  targetPlaceholder?: Segment,
) {
  const showToast = useIoTStore((s) => s.showToast);
  const groupsOrder = useIoTStore((s) => s.groupsOrder);
  const auxNodes = useIoTStore((s) => s.auxNodes);

  const [step, setStep] = useState<AddSegmentWizardStep>(0);
  const [maxUnlockedStep, setMaxUnlockedStep] = useState<AddSegmentWizardStep>(0);

  const [sourceMode, setSourceModeState] = useState<SegmentSourceMode>(() =>
    targetPlaceholder?.isVirtual && targetPlaceholder.nodeId ? "virtual" : "local",
  );
  const [selectedNodeId, setSelectedNodeIdState] = useState<number | null>(
    () => targetPlaceholder?.nodeId ?? auxNodes[0]?.nodeId ?? null,
  );
  const [remotePin, setRemotePinState] = useState("");
  const [selectedType, setSelectedTypeState] = useState("gpio_toggle");
  const [targetPin, setTargetPinState] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [groupName, setGroupName] = useState(
    () => targetPlaceholder?.group || (groupsOrder.length > 0 ? groupsOrder[0] : "Test"),
  );
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

  const setSourceMode = (next: SegmentSourceMode) => {
    setSourceModeState(next);
    setErrorText("");
  };

  const setSelectedNodeId = (next: number | null) => {
    setSelectedNodeIdState(next);
    setErrorText("");
  };

  const setRemotePin = (next: string) => {
    setRemotePinState(next);
    setErrorText("");
  };

  const setSelectedType = (next: string) => {
    setSelectedTypeState(next);
    setErrorText("");
  };

  const setTargetPin = (next: string) => {
    setTargetPinState(next);
    setErrorText("");
  };

  const placeholderId = targetPlaceholder?.id ?? null;
  const placeholderIsVirtual = Boolean(targetPlaceholder?.isVirtual);
  const placeholderNodeId = targetPlaceholder?.nodeId ?? null;
  const placeholderGroup = targetPlaceholder?.group ?? "";

  useEffect(() => {
    if (!placeholderId) return;

    setErrorText("");
    setStep(0);
    setMaxUnlockedStep(0);
    if (placeholderIsVirtual && placeholderNodeId !== null) {
      setSourceModeState("virtual");
      setSelectedNodeIdState(placeholderNodeId);
      setRemotePinState("");
      if (placeholderGroup) setGroupName(placeholderGroup);
    } else {
      setSourceModeState("local");
      if (placeholderGroup) setGroupName(placeholderGroup);
    }
  }, [placeholderId, placeholderIsVirtual, placeholderNodeId, placeholderGroup]);

  const effectiveNodeId =
    selectedNodeId !== null && auxNodes.some((n) => n.nodeId === selectedNodeId)
      ? selectedNodeId
      : (auxNodes[0]?.nodeId ?? null);

  const selectedAuxNode =
    effectiveNodeId !== null ? (auxNodes.find((n) => n.nodeId === effectiveNodeId) ?? null) : null;

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
    setErrorText("");
  };

  /**
   * Validates the hardware connection & type-specific configuration step (Step 1)
   * before allowing progression to the naming/grouping step or final submission.
   */
  const validateHardwareStep = (notifyWarning = false): boolean => {
    setErrorText("");

    const activeTotal = segments.filter((s) => s.type !== "placeholder").length;
    if (activeTotal >= MAX_TOTAL_SEGMENTS) {
      setErrorText(`حداکثر ظرفیت کل هاب مرکزی (${MAX_TOTAL_SEGMENTS} قطعه فعال) تکمیل شده است.`);
      return false;
    }

    const isAnalogInput = isAnalogInputType(selectedType);
    if (isAnalogInput && adcHighThreshold > 0 && adcLowThreshold > adcHighThreshold) {
      setErrorText("آستانه پایین (ATL) نمی‌تواند از آستانه بالا (ATH) بزرگ‌تر باشد.");
      return false;
    }

    if (sourceMode === "virtual") {
      if (!selectedAuxNode) {
        setErrorText("ابتدا یک برد کمکی (ESP) انتخاب یا ثبت کنید.");
        return false;
      }

      const usedOnNode = getAuxNodeActiveSegmentCount(segments, selectedAuxNode.nodeId);
      if (usedOnNode >= selectedAuxNode.pinCapacity) {
        setErrorText(
          `ظرفیت برد کمکی «${selectedAuxNode.name}» (${selectedAuxNode.pinCapacity} پایه) تکمیل شده است.`,
        );
        return false;
      }

      const trimmedRemote = remotePin.trim();
      if (!trimmedRemote) {
        setErrorText("شماره پایه روی برد کمکی را وارد یا از پایه‌های پیشنهادی انتخاب کنید.");
        return false;
      }

      const parsedRemote = Number(trimmedRemote);
      if (!isValidRemotePin(parsedRemote)) {
        setErrorText("شماره پایه روی برد کمکی باید عددی صحیح بین ۰ تا ۳۹ باشد.");
        return false;
      }

      const occupied = getOccupiedRemotePins(segments, selectedAuxNode.nodeId);
      if (occupied.has(parsedRemote)) {
        setErrorText(
          `پایه GPIO ${parsedRemote} روی برد «${selectedAuxNode.name}» قبلاً استفاده شده است.`,
        );
        return false;
      }

      return true;
    }

    const finalPin = targetPin.trim();
    if (!finalPin) {
      setErrorText("شماره پایه (GPIO) را وارد یا از پایه‌های پیشنهادی انتخاب کنید.");
      return false;
    }

    const validation = validateEsp32Pin(finalPin, selectedType);
    if (!validation.isValid) {
      setErrorText(validation.message);
      return false;
    }

    if (notifyWarning && validation.isWarning) {
      showToast(validation.message, "success");
    }

    if (segments.some((s) => s.type !== "placeholder" && s.pin === finalPin)) {
      setErrorText(`قطعه دیگری برای پایه GPIO ${finalPin} قبلاً ثبت شده است.`);
      return false;
    }

    return true;
  };

  const goToNextStep = () => {
    setErrorText("");

    if (step === 0) {
      setStep(1);
      setMaxUnlockedStep((prev) => Math.max(prev, 1) as AddSegmentWizardStep);
      return;
    }

    if (step === 1) {
      if (!validateHardwareStep(false)) return;
      setStep(2);
      setMaxUnlockedStep(2);
    }
  };

  const goToPrevStep = () => {
    setErrorText("");
    setStep((prev) => (prev > 0 ? ((prev - 1) as AddSegmentWizardStep) : 0));
  };

  const goToStep = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex > 2) return;
    const clamped = nextIndex as AddSegmentWizardStep;

    if (clamped <= step) {
      setErrorText("");
      setStep(clamped);
      return;
    }

    if (clamped === 1 && maxUnlockedStep >= 1) {
      setErrorText("");
      setStep(1);
      return;
    }

    if (clamped === 2 && maxUnlockedStep >= 2 && validateHardwareStep(false)) {
      setStep(2);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (step < 2) {
      goToNextStep();
      return;
    }

    if (!validateHardwareStep(true)) {
      setStep(1);
      return;
    }

    const isAnalogOutput = isAnalogOutputType(selectedType);
    const isAnalogInput = isAnalogInputType(selectedType);
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

    if (sourceMode === "virtual" && selectedAuxNode) {
      const parsedRemote = Number(remotePin.trim());
      const defaultTitle =
        selectedType === "input"
          ? `ورودی دیجیتال (GPIO ${parsedRemote})`
          : isAnalogOutput
            ? `دیمر PWM (GPIO ${parsedRemote})`
            : isAnalogInput
              ? `سنسور آنالوگ (GPIO ${parsedRemote})`
              : `کلید کنترل (GPIO ${parsedRemote})`;

      onAddSegment(
        selectedType,
        "",
        customTitle.trim() || defaultTitle,
        selectedAuxNode.groupName,
        isAnalogOutput || isAnalogInput ? undefined : buttonMode,
        undefined,
        segmentIcon || undefined,
        undefined,
        analogConfig,
        analogInputConfig,
        {
          isVirtual: true,
          nodeId: selectedAuxNode.nodeId,
          remotePin: parsedRemote,
        },
      );
    } else {
      const finalPin = targetPin.trim();
      const defaultTitle =
        selectedType === "input"
          ? `ورودی دیجیتال (GPIO ${finalPin})`
          : isAnalogOutput
            ? `دیمر PWM (GPIO ${finalPin})`
            : isAnalogInput
              ? `سنسور آنالوگ (GPIO ${finalPin})`
              : `کلید کنترل (GPIO ${finalPin})`;

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
    }

    setCustomTitle("");
    setGroupName(groupsOrder.length > 0 ? groupsOrder[0] : "Test");
    setTargetPinState("");
    setRemotePinState("");
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
    setShowAdvanced(false);
    setErrorText("");
    setStep(0);
    setMaxUnlockedStep(0);
    onClose();
  };

  return {
    step,
    maxUnlockedStep,
    goToNextStep,
    goToPrevStep,
    goToStep,
    sourceMode,
    setSourceMode,
    auxNodes,
    selectedNodeId: effectiveNodeId,
    setSelectedNodeId,
    selectedAuxNode,
    remotePin,
    setRemotePin,
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
