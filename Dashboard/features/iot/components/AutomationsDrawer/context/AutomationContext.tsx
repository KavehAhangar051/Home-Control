"use client";

import { createContext, type ReactNode, use, useMemo } from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { useAutomationForm } from "../hooks/useAutomationForm";

export type AutomationFormHookValue = ReturnType<typeof useAutomationForm>;

export interface AutomationState {
  automations: ReturnType<typeof useIoTStore.getState>["automations"];
  editingId: AutomationFormHookValue["editingId"];
  title: AutomationFormHookValue["title"];
  time: AutomationFormHookValue["time"];
  days: AutomationFormHookValue["days"];
  repeatCount: AutomationFormHookValue["repeatCount"];
  autoType: AutomationFormHookValue["autoType"];
  delayHours: AutomationFormHookValue["delayHours"];
  delayMinutes: AutomationFormHookValue["delayMinutes"];
  city: AutomationFormHookValue["city"];
  temperatureThreshold: AutomationFormHookValue["temperatureThreshold"];
  temperatureCondition: AutomationFormHookValue["temperatureCondition"];
  intervalMinutes: AutomationFormHookValue["intervalMinutes"];
  hasWeatherCondition: AutomationFormHookValue["hasWeatherCondition"];
  actions: AutomationFormHookValue["actions"];
}

export interface AutomationActions {
  setTitle: AutomationFormHookValue["setTitle"];
  setTime: AutomationFormHookValue["setTime"];
  setDays: AutomationFormHookValue["setDays"];
  setRepeatCount: AutomationFormHookValue["setRepeatCount"];
  setAutoType: AutomationFormHookValue["setAutoType"];
  setDelayHours: AutomationFormHookValue["setDelayHours"];
  setDelayMinutes: AutomationFormHookValue["setDelayMinutes"];
  setCity: AutomationFormHookValue["setCity"];
  setTemperatureThreshold: AutomationFormHookValue["setTemperatureThreshold"];
  setTemperatureCondition: AutomationFormHookValue["setTemperatureCondition"];
  setIntervalMinutes: AutomationFormHookValue["setIntervalMinutes"];
  setHasWeatherCondition: AutomationFormHookValue["setHasWeatherCondition"];
  setActions: AutomationFormHookValue["setActions"];
  handleGetLocation: AutomationFormHookValue["handleGetLocation"];
  resetForm: AutomationFormHookValue["resetForm"];
  handleEdit: AutomationFormHookValue["handleEdit"];
  handleSave: AutomationFormHookValue["handleSave"];
  handleDelete: AutomationFormHookValue["handleDelete"];
  handleToggle: AutomationFormHookValue["handleToggle"];
}

export interface AutomationMeta {
  isGettingLocation: boolean;
}

export interface AutomationContextValue {
  state: AutomationState;
  actions: AutomationActions;
  meta: AutomationMeta;
  formHook: AutomationFormHookValue;
}

const AutomationContext = createContext<AutomationContextValue | null>(null);

interface AutomationProviderProps {
  children: ReactNode;
  formHook?: AutomationFormHookValue;
}

/**
 * Lifts automation form and list state into a shared provider so sibling
 * components (AutomationForm, AutomationList) can interact without prop drilling.
 */
export function AutomationProvider({ children, formHook: externalHook }: AutomationProviderProps) {
  const internalHook = useAutomationForm();
  const formHook = externalHook ?? internalHook;
  const automations = useIoTStore((s) => s.automations);

  const value = useMemo<AutomationContextValue>(
    () => ({
      state: {
        automations,
        editingId: formHook.editingId,
        title: formHook.title,
        time: formHook.time,
        days: formHook.days,
        repeatCount: formHook.repeatCount,
        autoType: formHook.autoType,
        delayHours: formHook.delayHours,
        delayMinutes: formHook.delayMinutes,
        city: formHook.city,
        temperatureThreshold: formHook.temperatureThreshold,
        temperatureCondition: formHook.temperatureCondition,
        intervalMinutes: formHook.intervalMinutes,
        hasWeatherCondition: formHook.hasWeatherCondition,
        actions: formHook.actions,
      },
      actions: {
        setTitle: formHook.setTitle,
        setTime: formHook.setTime,
        setDays: formHook.setDays,
        setRepeatCount: formHook.setRepeatCount,
        setAutoType: formHook.setAutoType,
        setDelayHours: formHook.setDelayHours,
        setDelayMinutes: formHook.setDelayMinutes,
        setCity: formHook.setCity,
        setTemperatureThreshold: formHook.setTemperatureThreshold,
        setTemperatureCondition: formHook.setTemperatureCondition,
        setIntervalMinutes: formHook.setIntervalMinutes,
        setHasWeatherCondition: formHook.setHasWeatherCondition,
        setActions: formHook.setActions,
        handleGetLocation: formHook.handleGetLocation,
        resetForm: formHook.resetForm,
        handleEdit: formHook.handleEdit,
        handleSave: formHook.handleSave,
        handleDelete: formHook.handleDelete,
        handleToggle: formHook.handleToggle,
      },
      meta: {
        isGettingLocation: formHook.isGettingLocation,
      },
      formHook,
    }),
    [automations, formHook],
  );

  return <AutomationContext value={value}>{children}</AutomationContext>;
}

export function useOptionalAutomationContext() {
  return use(AutomationContext);
}
