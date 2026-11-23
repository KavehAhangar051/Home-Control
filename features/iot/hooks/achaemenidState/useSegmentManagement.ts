"use client";

import { useCallback, useState } from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { resolveSegmentGroup } from "@/features/iot/services/cloudflare/mappers";
import {
  publishAddSegmentCommand,
  publishAddVirtualSegmentCommand,
  publishDeleteAuxNodeCommand,
  publishDeleteSegmentCommand,
  publishUpsertAuxNodeCommand,
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
  type CreateAuxNodeInput,
  findAuxNodeByGroup,
  planCreateAuxNode,
  planRemoveSegmentWithAuxRestore,
  planUpdateAuxNode,
} from "@/features/iot/utils/auxNodeUtils";

import {
  createSegmentId,
  planAddSegment,
  planGroupConfigRegistration,
  planGroupOrderRegistration,
  planRemoveGroup,
} from "./core/segmentOperations";

export interface VirtualSegmentAddOptions {
  isVirtual?: boolean;
  nodeId?: number;
  remotePin?: number;
}

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
  const setAuxNodes = useIoTStore((state) => state.setAuxNodes);
  const removeAuxNode = useIoTStore((state) => state.removeAuxNode);
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
      virtualOptions?: VirtualSegmentAddOptions,
    ) => {
      const storeBefore = useIoTStore.getState();
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
          isVirtual: virtualOptions?.isVirtual,
          nodeId: virtualOptions?.nodeId,
          remotePin: virtualOptions?.remotePin,
        },
        segments: storeBefore.segments,
        auxNodes: storeBefore.auxNodes,
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
      const createdPin = created.pin;

      if (type !== "placeholder") {
        const pwmMeta = isAnalogOutput
          ? {
              pwmResolution: created.pwmResolution,
              pwmFrequency: created.pwmFrequency,
              initialValue: created.analogValue ?? 0,
            }
          : undefined;
        const adcMeta = isAnalogInput
          ? {
              adcResolution: created.adcResolution,
              adcSampleIntervalMs: created.adcSampleIntervalMs,
              adcDeltaThreshold: created.adcDeltaThreshold,
              adcHighThreshold: created.adcHighThreshold,
              adcLowThreshold: created.adcLowThreshold,
            }
          : undefined;

        if (created.isVirtual && created.nodeId !== undefined && created.remotePin !== undefined) {
          publishAddVirtualSegmentCommand({
            virtualPin: Number(created.pin) | 0,
            nodeId: created.nodeId,
            remotePin: created.remotePin,
            id: created.id,
            type: created.type,
            initState: false,
            analogOptions: pwmMeta,
            analogInputOptions: adcMeta,
          });
        } else {
          publishAddSegmentCommand(
            created.id,
            created.type,
            Number(created.pin) | 0,
            false,
            pwmMeta,
            adcMeta,
          );
        }
      }

      if (isAnalogOutput && createdPin) {
        const initVal = created.analogValue ?? 0;
        const res = created.pwmResolution ?? 8;
        const lastNonZero = created.lastNonZeroValue ?? getAnalogMaxDuty(res);

        storeSnapshot.setPinsPwmResolution((prev) => ({ ...prev, [createdPin]: res }));
        storeSnapshot.setPinsAnalogValue((prev) => ({ ...prev, [createdPin]: initVal }));
        storeSnapshot.setPinsLastNonZeroValue((prev) => ({ ...prev, [createdPin]: lastNonZero }));
        storeSnapshot.setPinsState((prev) => ({ ...prev, [createdPin]: initVal > 0 }));
      } else if (isAnalogInput && createdPin) {
        const res = created.adcResolution ?? DEFAULT_ADC_RESOLUTION;

        storeSnapshot.setPinsPwmResolution((prev) => ({ ...prev, [createdPin]: res }));
        storeSnapshot.setPinsAnalogValue((prev) => ({ ...prev, [createdPin]: 0 }));
        storeSnapshot.setPinsState((prev) => ({ ...prev, [createdPin]: false }));
      } else if (
        createdPin &&
        type !== "placeholder" &&
        type !== "input" &&
        storeSnapshot.pinsState[createdPin] === undefined
      ) {
        if (created.isVirtual) {
          // 0x11 ADD_VIRTUAL_SEGMENT already carries initState=false; initialize local state without redundant 0x01
          storeSnapshot.setPinsState((prev) => ({ ...prev, [createdPin]: false }));
        } else {
          void updatePinOnServer(createdPin, false);
        }
      }
    },
    [targetPlaceholderId, ensureGroupRegistered, setSegments, updatePinOnServer],
  );

  const handleCreateAuxNode = useCallback(
    (input: CreateAuxNodeInput): boolean => {
      const store = useIoTStore.getState();
      const plan = planCreateAuxNode({
        input,
        auxNodes: store.auxNodes,
        groupsOrder: store.groupsOrder,
        groupConfigs: store.groupConfigs,
        segments: store.segments,
        createId: createSegmentId,
      });

      if (!plan.ok) {
        store.showToast(plan.errorMessage, "error");
        return false;
      }

      publishUpsertAuxNodeCommand({
        nodeId: plan.node.nodeId,
        mac: plan.node.mac,
        pinCapacity: plan.node.pinCapacity,
        chipType: plan.node.chipType,
        name: plan.node.name,
      });

      setAuxNodes(plan.nextAuxNodes);
      setGroupsOrder(plan.nextGroupsOrder);
      setGroupConfigs(plan.nextGroupConfigs);
      setSegments(plan.nextSegments);

      store.showToast(
        `برد کمکی «${plan.node.name}» با ${plan.placeholdersCreated} جایگاه خالی ثبت شد.`,
        "success",
      );

      return true;
    },
    [setAuxNodes, setGroupConfigs, setGroupsOrder, setSegments],
  );

  const handleUpdateAuxNode = useCallback(
    (nodeId: number, input: CreateAuxNodeInput): boolean => {
      const store = useIoTStore.getState();
      const plan = planUpdateAuxNode({
        nodeId,
        input,
        auxNodes: store.auxNodes,
        groupsOrder: store.groupsOrder,
        groupConfigs: store.groupConfigs,
        segments: store.segments,
        createId: createSegmentId,
      });

      if (!plan.ok) {
        store.showToast(plan.errorMessage, "error");
        return false;
      }

      publishUpsertAuxNodeCommand({
        nodeId: plan.node.nodeId,
        mac: plan.node.mac,
        pinCapacity: plan.node.pinCapacity,
        chipType: plan.node.chipType,
        name: plan.node.name,
      });

      setAuxNodes(plan.nextAuxNodes);
      setGroupsOrder(plan.nextGroupsOrder);
      setGroupConfigs(plan.nextGroupConfigs);
      setSegments(plan.nextSegments);

      store.showToast(`تنظیمات برد کمکی «${plan.node.name}» به‌روزرسانی شد.`, "success");

      return true;
    },
    [setAuxNodes, setGroupConfigs, setGroupsOrder, setSegments],
  );

  const handleAddPlaceholder = useCallback(
    (groupId: string) => {
      const store = useIoTStore.getState();
      const auxNode = findAuxNodeByGroup(store.auxNodes, groupId);
      setSegments([
        ...store.segments,
        {
          id: createSegmentId(),
          type: "placeholder",
          pin: "",
          title: auxNode ? "جایگاه خالی برد کمکی" : "جایگاه خالی",
          group: groupId,
          ...(auxNode ? { isVirtual: true, nodeId: auxNode.nodeId } : {}),
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
      const store = useIoTStore.getState();
      const { removed, nextSegments } = planRemoveSegmentWithAuxRestore({
        id,
        segments: store.segments,
        auxNodes: store.auxNodes,
        createId: createSegmentId,
      });

      setSegments(nextSegments);

      if (removed && removed.type !== "placeholder") {
        publishDeleteSegmentCommand(removed.id, removed.pin);
      }
    },
    [setSegments],
  );

  const handleRemoveGroup = useCallback(
    (groupId: string) => {
      const store = useIoTStore.getState();
      const auxNode = findAuxNodeByGroup(store.auxNodes, groupId);

      if (auxNode) {
        publishDeleteAuxNodeCommand(auxNode.nodeId, true, auxNode.mac);
        removeAuxNode(auxNode.nodeId);
        setGroupsOrder(
          (prev) => planRemoveGroup({ groupsOrder: prev, segments: [], groupId }).nextGroupsOrder,
        );
        setSegments((prev) =>
          prev.filter(
            (segment) =>
              resolveSegmentGroup(segment.group) !== groupId &&
              !(segment.isVirtual && segment.nodeId === auxNode.nodeId),
          ),
        );
        store.showToast(`برد کمکی «${auxNode.name}» و سگمنت‌های آن حذف شدند.`, "success");
        return;
      }

      const currentSegments = store.segments;
      for (const segment of currentSegments) {
        if (resolveSegmentGroup(segment.group) === groupId && segment.type !== "placeholder") {
          publishDeleteSegmentCommand(segment.id, segment.pin);
        }
      }
      setGroupsOrder(
        (prev) => planRemoveGroup({ groupsOrder: prev, segments: [], groupId }).nextGroupsOrder,
      );
      setSegments(
        (prev) => planRemoveGroup({ groupsOrder: [], segments: prev, groupId }).nextSegments,
      );
    },
    [removeAuxNode, setGroupsOrder, setSegments],
  );

  return {
    targetPlaceholderId,
    clearTargetPlaceholder,
    handleAddSegment,
    handleCreateAuxNode,
    handleUpdateAuxNode,
    handleAddPlaceholder,
    handleSetupPlaceholder,
    handleGroupColsChange,
    handleRemoveSegment,
    handleRemoveGroup,
  };
}
