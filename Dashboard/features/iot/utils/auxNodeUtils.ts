import type { GroupsSlice, Segment } from "@/features/iot/hooks/store/types";
import {
  AUX_CHIP_CODE_MAP,
  AUX_CHIP_FROM_CODE,
  type AuxChipType,
  type AuxNodeConfig,
} from "@/features/iot/services/config/types";

export const LOCAL_GPIO_MIN = 0;
export const LOCAL_GPIO_MAX = 39;
export const VIRTUAL_PIN_MIN = 40;
export const VIRTUAL_PIN_MAX = 127;
export const MAX_AUX_NODES = 16;
export const MAX_AUX_PIN_CAPACITY = 32;
export const MAX_TOTAL_SEGMENTS = 48;
export const AUX_NODE_NAME_MAX_BYTES = 31;

export interface AuxChipMeta {
  chipType: AuxChipType;
  code: number;
  label: string;
  shortLabel: string;
  defaultCapacity: number;
  suggestedPins: readonly number[];
  recommendedPins?: readonly number[];
  pinNotes?: Readonly<Record<number, string>>;
}

export const AUX_CHIP_META: Readonly<Record<AuxChipType, AuxChipMeta>> = {
  unknown: {
    chipType: "unknown",
    code: AUX_CHIP_CODE_MAP.unknown,
    label: "برد سفارشی (ESP)",
    shortLabel: "ESP",
    defaultCapacity: 4,
    suggestedPins: Array.from({ length: 40 }, (_, i) => i),
  },
  esp8266_01: {
    chipType: "esp8266_01",
    code: AUX_CHIP_CODE_MAP.esp8266_01,
    label: "ESP8266-01 / 01S",
    shortLabel: "ESP8266-01",
    defaultCapacity: 2,
    suggestedPins: [0, 2, 1, 3],
    recommendedPins: [0, 2],
    pinNotes: {
      0: "پیشنهادی (GPIO0)",
      2: "پیشنهادی (GPIO2)",
      1: "اختیاری (TX)",
      3: "اختیاری (RX)",
    },
  },
  esp8266_12: {
    chipType: "esp8266_12",
    code: AUX_CHIP_CODE_MAP.esp8266_12,
    label: "ESP8266-12E / NodeMCU",
    shortLabel: "ESP8266-12",
    defaultCapacity: 8,
    suggestedPins: [0, 2, 4, 5, 12, 13, 14, 15, 16, 17],
    pinNotes: {
      17: "A0 (آنالوگ)",
    },
  },
  esp32: {
    chipType: "esp32",
    code: AUX_CHIP_CODE_MAP.esp32,
    label: "ESP32 DevKit",
    shortLabel: "ESP32",
    defaultCapacity: 12,
    suggestedPins: [
      2, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33, 34, 35, 36, 39,
    ],
  },
  esp32_c3: {
    chipType: "esp32_c3",
    code: AUX_CHIP_CODE_MAP.esp32_c3,
    label: "ESP32-C3",
    shortLabel: "ESP32-C3",
    defaultCapacity: 8,
    suggestedPins: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 21],
  },
  esp32_s3: {
    chipType: "esp32_s3",
    code: AUX_CHIP_CODE_MAP.esp32_s3,
    label: "ESP32-S3",
    shortLabel: "ESP32-S3",
    defaultCapacity: 12,
    suggestedPins: [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 38, 39,
    ],
  },
};

export const AUX_CHIP_OPTIONS: readonly AuxChipMeta[] = [
  AUX_CHIP_META.esp8266_01,
  AUX_CHIP_META.esp8266_12,
  AUX_CHIP_META.esp32,
  AUX_CHIP_META.esp32_c3,
  AUX_CHIP_META.esp32_s3,
  AUX_CHIP_META.unknown,
];

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function isLocalGpioPin(pin: number): boolean {
  return Number.isInteger(pin) && pin >= LOCAL_GPIO_MIN && pin <= LOCAL_GPIO_MAX;
}

