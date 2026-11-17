import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import { Card } from "@/components/ui/card";
import { ChevronDown, Plus, Settings2 } from "@/components/ui/hugeicons";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  DURATION,
  EASE_IN_OUT,
  ERROR_SHAKE_KEYFRAMES,
  SPRING_PRESS,
  TRANSITION_ENTER_QUICK,
  TRANSITION_EXIT_QUICK,
} from "@/lib/ease";
import type { Segment } from "../core/types";
import { useAddSegmentForm } from "../hooks/useAddSegmentForm";
import ButtonModeSelector from "./ButtonModeSelector";
import FormDetailsInput from "./FormDetailsInput";
import PinSelector from "./PinSelector";

interface AddSegmentFormProps {
  onAddSegment: (
    type: string,
    pin: string,
    title?: string,
    group?: string,
    mode?: "switch" | "push",
    auto_off?: number,
    icon?: string,
    groupIcon?: string,
  ) => void;
  onClose: () => void;
  segments: Segment[];
  animationsEnabled: boolean;
}

export default function AddSegmentForm({
  onAddSegment,
  onClose,
  segments,
  animationsEnabled,
}: AddSegmentFormProps) {
  const {
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
    showAdvanced,
    setShowAdvanced,
    groupsOrder,
    handleSubmit,
  } = useAddSegmentForm(segments, onAddSegment, onClose);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="bezel-shell">
        <Card className="bezel-core !gap-4 !p-4">
          <div className="flex items-center gap-2 text-text-primary border-b border-border-color pb-3">
            <Plus strokeWidth={1.5} className="size-4 text-accent3" />
            <span className="text-sm font-medium font-sans">افزودن سگمنت جدید</span>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="segment-monitoring-type" className="block">
              نوع سگمنت مانیتورینگ
            </Label>
            <Select
              id="segment-monitoring-type"
              aria-label="نوع سگمنت مانیتورینگ"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="text-xs rounded-lg font-sans"
            >
              <option value="gpio_toggle" className="bg-card-bg-solid">
                کلید کنترل پایه (خاموش و روشن)
              </option>
              <option value="input" className="bg-card-bg-solid">
                ورودی دیجیتال (۰ و ۱)
              </option>
            </Select>
          </div>

          <PinSelector customPin={targetPin} setCustomPin={setTargetPin} />

          <FormDetailsInput
            customTitle={customTitle}
            setCustomTitle={setCustomTitle}
            groupName={groupName}
            setGroupName={setGroupName}
            segmentIcon={segmentIcon}
            setSegmentIcon={setSegmentIcon}
            groupIcon={groupIcon}
            setGroupIcon={setGroupIcon}
            existingGroups={groupsOrder}
          />

          <div className="pt-2 border-t border-border-color">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between text-text-secondary hover:text-text-primary transition-colors py-2"
            >
              <div className="flex items-center gap-2">
                <Settings2 strokeWidth={1.5} className="size-4" />
                <span className="text-xs font-medium">تنظیمات جانبی</span>
              </div>
              <ChevronDown
                strokeWidth={1.5}
                className={`size-4 transition-transform duration-200 ${showAdvanced ? "rotate-180" : ""}`}
              />
            </button>

            <AnimatePresence>
              {showAdvanced && (
                <m.div
                  initial={animationsEnabled ? { opacity: 0, y: -6 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  exit={
                    animationsEnabled
                      ? { opacity: 0, y: -6, transition: TRANSITION_EXIT_QUICK }
                      : undefined
                  }
                  transition={animationsEnabled ? TRANSITION_ENTER_QUICK : { duration: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 pb-1 space-y-4">
                    {selectedType === "gpio_toggle" && (
                      <ButtonModeSelector
                        buttonMode={buttonMode}
                        setButtonMode={setButtonMode}
                        animationsEnabled={animationsEnabled}
                      />
                    )}
                    {selectedType !== "gpio_toggle" && (
                      <p className="text-xs text-text-muted text-center">
                        تنظیمات جانبی برای این نوع سگمنت وجود ندارد
                      </p>
                    )}
                  </div>
                </m.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence mode="wait">
            {errorText && (
              <m.p
                key={errorText}
                initial={animationsEnabled ? { opacity: 0, y: -4 } : false}
                animate={{
                  opacity: 1,
                  y: 0,
                  x: animationsEnabled ? [...ERROR_SHAKE_KEYFRAMES] : 0,
                }}
                exit={
                  animationsEnabled
                    ? { opacity: 0, y: -4, transition: TRANSITION_EXIT_QUICK }
                    : undefined
                }
                transition={{
                  ...TRANSITION_ENTER_QUICK,
                  x: { duration: DURATION.slow, ease: EASE_IN_OUT },
                }}
                className="text-xs text-destructive font-sans mt-2"
              >
                {errorText}
              </m.p>
            )}
          </AnimatePresence>
          <m.button
            type="submit"
            whileTap={animationsEnabled ? { scale: 0.98 } : undefined}
            transition={SPRING_PRESS}
            className="group mt-4 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-accent3 py-2 pr-4 pl-2 font-sans text-sm font-medium text-bg-main transition-opacity duration-150 hover:opacity-90"
          >
            <span>ایجاد سگمنت</span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-bg-main/15 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:scale-105">
              <Plus strokeWidth={2} className="size-3.5" aria-hidden="true" />
            </span>
          </m.button>
        </Card>
      </div>
    </form>
  );
}
