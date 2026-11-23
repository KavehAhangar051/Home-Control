"use client";

import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useState } from "react";
import { type ProgressStepItem, ProgressSteps } from "@/components/motion/progress-steps";
import { DashboardIconPicker } from "@/components/reui/dashboard-icon-picker";
import { Edit2, Info } from "@/components/ui/hugeicons-groups/controls";
import { ChevronLeft, ChevronRight, Plus } from "@/components/ui/hugeicons-groups/shell";
import { Input } from "@/components/ui/input";
import { MacroGlyph } from "@/features/dashboard/components/widgets/MacroSidebar";
import type { Macro, MacroAction } from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import {
  clampPwmResolution,
  hasExplicitAnalogTargetValue,
  isAnalogOutputSegment,
  percentToAnalogDuty,
} from "@/features/iot/utils/analogOutput";
import {
  isControllableMacroOutput,
  normalizeMacroRecord,
  validateMacroDraft,
} from "@/features/iot/utils/macroEngine";
import { EASE_OUT } from "@/lib/ease";
import { MacroActionCard } from "./MacroActionCard";

type DraftMacroAction = MacroAction & { draftId: string };
type MacroWizardStep = 0 | 1;

const MACRO_STEPS: readonly ProgressStepItem[] = [
  {
    id: "identity",
    title: "مشخصات دکمه",
    description: "نام و آیکون دکمه سفارشی برای نمایش در نوار سریع را انتخاب کنید",
  },
  {
    id: "actions",
    title: "عملیات و شرط‌ها",
    description: "فرمان‌های دیجیتال یا آنالوگ (PWM) و شرط‌های اختیاری اجرا را تنظیم کنید",
  },
];