export function isVirtualPin(pin: number): boolean {
  return Number.isInteger(pin) && pin >= VIRTUAL_PIN_MIN && pin <= VIRTUAL_PIN_MAX;
}

export function isValidManagedPin(pin: number): boolean {
  return Number.isInteger(pin) && pin >= LOCAL_GPIO_MIN && pin <= VIRTUAL_PIN_MAX;
}

export function isValidRemotePin(pin: number): boolean {
  return Number.isInteger(pin) && pin >= LOCAL_GPIO_MIN && pin <= LOCAL_GPIO_MAX;
}

/**
 * Safely truncates a UTF-8 string so its encoded byte length never exceeds `maxBytes`
 * without splitting multi-byte Persian/Unicode code points.
 */
export function truncateUtf8Bytes(input: string, maxBytes: number): Uint8Array {
  const trimmed = input.trim();
  const full = textEncoder.encode(trimmed);

  if (full.length <= maxBytes) {
    return full;
  }

  let end = maxBytes;
  // Walk back past any UTF-8 continuation bytes (10xxxxxx)
  while (end > 0 && (full[end] & 0xc0) === 0x80) {
    end -= 1;
  }

  return full.slice(0, end);
}

export function truncateUtf8String(input: string, maxBytes: number): string {
  return textDecoder.decode(truncateUtf8Bytes(input, maxBytes));
}

export type MacValidationResult =
  | { ok: true; formatted: string; bytes: Uint8Array }
  | { ok: false; error: string };

/**
 * Validates and normalizes an IEEE 802 MAC address.
 * Accepts `AA:BB:CC:DD:EE:FF`, `AA-BB-CC-DD-EE-FF`, or `AABBCCDDEEFF`.
 * Rejects wrong length, non-hex characters, all-zeros (`00:..:00`), and broadcast (`FF:..:FF`).
 */
export function parseAndValidateMac(input: string): MacValidationResult {
  const cleaned = input
    .trim()
    .replaceAll(/[:\-\s]/g, "")
    .toUpperCase();

  if (cleaned.length !== 12 || !/^[0-9A-F]{12}$/.test(cleaned)) {
    return {
      ok: false,
      error: "آدرس MAC نامعتبر است (باید دقیقاً ۱۲ کاراکتر هگزادسیمال باشد، مثل AA:BB:CC:DD:EE:FF).",
    };
  }

  if (cleaned === "000000000000") {
    return { ok: false, error: "آدرس MAC نمی‌تواند تمام صفر (00:00:00:00:00:00) باشد." };
  }

  if (cleaned === "FFFFFFFFFFFF") {
    return { ok: false, error: "آدرس Broadcast (FF:FF:FF:FF:FF:FF) مجاز نیست." };
  }

  const bytes = new Uint8Array(6);
  const parts: string[] = [];

  for (let i = 0; i < 6; i++) {
    const hex = cleaned.slice(i * 2, i * 2 + 2);
    bytes[i] = Number.parseInt(hex, 16);
    parts.push(hex);
  }

  if ((bytes[0] & 0x01) !== 0) {
    return {
      ok: false,
      error: "آدرس MAC باید Unicast باشد (بیت کم‌ارزش بایت اول باید زوج باشد).",
    };
  }

  return { ok: true, formatted: parts.join(":"), bytes };
}

/**
 * Live input formatter for MAC text fields: strips invalid characters and inserts `:` pairs.
 */
export function formatMacLiveInput(input: string): string {
  const hex = input
    .replaceAll(/[^0-9a-fA-F]/g, "")
    .toUpperCase()
    .slice(0, 12);
  const parts: string[] = [];

  for (let i = 0; i < hex.length; i += 2) {
    parts.push(hex.slice(i, i + 2));
  }

  return parts.join(":");
}

export function allocateNextAuxNodeId(existing: readonly AuxNodeConfig[]): number | null {
  const used = new Set(existing.map((n) => n.nodeId));

  for (let id = 1; id <= MAX_AUX_NODES; id++) {
    if (!used.has(id)) return id;
  }

  return null;
}

