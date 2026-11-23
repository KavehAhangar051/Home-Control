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

  const [sourceMode, setSourceMode] = useState<SegmentSourceMode>(() =>
    targetPlaceholder?.isVirtual && targetPlaceholder.nodeId ? "virtual" : "local",
  );
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(
    () => targetPlaceholder?.nodeId ?? auxNodes[0]?.nodeId ?? null,
  );
  const [remotePin, setRemotePin] = useState("");
  const [selectedType, setSelectedType] = useState("gpio_toggle");
  const [targetPin, setTargetPin] = useState("");
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

  const placeholderId = targetPlaceholder?.id ?? null;
  const placeholderIsVirtual = Boolean(targetPlaceholder?.isVirtual);
  const placeholderNodeId = targetPlaceholder?.nodeId ?? null;
  const placeholderGroup = targetPlaceholder?.group ?? "";

  useEffect(() => {
    if (!placeholderId) return;

    setErrorText("");
    if (placeholderIsVirtual && placeholderNodeId !== null) {
      setSourceMode("virtual");
      setSelectedNodeId(placeholderNodeId);
      setRemotePin("");
      if (placeholderGroup) setGroupName(placeholderGroup);
    } else {
      setSourceMode("local");
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
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText("");

    const activeTotal = segments.filter((s) => s.type !== "placeholder").length;
    if (activeTotal >= MAX_TOTAL_SEGMENTS) {
      setErrorText(`حداکثر ظرفیت کل هاب مرکزی (${MAX_TOTAL_SEGMENTS} سگمنت فعال) تکمیل شده است.`);
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

    if (sourceMode === "virtual") {
      if (!selectedAuxNode) {
        setErrorText("لطفاً ابتدا یک برد کمکی (ESP) انتخاب یا ثبت کنید.");
        return;
      }

      const usedOnNode = getAuxNodeActiveSegmentCount(segments, selectedAuxNode.nodeId);
      if (usedOnNode >= selectedAuxNode.pinCapacity) {
        setErrorText(
          `ظرفیت برد کمکی «${selectedAuxNode.name}» (${selectedAuxNode.pinCapacity} پایه) تکمیل شده است.`,
        );
        return;
      }

      const trimmedRemote = remotePin.trim();
      if (!trimmedRemote) {
        setErrorText("لطفاً شماره پایه روی برد کمکی (Remote GPIO) را مشخص کنید.");
        return;
      }

      const parsedRemote = Number(trimmedRemote);
      if (!isValidRemotePin(parsedRemote)) {
        setErrorText("شماره پایه روی برد کمکی باید عددی صحیح بین ۰ تا ۳۹ باشد.");
        return;
      }

      const occupied = getOccupiedRemotePins(segments, selectedAuxNode.nodeId);
      if (occupied.has(parsedRemote)) {
        setErrorText(
          `پایه GPIO ${parsedRemote} روی برد «${selectedAuxNode.name}» قبلاً استفاده شده است.`,
        );
        return;
      }

      const defaultTitle =
        selectedType === "input"
          ? `ورودی دیجیتال (Remote GPIO ${parsedRemote})`
          : isAnalogOutput
            ? `خروجی آنالوگ PWM (Remote GPIO ${parsedRemote})`
            : isAnalogInput
              ? `ورودی آنالوگ ADC (Remote GPIO ${parsedRemote})`
              : `کنترل پایه دیجیتال (Remote GPIO ${parsedRemote})`;

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
    }

    setCustomTitle("");
    setGroupName(groupsOrder.length > 0 ? groupsOrder[0] : "Test");
    setTargetPin("");
    setRemotePin("");
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
