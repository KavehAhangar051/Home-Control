import { AnimatePresence, m } from "motion/react";
import { Card } from "@/components/ui/card";
import { ChevronDown, Plus, Settings2 } from "@/components/ui/hugeicons";
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
      <Card className="!gap-4 !rounded-2xl !border-[var(--border-color)] !bg-[var(--card-bg-solid)] !p-4 shadow-none">
        <div className="flex items-center gap-2 text-[var(--text-primary)] border-b border-[var(--border-color)] pb-3">
          <Plus strokeWidth={1.5} className="w-4 h-4 text-[var(--accent3)]" />
          <span className="text-sm font-medium font-sans">افزودن سگمنت جدید</span>
        </div>
        <div className="space-y-1.5">
          <div className="text-xs theme-text-secondary font-medium block">نوع سگمنت مانیتورینگ</div>
          <select
            aria-label="نوع سگمنت مانیتورینگ"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full h-10 px-3 text-xs bg-[var(--bg-main)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg focus:border-[var(--accent3)] outline-none transition-colors cursor-pointer font-sans"
          >
            <option value="gpio_toggle" className="bg-[var(--card-bg-solid)]">
              کلید کنترل پایه (خاموش و روشن)
            </option>
            <option value="input" className="bg-[var(--card-bg-solid)]">
              ورودی دیجیتال (۰ و ۱)
            </option>
          </select>
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

        <div className="pt-2 border-t border-[var(--border-color)]">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors py-2"
          >
            <div className="flex items-center gap-2">
              <Settings2 strokeWidth={1.5} className="w-4 h-4" />
              <span className="text-xs font-medium">تنظیمات جانبی</span>
            </div>
            <ChevronDown
              strokeWidth={1.5}
              className={`w-4 h-4 transition-transform duration-200 ${showAdvanced ? "rotate-180" : ""}`}
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
                    <p className="text-xs text-[var(--text-muted)] text-center">
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
              className="text-xs text-[var(--destructive)] font-sans mt-2"
            >
              {errorText}
            </m.p>
          )}
        </AnimatePresence>
        <m.button
          type="submit"
          whileTap={animationsEnabled ? { scale: 0.98 } : undefined}
          transition={SPRING_PRESS}
          className="w-full py-2.5 bg-[var(--accent3)] text-[var(--bg-main)] font-sans font-medium text-sm hover:opacity-90 transition-opacity duration-150 cursor-pointer text-center rounded-lg mt-4"
        >
          ایجاد سگمنت
        </m.button>
      </Card>
    </form>
  );
}
