"use client";

import { useCallback, useState } from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { resolveSegmentGroup } from "@/features/iot/services/cloudflare/mappers";
import {
  publishAddSegmentCommand,
  publishDeleteSegmentCommand,
} from "@/features/iot/services/mqttService";
import { validateEsp32Pin } from "@/features/iot/utils/pinValidation";

interface UseSegmentManagementProps {
  setActiveWorkspaceView: (view: "home" | "modules" | "automations" | "settings") => void;
  updatePinOnServer: (pin: string, state: boolean) => Promise<boolean>;
}

function createSegmentId(): string {
  return Math.random().toString(36).substring(2, 9);
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
      setGroupConfigs((prev) => {
        const current = prev[finalGroup] || { maxCols: 3 };

        if (groupIcon && !("icon" in current && current.icon)) {
          return { ...prev, [finalGroup]: { ...current, icon: groupIcon } };
        }

        if (!prev[finalGroup]) {
          return { ...prev, [finalGroup]: current };
        }

        return prev;
      });

      setGroupsOrder((prev) => (prev.includes(finalGroup) ? prev : [...prev, finalGroup]));
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
    ) => {
      // Clean Architecture Domain Invariant: Guard against invalid hardware pins
      if (pin && type !== "placeholder") {
        const validation = validateEsp32Pin(pin, type);

        if (!validation.isValid) {
          useIoTStore.getState().showToast(validation.message, "error");

          return;
        }
      }

      const finalGroup = resolveSegmentGroup(group);
      const newSeg = {
        id: createSegmentId(),
        type,
        pin,
        title: title || `کنترل پایه دیجیتال (GPIO ${pin})`,
        group: finalGroup,
        mode: mode || "switch",
        auto_off: auto_off || 0,
        icon,
      };

      ensureGroupRegistered(finalGroup, groupIcon);

      const updated = [...useIoTStore.getState().segments];

      if (targetPlaceholderId) {
        const index = updated.findIndex((s) => s.id === targetPlaceholderId);

        if (index !== -1) {
          newSeg.group = resolveSegmentGroup(updated[index].group);
          updated[index] = newSeg;
        } else {
          updated.push(newSeg);
        }

        setTargetPlaceholderId(null);
      } else {
        updated.push(newSeg);
      }

      setSegments(updated);

      const pinsState = useIoTStore.getState().pinsState;

      if (pin && type !== "placeholder" && type !== "input" && pinsState[pin] === undefined) {
        void updatePinOnServer(pin, false);
      }

      if (type !== "placeholder") {
        publishAddSegmentCommand(newSeg.id, newSeg.type, Number(newSeg.pin) | 0, false);
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
      setSegments(segments.filter((s) => s.id !== id));
      publishDeleteSegmentCommand(id);
    },
    [setSegments],
  );

  const handleRemoveGroup = useCallback(
    (groupId: string) => {
      setGroupsOrder((prev) => prev.filter((g) => g !== groupId));
      setSegments((prev) => prev.filter((s) => resolveSegmentGroup(s.group) !== groupId));
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