export function allocateNextVirtualPin(
  segments: readonly Pick<Segment, "type" | "pin">[],
): number | null {
  const used = new Set(
    segments
      .filter((s) => s.type !== "placeholder")
      .map((s) => Number(s.pin))
      .filter((p) => Number.isInteger(p) && p >= VIRTUAL_PIN_MIN && p <= VIRTUAL_PIN_MAX),
  );

  for (let p = VIRTUAL_PIN_MIN; p <= VIRTUAL_PIN_MAX; p++) {
    if (!used.has(p)) return p;
  }

  return null;
}

export function isVirtualSegment(segment?: Pick<Segment, "isVirtual" | "pin"> | null): boolean {
  if (!segment) return false;
  if (segment.isVirtual === true) return true;

  const pinNum = Number(segment.pin);
  return segment.pin !== "" && isVirtualPin(pinNum);
}

export function formatSegmentPinLabel(
  segment: Pick<Segment, "pin" | "isVirtual" | "remotePin">,
  compact = false,
): string {
  if (isVirtualSegment(segment)) {
    const rpin =
      segment.remotePin !== undefined && Number.isInteger(segment.remotePin)
        ? segment.remotePin
        : "?";

    return compact ? `R${rpin} · v${segment.pin}` : `Remote GPIO ${rpin} · vPin ${segment.pin}`;
  }

  return `GPIO ${segment.pin}`;
}

export function getAuxNodeActiveSegmentCount(
  segments: readonly Pick<Segment, "type" | "isVirtual" | "nodeId" | "remotePin">[],
  nodeId: number,
): number {
  let count = 0;

  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (s.type !== "placeholder" && s.isVirtual && s.nodeId === nodeId) {
      count += 1;
    }
  }

  return count;
}

export function getOccupiedRemotePins(
  segments: readonly Pick<Segment, "type" | "isVirtual" | "nodeId" | "remotePin">[],
  nodeId: number,
): Set<number> {
  const used = new Set<number>();

  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (
      s.type !== "placeholder" &&
      s.isVirtual &&
      s.nodeId === nodeId &&
      s.remotePin !== undefined &&
      Number.isInteger(s.remotePin)
    ) {
      used.add(s.remotePin);
    }
  }

  return used;
}

export function findAuxNodeByGroup(
  auxNodes: readonly AuxNodeConfig[],
  groupName: string,
): AuxNodeConfig | undefined {
  const normalized = groupName.trim();
  return auxNodes.find((n) => n.groupName === normalized);
}

export function resolveAuxChipType(raw: unknown): AuxChipType {
  if (typeof raw === "number" && Number.isInteger(raw)) {
    return AUX_CHIP_FROM_CODE[raw] ?? "unknown";
  }

  if (typeof raw === "string" && raw in AUX_CHIP_CODE_MAP) {
    return raw as AuxChipType;
  }

  return "unknown";
}

export function normalizeAuxNodeRecord(raw: Partial<AuxNodeConfig>): AuxNodeConfig | null {
  const nodeId = Number(raw.nodeId);
  if (!Number.isInteger(nodeId) || nodeId < 1 || nodeId > MAX_AUX_NODES) {
    return null;
  }

  const macRes = typeof raw.mac === "string" ? parseAndValidateMac(raw.mac) : null;
  if (!macRes?.ok) {
    return null;
  }

  const rawCap = Number(raw.pinCapacity);
  const pinCapacity = Number.isFinite(rawCap)
    ? Math.min(MAX_AUX_PIN_CAPACITY, Math.max(1, Math.round(rawCap)))
    : 4;

  const chipType = resolveAuxChipType(raw.chipType);
  const name = truncateUtf8String(
    typeof raw.name === "string" && raw.name.trim() ? raw.name : `برد کمکی ${nodeId}`,
    AUX_NODE_NAME_MAX_BYTES,
  );
  const groupName =
    typeof raw.groupName === "string" && raw.groupName.trim() ? raw.groupName.trim() : name;

  return {
    nodeId,
    name,
    mac: macRes.formatted,
    pinCapacity,
    chipType,
    groupName,
    ...(typeof raw.online === "boolean" ? { online: raw.online } : {}),
  };
}

