"use client";

import React from "react";

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

interface WorkflowSchematicSymbolProps {
  kind: SchematicSymbolKind;
  className?: string;
}

/**
 * Resolves a segment's hardware type and icon identifier to its corresponding
 * American (ANSI / IEEE / NEMA) electrical schematic symbol kind.
 */
export function resolveSegmentSchematicKind(
  segmentType?: string,
  iconName?: string,
): SchematicSymbolKind {
  if (segmentType === "input") return "segment_sensor";

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

/**
 * Renders crisp American-standard (IEEE Std 91 / ANSI / MIL-STD-806B / NEMA)
 * electronic and logic schematic symbols with fixed LTR pin orientation (inputs left, output right).
 */
export default React.memo(function WorkflowSchematicSymbol({
  kind,
  className = "h-8 w-14",
}: WorkflowSchematicSymbolProps) {
  return (
    <svg
      viewBox="0 0 64 36"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 overflow-visible ${className}`}
    >
      {renderSchematicPaths(kind)}
    </svg>
  );
});

function renderSchematicPaths(kind: SchematicSymbolKind): React.ReactNode {
  switch (kind) {
    // IEEE / ANSI Logic AND Gate (distinctive D-shape, 2 inputs left, 1 output right)
    case "logic_and":
      return (
        <g stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="12" x2="19" y2="12" />
          <line x1="4" y1="24" x2="19" y2="24" />
          <line x1="45" y1="18" x2="60" y2="18" />
          <path d="M19 6 H33 A12 12 0 0 1 33 30 H19 Z" fill="var(--card-bg-solid)" />
          <circle cx="4" cy="12" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="4" cy="24" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="60" cy="18" r="1.6" fill="currentColor" stroke="none" />
        </g>
      );

    // IEEE / ANSI Logic OR Gate (concave input shield, pointed output arc)
    case "logic_or":
      return (
        <g stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="12" x2="21" y2="12" />
          <line x1="4" y1="24" x2="21" y2="24" />
          <line x1="46" y1="18" x2="60" y2="18" />
          <path
            d="M18 6 C23 13 23 23 18 30 H28 C37 30 43 24 46 18 C43 12 37 6 28 6 Z"
            fill="var(--card-bg-solid)"
          />
          <circle cx="4" cy="12" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="4" cy="24" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="60" cy="18" r="1.6" fill="currentColor" stroke="none" />
        </g>
      );

    // IEEE / ANSI Logic NOT Gate / Inverter (triangle + output inversion bubble)
    case "logic_not":
      return (
        <g stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="18" x2="19" y2="18" />
          <line x1="46" y1="18" x2="60" y2="18" />
          <path d="M19 7 L40 18 L19 29 Z" fill="var(--card-bg-solid)" />
          <circle cx="43.5" cy="18" r="3" fill="var(--card-bg-solid)" />
          <circle cx="4" cy="18" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="60" cy="18" r="1.6" fill="currentColor" stroke="none" />
        </g>
      );

    // ANSI Pushbutton / Rising-Edge Pulse Trigger
    case "trigger_manual":
      return (
        <g stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="23" x2="21" y2="23" />
          <line x1="43" y1="23" x2="59" y2="23" />
          <circle cx="21" cy="23" r="2.1" fill="var(--card-bg-solid)" />
          <circle cx="43" cy="23" r="2.1" fill="var(--card-bg-solid)" />
          <line x1="19" y1="15" x2="45" y2="15" />
          <line x1="32" y1="7" x2="32" y2="15" />
          <line x1="27" y1="7" x2="37" y2="7" />
          <circle cx="59" cy="23" r="1.6" fill="currentColor" stroke="none" />
        </g>
      );

    // IEEE Clock / Square-Wave Schedule Oscillator Block
    case "trigger_schedule":
      return (
        <g stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <rect x="14" y="6" width="32" height="24" rx="3" fill="var(--card-bg-solid)" />
          <line x1="46" y1="18" x2="60" y2="18" />
          <path d="M20 22 H24 V14 H30 V22 H35 V14 H40" />
          <circle cx="60" cy="18" r="1.6" fill="currentColor" stroke="none" />
        </g>
      );

    // ANSI / NEMA Time-Delay Block (Monostable pulse & delay curve)
    case "timer":
      return (
        <g stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="18" x2="17" y2="18" />
          <line x1="47" y1="18" x2="60" y2="18" />
          <rect x="17" y="6" width="30" height="24" rx="3" fill="var(--card-bg-solid)" />
          <path d="M23 23 H28 L33 12 H41" />
          <circle cx="4" cy="18" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="60" cy="18" r="1.6" fill="currentColor" stroke="none" />
        </g>
      );

    // ANSI Dashed Module Enclosure (Empty Custom Group Node)
    case "group_empty":
      return (
        <g stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="18" x2="14" y2="18" />
          <line x1="50" y1="18" x2="60" y2="18" />
          <rect
            x="14"
            y="6"
            width="36"
            height="24"
            rx="3"
            strokeDasharray="3.5 3"
            fill="var(--card-bg-solid)"
          />
          <line x1="32" y1="13" x2="32" y2="23" />
          <line x1="27" y1="18" x2="37" y2="18" />
          <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="60" cy="18" r="1.5" fill="currentColor" stroke="none" />
        </g>
      );

    // ANSI Multi-Channel Bus Manifold (Pre-filled Group Node)
    case "group_filled":
      return (
        <g stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="18" x2="15" y2="18" />
          <line x1="49" y1="18" x2="60" y2="18" />
          <rect x="15" y="6" width="34" height="24" rx="3" fill="var(--card-bg-solid)" />
          <line x1="22" y1="12" x2="42" y2="12" />
          <line x1="22" y1="18" x2="42" y2="18" />
          <line x1="22" y1="24" x2="42" y2="24" />
          <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="60" cy="18" r="1.5" fill="currentColor" stroke="none" />
        </g>
      );

    // ANSI Lamp / Luminaires Symbol (circle + cross filament)
    case "segment_lamp":
      return (
        <g stroke="currentColor" strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="18" x2="22" y2="18" />
          <line x1="42" y1="18" x2="60" y2="18" />
          <circle cx="32" cy="18" r="10" fill="var(--card-bg-solid)" />
          <line x1="25.2" y1="11.2" x2="38.8" y2="24.8" />
          <line x1="38.8" y1="11.2" x2="25.2" y2="24.8" />
          <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="60" cy="18" r="1.5" fill="currentColor" stroke="none" />
        </g>
      );

    // ANSI Motor / Fan Symbol (circle + M rotor mark)
    case "segment_fan":
      return (
        <g stroke="currentColor" strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="18" x2="21" y2="18" />
          <line x1="43" y1="18" x2="60" y2="18" />
          <circle cx="32" cy="18" r="11" fill="var(--card-bg-solid)" />
          <path d="M27.5 22.5 V13.5 L32 19 L36.5 13.5 V22.5" />
          <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="60" cy="18" r="1.5" fill="currentColor" stroke="none" />
        </g>
      );

    // ANSI American Zigzag Resistor / Heating Element Symbol
    case "segment_heater":
      return (
        <g stroke="currentColor" strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 18 H15 L18 11 L23 25 L28 11 L33 25 L38 11 L43 25 L46 18 H60" />
          <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="60" cy="18" r="1.5" fill="currentColor" stroke="none" />
        </g>
      );

    // ANSI Solenoid / Actuator Interlock Coil Symbol
    case "segment_lock":
      return (
        <g stroke="currentColor" strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="18" x2="18" y2="18" />
          <line x1="46" y1="18" x2="60" y2="18" />
          <rect x="18" y="10" width="28" height="16" rx="2" fill="var(--card-bg-solid)" />
          <line x1="24" y1="26" x2="40" y2="10" />
          <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="60" cy="18" r="1.5" fill="currentColor" stroke="none" />
        </g>
      );

    // ANSI Limit / Proximity Input Sensor Switch
    case "segment_sensor":
      return (
        <g stroke="currentColor" strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="22" x2="21" y2="22" />
          <line x1="41" y1="22" x2="60" y2="22" />
          <circle cx="22" cy="22" r="2" fill="var(--card-bg-solid)" />
          <circle cx="40" cy="22" r="2" fill="var(--card-bg-solid)" />
          <line x1="23.5" y1="20.5" x2="39" y2="11" />
          <path d="M29 7 A5 5 0 0 1 35 7" />
          <circle cx="4" cy="22" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="60" cy="22" r="1.5" fill="currentColor" stroke="none" />
        </g>
      );

    // ANSI / NEMA SPST Control Switch / Relay Contact
    case "segment_relay":
      return (
        <g stroke="currentColor" strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="21" x2="21" y2="21" />
          <line x1="41" y1="21" x2="60" y2="21" />
          <circle cx="22" cy="21" r="2" fill="var(--card-bg-solid)" />
          <circle cx="40" cy="21" r="2" fill="var(--card-bg-solid)" />
          <line x1="24" y1="20" x2="39" y2="12" />
          <circle cx="4" cy="21" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="60" cy="21" r="1.5" fill="currentColor" stroke="none" />
        </g>
      );
  }
}
