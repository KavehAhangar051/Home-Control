"use client";

import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useState } from "react";
import { DashboardIconPicker } from "@/components/reui/dashboard-icon-picker";
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
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("");
  const [actions, setActions] = useState<DraftMacroAction[]>([]);

  const resetEditor = () => {
    setEditingId(null);
    setTitle("");
    setIcon("");
    setActions([]);
  };

  const editMacro = (macro: Macro) => {
    setEditingId(macro.id);
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

  const saveMacro = () => {
    const cleanActions: MacroAction[] = actions.map(({ draftId: _draftId, ...action }) => action);
    const validationError = validateMacroDraft(title, cleanActions, segments);
    if (validationError) {
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

  return (
    <section className="space-y-5 text-right" dir="rtl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-text-primary">مدیریت دکمه‌های سفارشی</h3>
          <p className="text-xs leading-6 text-text-secondary">
            برای هر دکمه عملیات‌های دیجیتال و آنالوگ (PWM) به‌همراه شرط‌های لحظه‌ای قابل بررسی در
            داشبورد تعریف کنید. هنگام کلیک، ابتدا شرط‌ها در داشبورد چک می‌شوند و در صورت برقراری،
            فرمان‌ها به ESP ارسال خواهند شد.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingId("new");
            setTitle("");
            setIcon("");
            setActions([]);
          }}
          className="min-h-10 cursor-pointer rounded-xl bg-accent3 px-4 py-2 text-xs font-semibold text-accent3-foreground"
        >
          + افزودن دکمه
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
              <h4 className="text-sm font-semibold text-text-primary">
                {editingId === "new" ? "ساخت دکمه جدید" : "ویرایش دکمه"}
              </h4>

              <div className="grid items-start gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 text-xs text-text-secondary">
                  <label htmlFor="custom-macro-title" className="block font-medium">
                    نام دکمه
                  </label>
                  <Input
                    id="custom-macro-title"
                    value={title}
                    maxLength={40}
                    onChange={(event) => setTitle(event.target.value)}
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
              </div>

              <div className="flex items-center justify-between gap-2">
                <h5 className="text-xs font-semibold text-text-primary">
                  عملیات ({actions.length})
                </h5>
                <button
                  type="button"
                  disabled={!outputs.length}
                  onClick={addAction}
                  className="cursor-pointer rounded-lg border border-border-color px-3 py-2 text-xs text-text-primary hover:border-accent3 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  + افزودن عملیات
                </button>
              </div>

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

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveMacro}
                  className="min-h-10 cursor-pointer rounded-xl bg-accent3 px-4 py-2 text-xs font-semibold text-accent3-foreground"
                >
                  ذخیره دکمه
                </button>
                <button
                  type="button"
                  onClick={resetEditor}
                  className="min-h-10 cursor-pointer rounded-xl border border-border-color px-4 py-2 text-xs text-text-secondary"
                >
                  انصراف
                </button>
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
