"use client";

import { useCallback, useState } from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { resolveSegmentGroup } from "@/features/iot/services/cloudflare/mappers";
import {
  publishAddSegmentCommand,
  publishDeleteSegmentCommand,
} from "@/features/iot/services/mqtt/segmentPublishers";
import {
  type AnalogInputSegmentOptions,
  DEFAULT_ADC_RESOLUTION,
  isAnalogInputSegment,
} from "@/features/iot/utils/analogInput";
import {
  type AnalogSegmentOptions,
  getAnalogMaxDuty,
  isAnalogOutputSegment,
} from "@/features/iot/utils/analogOutput";

import {
  createSegmentId,
  planAddSegment,
  planGroupConfigRegistration,
  planGroupOrderRegistration,
  planRemoveGroup,
} from "./core/segmentOperations";

interface UseSegmentManagementProps {
  setActiveWorkspaceView: (view: "home" | "modules" | "automations" | "settings") => void;
  updatePinOnServer: (pin: string, state: boolean) => Promise<boolean>;
}

export function useSegmentManagement({
  setActiveWorkspaceView,
  updatePinOnServer,
}: UseSegmentManagementProps) {
  const setSegments = useIoTStore((state) => state.setSegments);
  const setGroupsOrder = useIoTStore((state) => state.setGroupsOrder);
  const setGroupConfigs = useIoTStore((state) => state.setGroupConfigs);
  const [targetPlaceholderId, setTargetPlaceholderId] = useState<string | null>(null);

  const ensureGroupRegistered = useCallback(
    (finalGroup: string, groupIcon?: string) => {
      setGroupConfigs((prev) => planGroupConfigRegistration(prev, finalGroup, groupIcon));

      setGroupsOrder((prev) =>
        prev.includes(finalGroup) ? prev : planGroupOrderRegistration(prev, finalGroup),
      );
    },
    [setGroupConfigs, setGroupsOrder],
  );

  const handleAddSegment = useCallback(
    (
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
    ) => {
      const decision = planAddSegment({
        input: {
          type,
          pin,
          title,
          group,
          mode,
          auto_off,
          icon,
          groupIcon,
          analogConfig,
          analogInputConfig,
        },
        segments: useIoTStore.getState().segments,
        targetPlaceholderId,
      });

      if ("errorMessage" in decision) {
        useIoTStore.getState().showToast(decision.errorMessage, "error");

        return;
      }

      ensureGroupRegistered(decision.finalGroup, groupIcon);

      if (targetPlaceholderId) {
        setTargetPlaceholderId(null);
      }

      setSegments(decision.nextSegments);

      const storeSnapshot = useIoTStore.getState();
      const created = decision.newSegment;
      const isAnalogOutput = isAnalogOutputSegment(created);
      const isAnalogInput = isAnalogInputSegment(created);

      if (isAnalogOutput && created.pin) {
        const initVal = created.analogValue ?? 0;
        const res = created.pwmResolution ?? 8;
        const lastNonZero = created.lastNonZeroValue ?? getAnalogMaxDuty(res);

        storeSnapshot.setPinsPwmResolution((prev) => ({ ...prev, [created.pin]: res }));
        storeSnapshot.setPinsAnalogValue((prev) => ({ ...prev, [created.pin]: initVal }));
        storeSnapshot.setPinsLastNonZeroValue((prev) => ({ ...prev, [created.pin]: lastNonZero }));
        storeSnapshot.setPinsState((prev) => ({ ...prev, [created.pin]: initVal > 0 }));
      } else if (isAnalogInput && created.pin) {
        const res = created.adcResolution ?? DEFAULT_ADC_RESOLUTION;

        storeSnapshot.setPinsPwmResolution((prev) => ({ ...prev, [created.pin]: res }));
        storeSnapshot.setPinsAnalogValue((prev) => ({ ...prev, [created.pin]: 0 }));
        storeSnapshot.setPinsState((prev) => ({ ...prev, [created.pin]: false }));
      } else if (
        pin &&
        type !== "placeholder" &&
        type !== "input" &&
        storeSnapshot.pinsState[pin] === undefined
      ) {
        void updatePinOnServer(pin, false);
      }

      if (type !== "placeholder") {
        publishAddSegmentCommand(
          created.id,
          created.type,
          Number(created.pin) | 0,
          false,
          isAnalogOutput
            ? {
                pwmResolution: created.pwmResolution,
                pwmFrequency: created.pwmFrequency,
                initialValue: created.analogValue ?? 0,
              }
            : undefined,
          isAnalogInput
            ? {
                adcResolution: created.adcResolution,
                adcSampleIntervalMs: created.adcSampleIntervalMs,
                adcDeltaThreshold: created.adcDeltaThreshold,
                adcHighThreshold: created.adcHighThreshold,
                adcLowThreshold: created.adcLowThreshold,
              }
            : undefined,
        );
      }
    },
    [targetPlaceholderId, ensureGroupRegistered, setSegments, updatePinOnServer],
  );

  const handleAddPlaceholder = useCallback(
    (groupId: string) => {
      const segments = useIoTStore.getState().segments;
      setSegments([
        ...segments,
        {
          id: createSegmentId(),
          type: "placeholder",
          pin: "",
          title: "جایگاه خالی",
          group: groupId,
        },
      ]);
    },
    [setSegments],
  );

  const handleSetupPlaceholder = useCallback(
    (id: string) => {
      setTargetPlaceholderId(id);
      useIoTStore.getState().setActiveModulesTab("add");
      setActiveWorkspaceView("modules");
    },
    [setActiveWorkspaceView],
  );

  const clearTargetPlaceholder = useCallback(() => {
    setTargetPlaceholderId(null);
  }, []);

  const handleGroupColsChange = useCallback(
    (group: string, maxCols: number) => {
      setGroupConfigs((prev) => ({ ...prev, [group]: { ...prev[group], maxCols } }));
    },
    [setGroupConfigs],
  );

  const handleRemoveSegment = useCallback(
    (id: string) => {
      const segments = useIoTStore.getState().segments;
      const target = segments.find((segment) => segment.id === id);
      setSegments(segments.filter((s) => s.id !== id));
      if (target && target.type !== "placeholder") {
        publishDeleteSegmentCommand(id);
      }
    },
    [setSegments],
  );

  const handleRemoveGroup = useCallback(
    (groupId: string) => {
      const currentSegments = useIoTStore.getState().segments;
      for (const segment of currentSegments) {
        if (resolveSegmentGroup(segment.group) === groupId && segment.type !== "placeholder") {
          publishDeleteSegmentCommand(segment.id);
        }
      }
      setGroupsOrder(
        (prev) => planRemoveGroup({ groupsOrder: prev, segments: [], groupId }).nextGroupsOrder,
      );
      setSegments(
        (prev) => planRemoveGroup({ groupsOrder: [], segments: prev, groupId }).nextSegments,
      );
    },
    [setGroupsOrder, setSegments],
  );

  return {
    targetPlaceholderId,
    clearTargetPlaceholder,
    handleAddSegment,
    handleAddPlaceholder,
    handleSetupPlaceholder,
    handleGroupColsChange,
    handleRemoveSegment,
    handleRemoveGroup,
  };
}
