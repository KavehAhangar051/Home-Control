import { useState } from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
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
  const [showAdvanced, setShowAdvanced] = useState(false);

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

    const isAnalog = isAnalogOutputType(selectedType);
    const resolvedResolution = clampPwmResolution(pwmResolution);
    const resolvedFrequency = clampPwmFrequency(pwmFrequency);
    const analogConfig: AnalogSegmentOptions | undefined = isAnalog
      ? {
          pwmResolution: resolvedResolution,
          pwmFrequency: resolvedFrequency,
          initialValue: percentToAnalogDuty(initialPercent, resolvedResolution),
        }
      : undefined;

    const defaultTitle =
      selectedType === "input"
        ? `ورودی دیجیتال (GPIO ${finalPin})`
        : isAnalog
          ? `خروجی آنالوگ PWM (GPIO ${finalPin})`
          : `کنترل پایه دیجیتال (GPIO ${finalPin})`;

    onAddSegment(
      selectedType,
      finalPin,
      customTitle.trim() || defaultTitle,
      groupName.trim() || "Test",
      isAnalog ? undefined : buttonMode,
      undefined,
      segmentIcon || undefined,
      groupIcon || undefined,
      analogConfig,
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
    showAdvanced,
    setShowAdvanced,
    groupsOrder,
    handleSubmit,
  };
}