export default function MacrosSection() {
  const macros = useIoTStore((state) => state.macros);
  const setMacros = useIoTStore((state) => state.setMacros);
  const segments = useIoTStore((state) => state.segments);
  const pinsPwmResolution = useIoTStore((state) => state.pinsPwmResolution);
  const showToast = useIoTStore((state) => state.showToast);
  const animationsEnabled = useIoTStore((state) => state.animationsEnabled);
  const prefersReduced = useReducedMotion();
  const reduceMotion = !animationsEnabled || Boolean(prefersReduced);

  const outputs = segments.filter((segment) => isControllableMacroOutput(segment));

  const [editingId, setEditingId] = useState<string | null>(null);
  const [step, setStep] = useState<MacroWizardStep>(0);
  const [maxUnlockedStep, setMaxUnlockedStep] = useState<MacroWizardStep>(0);
  const [stepDirection, setStepDirection] = useState<1 | -1>(1);
  const [stepError, setStepError] = useState("");
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("");
  const [actions, setActions] = useState<DraftMacroAction[]>([]);

  const resetEditor = () => {
    setEditingId(null);
    setStep(0);
    setMaxUnlockedStep(0);
    setStepError("");
    setTitle("");
    setIcon("");
    setActions([]);
  };

  const startNewMacro = () => {
    setEditingId("new");
    setStep(0);
    setMaxUnlockedStep(0);
    setStepDirection(1);
    setStepError("");
    setTitle("");
    setIcon("");
    setActions([]);
  };

  const editMacro = (macro: Macro) => {
    setEditingId(macro.id);
    setStep(0);
    setMaxUnlockedStep(1);
    setStepDirection(1);
    setStepError("");
    setTitle(macro.title);
    setIcon(macro.icon ?? "");
    setActions(macro.actions.map((action) => ({ ...action, draftId: crypto.randomUUID() })));
  };

  const addAction = () => {
    const firstOutput = outputs[0];
    if (!firstOutput) return;

    const isAnalog = isAnalogOutputSegment(firstOutput);
    const defaultDuty = isAnalog
      ? percentToAnalogDuty(
          50,
          clampPwmResolution(pinsPwmResolution[firstOutput.pin] ?? firstOutput.pwmResolution),
        )
      : undefined;

    setStepError("");
    setActions((current) => [
      ...current,
      {
        targetPin: firstOutput.pin,
        actionOn: true,
        ...(defaultDuty !== undefined ? { targetValue: defaultDuty } : {}),
        draftId: crypto.randomUUID(),
      },
    ]);
  };

  const updateAction = (index: number, updates: Partial<MacroAction>) => {
    setActions((current) =>
      current.map((item, i) => (i === index ? { ...item, ...updates } : item)),
    );
  };

  const removeAction = (index: number) => {
    setActions((current) => current.filter((_, i) => i !== index));
  };

  const goToActionsStep = () => {
    if (!title.trim()) {
      setStepError("لطفاً ابتدا نام دکمه سفارشی را وارد کنید.");
      return;
    }

    setStepError("");
    setStepDirection(1);
    setStep(1);
    setMaxUnlockedStep(1);
  };

  const handleStepClick = (targetIndex: number) => {
    if (targetIndex === 0) {
      setStepError("");
      setStepDirection(-1);
      setStep(0);
      return;
    }

    if (targetIndex === 1) {
      goToActionsStep();
    }
  };

  const saveMacro = () => {
    const cleanActions: MacroAction[] = actions.map(({ draftId: _draftId, ...action }) => action);
    const validationError = validateMacroDraft(title, cleanActions, segments);
    if (validationError) {
      setStepError(validationError);
      showToast(validationError, "error");
      return;
    }

    const macro = normalizeMacroRecord({
      id: editingId === "new" ? `macro_${Date.now()}` : (editingId ?? `macro_${Date.now()}`),
      title: title.trim(),
      ...(icon.trim() ? { icon: icon.trim() } : {}),
      actions: cleanActions,
    });

    setMacros((current) =>
      editingId === "new"
        ? [...current, macro]
        : current.map((item) => (item.id === editingId ? macro : item)),
    );
    showToast(editingId === "new" ? "دکمه سفارشی ساخته شد." : "دکمه سفارشی ویرایش شد.", "success");
    resetEditor();
  };

  const removeMacro = (id: string) => {
    setMacros((current) => current.filter((macro) => macro.id !== id));
    if (editingId === id) resetEditor();
    showToast("دکمه سفارشی حذف شد.", "success");
  };

  const slideOffset = stepDirection * -12;

  return (
    <section className="space-y-5 text-right" dir="rtl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-text-primary">مدیریت دکمه‌های سفارشی</h3>
          <p className="text-xs leading-6 text-text-secondary">
            برای هر دکمه عملیات‌های دیجیتال و آنالوگ (PWM) به‌همراه شرط‌های لحظه‌ای تعریف کنید تا با یک
            کلیک اجرا شوند.
          </p>
        </div>
        <button
          type="button"
          onClick={startNewMacro}
          className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-accent3 px-4 py-2 text-xs font-semibold text-accent3-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset"
        >
          <Plus className="size-3.5" strokeWidth={2} aria-hidden="true" />
          <span>افزودن دکمه</span>
        </button>
      </header>

      {!outputs.length && (
        <p className="rounded-xl border border-dashed border-border-color p-4 text-xs leading-6 text-text-secondary">
          ابتدا از بخش «پالایه و ماژول‌ها» حداقل یک قطعه خروجی (دیجیتال یا آنالوگ PWM) اضافه کنید.
        </p>
      )}

      <AnimatePresence initial={false}>
        {editingId !== null && (
          <m.div
            key="macro-editor-panel"
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={
              reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }
            }
            transition={
              reduceMotion
                ? { duration: 0 }
                : {
                    height: { duration: 0.22, ease: EASE_OUT },
                    opacity: { duration: 0.16, ease: EASE_OUT },
                  }
            }
            className="overflow-hidden"
            style={{ contain: "layout style", backfaceVisibility: "hidden" }}
          >
            <div className="space-y-4 rounded-2xl border border-accent3/40 bg-card-bg-solid p-4">
              <div className="space-y-3 border-b border-border-color/80 pb-3.5">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                    {editingId === "new" ? (
                      <Plus className="size-4 text-accent3" strokeWidth={1.75} aria-hidden="true" />
                    ) : (
                      <Edit2
                        className="size-4 text-accent3"
                        strokeWidth={1.75}
                        aria-hidden="true"
                      />
                    )}
                    <span>{editingId === "new" ? "ساخت دکمه جدید" : "ویرایش دکمه"}</span>
                  </h4>
                  <span className="text-[11px] font-medium tabular-nums text-text-muted">
                    مرحله {step + 1} از {MACRO_STEPS.length}
                  </span>
                </div>

                <ProgressSteps
                  steps={MACRO_STEPS}
                  currentStep={step}
                  maxReachableStep={editingId !== "new" ? 1 : maxUnlockedStep}
                  onStepClick={handleStepClick}
                  animationsEnabled={!reduceMotion}
                  ariaLabel="مراحل ساخت دکمه سفارشی"
                />
              </div>

              <AnimatePresence mode="wait" initial={false}>
                {step === 0 && (
                  <m.div
                    key="macro-step-0"
                    initial={reduceMotion ? false : { opacity: 0, x: slideOffset }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={
                      reduceMotion
                        ? { opacity: 0, transition: { duration: 0 } }
                        : {
                            opacity: 0,
                            x: -slideOffset,
                            transition: { duration: 0.14, ease: EASE_OUT },
                          }
                    }
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: EASE_OUT }}
                    className="grid items-start gap-3 sm:grid-cols-2"
                  >
                    <div className="space-y-1.5 text-xs text-text-secondary">
                      <label htmlFor="custom-macro-title" className="block font-medium">
                        نام دکمه
                      </label>
                      <Input
                        id="custom-macro-title"
                        value={title}
                        maxLength={40}
                        onChange={(event) => {
                          setTitle(event.target.value);
                          if (stepError) setStepError("");
                        }}
                        placeholder="مثلاً روشنایی پذیرایی"
                      />
                    </div>
                    <DashboardIconPicker
                      label="آیکون یا ایموجی"
                      isOptional
                      selectedIcon={icon}
                      onSelectIcon={setIcon}
                      allowCustomText
                      inputId="custom-macro-icon"
                    />
                  </m.div>
                )}

                {step === 1 && (
                  <m.div
                    key="macro-step-1"
                    initial={reduceMotion ? false : { opacity: 0, x: slideOffset }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={
                      reduceMotion
                        ? { opacity: 0, transition: { duration: 0 } }
                        : {
                            opacity: 0,
                            x: -slideOffset,
                            transition: { duration: 0.14, ease: EASE_OUT },
                          }
                    }
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: EASE_OUT }}
                    className="space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-color/80 bg-secondary/35 px-3 py-2 text-xs">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-card-bg-solid text-sm">
                          <MacroGlyph icon={icon} className="size-4" />
                        </span>
                        <span className="truncate font-semibold text-text-primary">
                          {title.trim() || "دکمه بدون نام"}
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={!outputs.length}
                        onClick={addAction}
                        className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border-color bg-card-bg-solid px-3 text-xs font-medium text-text-primary transition-colors hover:border-accent3 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Plus className="size-3.5" strokeWidth={2} aria-hidden="true" />
                        <span>افزودن عملیات ({actions.length})</span>
                      </button>
                    </div>

                    {actions.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-border-color bg-card-bg/60 px-3 py-5 text-center text-xs text-text-muted">
                        هنوز عملیاتی برای این دکمه ثبت نشده است؛ روی «افزودن عملیات» بزنید.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {actions.map((action, index) => (
                          <MacroActionCard
                            key={action.draftId}
                            index={index}
                            action={action}
                            outputs={outputs}
                            allSegments={segments}
                            onChange={(updates) => updateAction(index, updates)}
                            onRemove={() => removeAction(index)}
                          />
                        ))}
                      </div>
                    )}
                  </m.div>
                )}
              </AnimatePresence>

              {stepError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                >
                  <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  <span className="leading-5">{stepError}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-color/80 pt-3">
                <div className="flex items-center gap-2">
                  {step === 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setStepError("");
                        setStepDirection(-1);
                        setStep(0);
                      }}
                      className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-border-color bg-card-bg px-3.5 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
                    >
                      <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
                      <span>مرحله قبل</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={resetEditor}
                    className="min-h-10 cursor-pointer rounded-xl border border-border-color px-4 py-2 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
                  >
                    انصراف
                  </button>
                </div>

                {step === 0 ? (
                  <button
                    type="button"
                    onClick={goToActionsStep}
                    className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-accent3 px-4 py-2 text-xs font-semibold text-accent3-foreground transition-opacity hover:opacity-90"
                  >
                    <span>مرحله بعد</span>
                    <ChevronLeft className="size-4" strokeWidth={2} aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={saveMacro}
                    className="min-h-10 cursor-pointer rounded-xl bg-accent3 px-4 py-2 text-xs font-semibold text-accent3-foreground transition-opacity hover:opacity-90"
                  >
                    ذخیره دکمه
                  </button>
                )}
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      <div className="grid gap-3 sm:grid-cols-2">
        {macros.map((macro) => {
          const analogCount = macro.actions.filter((a) =>
            hasExplicitAnalogTargetValue(a.targetValue),
          ).length;
          const conditionedCount = macro.actions.filter((a) => a.condition?.enabled).length;

          return (
            <article
              key={macro.id}
              className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border-color bg-card-bg-solid p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-card-hover-bg text-lg">
                  <MacroGlyph icon={macro.icon} className="size-5" />
                </span>
                <div className="min-w-0 space-y-0.5">
                  <h4 className="truncate text-sm font-semibold text-text-primary">
                    {macro.title}
                  </h4>
                  <p className="text-[11px] text-text-muted">
                    {macro.actions.length} عملیات
                    {analogCount > 0 ? ` • ${analogCount} آنالوگ` : ""}
                    {conditionedCount > 0 ? ` • ${conditionedCount} شرط‌دار` : ""}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => editMacro(macro)}
                  className="cursor-pointer rounded-lg border border-border-color px-3 py-2 text-xs text-text-secondary hover:border-accent3 hover:text-text-primary"
                >
                  ویرایش
                </button>
                <button
                  type="button"
                  onClick={() => removeMacro(macro.id)}
                  className="cursor-pointer rounded-lg border border-border-color px-3 py-2 text-xs text-destructive hover:border-destructive/60"
                >
                  حذف
                </button>
              </div>
            </article>
          );
        })}
        {macros.length === 0 && editingId === null && (
          <p className="sm:col-span-2 rounded-xl border border-dashed border-border-color p-6 text-center text-xs text-text-secondary">
            هنوز دکمه سفارشی‌ای نساخته‌اید.
          </p>
        )}
      </div>
    </section>
  );
}