export function createVirtualPlaceholder(
  nodeId: number,
  groupName: string,
  createId: () => string,
  slotIndex?: number,
): Segment {
  return {
    id: createId(),
    type: "placeholder",
    pin: "",
    title: slotIndex !== undefined ? `پایه خالی ${slotIndex}` : "جایگاه خالی برد کمکی",
    group: groupName,
    isVirtual: true,
    nodeId,
  };
}

export interface CreateAuxNodeInput {
  name: string;
  mac: string;
  pinCapacity: number;
  chipType: AuxChipType;
  groupName?: string;
}

export type CreateAuxNodePlan =
  | { ok: false; errorMessage: string }
  | {
      ok: true;
      node: AuxNodeConfig;
      nextAuxNodes: AuxNodeConfig[];
      nextGroupsOrder: string[];
      nextGroupConfigs: GroupsSlice["groupConfigs"];
      nextSegments: Segment[];
      placeholdersCreated: number;
    };

/**
 * Pure domain planner for creating an Auxiliary ESP node:
 * validates MAC, uniqueness, nodeId capacity (1..16), pinCapacity (1..32),
 * registers the group in `groupsOrder`, and spawns `pinCapacity` virtual placeholders.
 */
export function planCreateAuxNode(params: {
  input: CreateAuxNodeInput;
  auxNodes: readonly AuxNodeConfig[];
  groupsOrder: readonly string[];
  groupConfigs: GroupsSlice["groupConfigs"];
  segments: readonly Segment[];
  createId: () => string;
}): CreateAuxNodePlan {
  const { input, auxNodes, groupsOrder, groupConfigs, segments, createId } = params;
  const trimmedName = truncateUtf8String(input.name, AUX_NODE_NAME_MAX_BYTES).trim();

  if (!trimmedName) {
    return { ok: false, errorMessage: "نام برد کمکی نمی‌تواند خالی باشد." };
  }

  const macValidation = parseAndValidateMac(input.mac);
  if (!macValidation.ok) {
    return { ok: false, errorMessage: macValidation.error };
  }

  if (auxNodes.some((n) => n.mac.toUpperCase() === macValidation.formatted)) {
    return {
      ok: false,
      errorMessage: `آدرس MAC ${macValidation.formatted} قبلاً برای برد کمکی دیگری ثبت شده است.`,
    };
  }

  if (
    !Number.isInteger(input.pinCapacity) ||
    input.pinCapacity < 1 ||
    input.pinCapacity > MAX_AUX_PIN_CAPACITY
  ) {
    return {
      ok: false,
      errorMessage: `ظرفیت پایه برد کمکی باید عددی صحیح بین ۱ تا ${MAX_AUX_PIN_CAPACITY} باشد.`,
    };
  }

  const nodeId = allocateNextAuxNodeId(auxNodes);
  if (nodeId === null) {
    return {
      ok: false,
      errorMessage: `حداکثر ${MAX_AUX_NODES} برد کمکی پشتیبانی می‌شود.`,
    };
  }

  const desiredGroup = (input.groupName?.trim() || trimmedName).trim();
  const groupCollision =
    groupsOrder.includes(desiredGroup) || auxNodes.some((n) => n.groupName === desiredGroup);
  if (groupCollision) {
    return {
      ok: false,
      errorMessage: `گروه «${desiredGroup}» قبلاً وجود دارد؛ لطفاً نام دیگری انتخاب کنید.`,
    };
  }

  const chipType = resolveAuxChipType(input.chipType);
  const node: AuxNodeConfig = {
    nodeId,
    name: trimmedName,
    mac: macValidation.formatted,
    pinCapacity: input.pinCapacity,
    chipType,
    groupName: desiredGroup,
    online: false,
  };

  const placeholders: Segment[] = [];
  for (let i = 0; i < input.pinCapacity; i++) {
    placeholders.push(createVirtualPlaceholder(nodeId, desiredGroup, createId, i + 1));
  }

  const nextGroupsOrder = groupsOrder.includes(desiredGroup)
    ? [...groupsOrder]
    : [...groupsOrder, desiredGroup];

  const existingGroupCfg = groupConfigs[desiredGroup];
  const nextGroupConfigs: GroupsSlice["groupConfigs"] = {
    ...groupConfigs,
    [desiredGroup]: {
      maxCols: existingGroupCfg?.maxCols ?? Math.min(3, Math.max(1, input.pinCapacity)),
      icon: existingGroupCfg?.icon ?? "Cpu",
    },
  };

  return {
    ok: true,
    node,
    nextAuxNodes: [...auxNodes, node],
    nextGroupsOrder,
    nextGroupConfigs,
    nextSegments: [...segments, ...placeholders],
    placeholdersCreated: placeholders.length,
  };
}

