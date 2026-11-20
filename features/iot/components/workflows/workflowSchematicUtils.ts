import { isReadOnlyInputType } from "@/features/iot/utils/analogInput";

export type SchematicSymbolKind =
  | "trigger_manual"
  | "trigger_schedule"
  | "logic_and"
  | "logic_or"
  | "logic_not"
  | "timer"
  | "group_empty"
  | "group_filled"
  | "segment_lamp"
  | "segment_fan"
  | "segment_heater"
  | "segment_lock"
  | "segment_sensor"
  | "segment_relay";

/**
 * Resolves a segment's hardware type and icon identifier to its corresponding
 * American (ANSI / IEEE / NEMA) electrical schematic symbol kind.
 */
export function resolveSegmentSchematicKind(
  segmentType?: string,
  iconName?: string,
): SchematicSymbolKind {
  if (isReadOnlyInputType(segmentType)) return "segment_sensor";

  const normalized = (iconName ?? "").toLowerCase();

  if (
    normalized.includes("lamp") ||
    normalized.includes("bulb") ||
    normalized.includes("sun") ||
    normalized.includes("light")
  ) {
    return "segment_lamp";
  }

  if (normalized.includes("fan") || normalized.includes("wind") || normalized.includes("air")) {
    return "segment_fan";
  }

  if (
    normalized.includes("flame") ||
    normalized.includes("fire") ||
    normalized.includes("heat") ||
    normalized.includes("therm") ||
    normalized.includes("waves")
  ) {
    return "segment_heater";
  }

  if (normalized.includes("lock") || normalized.includes("door") || normalized.includes("key")) {
    return "segment_lock";
  }

  return "segment_relay";
}