export type UpdateAuxNodePlan =
  | { ok: false; errorMessage: string }
  | {
      ok: true;
      node: AuxNodeConfig;
      nextAuxNodes: AuxNodeConfig[];
      nextGroupsOrder: string[];
      nextGroupConfigs: GroupsSlice["groupConfigs"];
      nextSegments: Segment[];
    };

/**
 * Pure domain planner for editing an existing Auxiliary ESP node.
 * Preserves `nodeId`, prevents lowering `pinCapacity` below active virtual segment count,
 * syncs renamed groups across layout and segments, and adjusts virtual placeholder slots.
 */
export function planUpdateAuxNode(params: {
  nodeId: number;
  input: CreateAuxNodeInput;
  auxNodes: readonly AuxNodeConfig[];
  groupsOrder: readonly string[];
  groupConfigs: GroupsSlice["groupConfigs"];
  segments: readonly Segment[];
  createId: () => string;
}): UpdateAuxNodePlan {
  const { nodeId, input, auxNodes, groupsOrder, groupConfigs, segments, createId } = params;
  const existing = auxNodes.find((n) => n.nodeId === nodeId);

  if (!existing) {
    return { ok: false, errorMessage: "برد کمکی مورد نظر پیدا نشد." };
  }

  const trimmedName = truncateUtf8String(input.name, AUX_NODE_NAME_MAX_BYTES).trim();
  if (!trimmedName) {
    return { ok: false, errorMessage: "نام برد کمکی نمی‌تواند خالی باشد." };
  }

  const macValidation = parseAndValidateMac(input.mac);
  if (!macValidation.ok) {
    return { ok: false, errorMessage: macValidation.error };
  }

  if (
    auxNodes.some((n) => n.nodeId !== nodeId && n.mac.toUpperCase() === macValidation.formatted)
  ) {
    return {
      ok: false,
      errorMessage: `آدرس MAC ${macValidation.formatted} قبلاً برای برد کمکی دیگری ثبت شده است.`,
    };
  }

  if (
    !Number.isInteger(input.pinCapacity) ||
    input.pinCapacity < 1 ||
    input.pinCapacity > MAX_AUX_PIN_CAPACITY
  ) {
    return {
      ok: false,
      errorMessage: `ظرفیت پایه برد کمکی باید عددی صحیح بین ۱ تا ${MAX_AUX_PIN_CAPACITY} باشد.`,
    };
  }

  const activeCount = getAuxNodeActiveSegmentCount(segments, nodeId);
  if (input.pinCapacity < activeCount) {
    return {
      ok: false,
      errorMessage: `این برد هم‌اکنون ${activeCount} سگمنت فعال دارد؛ ظرفیت پایه نمی‌تواند کمتر از ${activeCount} باشد.`,
    };
  }

  const nextGroupName = (input.groupName?.trim() || trimmedName).trim();
  if (
    nextGroupName !== existing.groupName &&
    (groupsOrder.includes(nextGroupName) ||
      auxNodes.some((n) => n.nodeId !== nodeId && n.groupName === nextGroupName))
  ) {
    return {
      ok: false,
      errorMessage: `گروه «${nextGroupName}» قبلاً وجود دارد؛ لطفاً نام دیگری انتخاب کنید.`,
    };
  }

  const updatedNode: AuxNodeConfig = {
    ...existing,
    name: trimmedName,
    mac: macValidation.formatted,
    pinCapacity: input.pinCapacity,
    chipType: resolveAuxChipType(input.chipType),
    groupName: nextGroupName,
  };

  const nextAuxNodes = auxNodes.map((n) => (n.nodeId === nodeId ? updatedNode : n));

  const nextGroupsOrder = groupsOrder.map((g) => (g === existing.groupName ? nextGroupName : g));
  if (!nextGroupsOrder.includes(nextGroupName)) {
    nextGroupsOrder.push(nextGroupName);
  }

  const nextGroupConfigs = { ...groupConfigs };
  if (existing.groupName !== nextGroupName && nextGroupConfigs[existing.groupName]) {
    nextGroupConfigs[nextGroupName] = nextGroupConfigs[existing.groupName];
    delete nextGroupConfigs[existing.groupName];
  }

  // Rename group on matching segments
  let nextSegments = segments.map((s) =>
    s.group === existing.groupName || (s.isVirtual && s.nodeId === nodeId)
      ? { ...s, group: nextGroupName }
      : s,
  );

  // Sync virtual placeholder slots with updated pinCapacity
  const currentGroupSlots = nextSegments.filter(
    (s) => s.group === nextGroupName && (s.isVirtual || s.nodeId === nodeId),
  );
  const deficit = input.pinCapacity - currentGroupSlots.length;

  if (deficit > 0) {
    const added: Segment[] = [];
    for (let i = 0; i < deficit; i++) {
      added.push(createVirtualPlaceholder(nodeId, nextGroupName, createId));
    }
    nextSegments = [...nextSegments, ...added];
  } else if (deficit < 0) {
    let toTrim = -deficit;
    const trimmed: Segment[] = [];
    for (let i = nextSegments.length - 1; i >= 0; i--) {
      const seg = nextSegments[i];
      if (toTrim > 0 && seg.type === "placeholder" && seg.isVirtual && seg.nodeId === nodeId) {
        toTrim -= 1;
        continue;
      }
      trimmed.unshift(seg);
    }
    nextSegments = trimmed;
  }

  return {
    ok: true,
    node: updatedNode,
    nextAuxNodes,
    nextGroupsOrder,
    nextGroupConfigs,
    nextSegments,
  };
}

/**
 * Pure domain planner for removing a segment while restoring a virtual placeholder slot
 * when a virtual segment inside an existing Auxiliary ESP node group is deleted.
 */
export function planRemoveSegmentWithAuxRestore(params: {
  id: string;
  segments: readonly Segment[];
  auxNodes: readonly AuxNodeConfig[];
  createId: () => string;
}): {
  removed: Segment | undefined;
  nextSegments: Segment[];
  restoredPlaceholder: Segment | null;
} {
  const { id, segments, auxNodes, createId } = params;
  const idx = segments.findIndex((s) => s.id === id);

  if (idx === -1) {
    return { removed: undefined, nextSegments: [...segments], restoredPlaceholder: null };
  }

  const removed = segments[idx];

  if (removed.type !== "placeholder" && removed.isVirtual && removed.nodeId !== undefined) {
    const ownerNode = auxNodes.find((n) => n.nodeId === removed.nodeId);

    if (ownerNode) {
      const currentSlotsInGroup = segments.filter(
        (s) => s.id !== id && (s.nodeId === ownerNode.nodeId || s.group === ownerNode.groupName),
      ).length;

      if (currentSlotsInGroup < ownerNode.pinCapacity) {
        const restoredPlaceholder = createVirtualPlaceholder(
          ownerNode.nodeId,
          removed.group || ownerNode.groupName,
          createId,
        );
        const nextSegments = [...segments];
        nextSegments[idx] = restoredPlaceholder;

        return { removed, nextSegments, restoredPlaceholder };
      }
    }
  }

  return {
    removed,
    nextSegments: segments.filter((s) => s.id !== id),
    restoredPlaceholder: null,
  };
}
