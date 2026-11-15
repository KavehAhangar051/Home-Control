"use client";

import type { WorkflowNodeKind } from "./workflowTypes";

export interface SchematicSymbolProps {
  kind: WorkflowNodeKind;
  isCustomGroup?: boolean;
  isInputSegment?: boolean;
  className?: string;
}

/**
 * Renders authentic US-standard (ANSI / IEEE Std 91-1984 & NEMA ICS) schematic symbols
 * for workflow palette items and node headers.
 * Uses currentColor with geometric precision so symbols adapt cleanly to light/dark themes.
 */
export function WorkflowSchematicSymbol({
  kind,
  isCustomGroup = false,
  isInputSegment = false,
  className = "h-6 w-10",
}: SchematicSymbolProps) {
  switch (kind) {
    case "logic_and":
      return (
        <svg viewBox="0 0 48 28" fill="none" aria-hidden="true" className={className}>
          {/* Input leads A & B */}
          <line
            x1="2"
            y1="9"
            x2="13"
            y2="9"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <line
            x1="2"
            y1="19"
            x2="13"
            y2="19"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <circle cx="2.5" cy="9" r="1.5" fill="currentColor" />
          <circle cx="2.5" cy="19" r="1.5" fill="currentColor" />
          {/* ANSI/IEEE Std 91 Distinctive D-Shape AND Body */}
          <path
            d="M 13 4 H 24 A 10 10 0 0 1 24 24 H 13 Z"
            fill="currentColor"
            fillOpacity="0.08"
            stroke="currentColor"
            strokeWidth="1.85"
            strokeLinejoin="round"
          />
          {/* Output lead Y */}
          <line
            x1="34"
            y1="14"
            x2="45"
            y2="14"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <circle cx="45.5" cy="14" r="1.5" fill="currentColor" />
        </svg>
      );

    case "logic_or":
      return (
        <svg viewBox="0 0 48 28" fill="none" aria-hidden="true" className={className}>
          {/* Input leads A & B reaching curved rear */}
          <line
            x1="2"
            y1="9"
            x2="13.5"
            y2="9"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <line
            x1="2"
            y1="19"
            x2="13.5"
            y2="19"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <circle cx="2.5" cy="9" r="1.5" fill="currentColor" />
          <circle cx="2.5" cy="19" r="1.5" fill="currentColor" />
          {/* ANSI/IEEE Std 91 Distinctive Curved-Pointed OR Body */}
          <path
            d="M 11 4 H 19 C 26 4 31.5 8 35 14 C 31.5 20 26 24 19 24 H 11 Q 16.5 14 11 4 Z"
            fill="currentColor"
            fillOpacity="0.08"
            stroke="currentColor"
            strokeWidth="1.85"
            strokeLinejoin="round"
          />
          {/* Output lead Y */}
          <line
            x1="35"
            y1="14"
            x2="45"
            y2="14"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <circle cx="45.5" cy="14" r="1.5" fill="currentColor" />
        </svg>
      );

    case "logic_not":
      return (
        <svg viewBox="0 0 48 28" fill="none" aria-hidden="true" className={className}>
          {/* Single input lead A */}
          <line
            x1="2"
            y1="14"
            x2="12"
            y2="14"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <circle cx="2.5" cy="14" r="1.5" fill="currentColor" />
          {/* ANSI/IEEE Std 91 Inverter Triangle */}
          <path
            d="M 12 4.5 L 30 14 L 12 23.5 Z"
            fill="currentColor"
            fillOpacity="0.08"
            stroke="currentColor"
            strokeWidth="1.85"
            strokeLinejoin="round"
          />
          {/* Negation / Inversion Bubble */}
          <circle
            cx="33"
            cy="14"
            r="2.75"
            fill="var(--card-bg-solid)"
            stroke="currentColor"
            strokeWidth="1.85"
          />
          {/* Output lead !A */}
          <line
            x1="35.8"
            y1="14"
            x2="45"
            y2="14"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <circle cx="45.5" cy="14" r="1.5" fill="currentColor" />
        </svg>
      );

    case "trigger_manual":
      return (
        <svg viewBox="0 0 48 28" fill="none" aria-hidden="true" className={className}>
          {/* NEMA / ANSI Y32.2 Normally-Open Momentary Pushbutton Switch (PB-NO) */}
          <line
            x1="3"
            y1="20"
            x2="14"
            y2="20"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <line
            x1="34"
            y1="20"
            x2="45"
            y2="20"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          {/* Fixed contact terminals */}
          <circle
            cx="16.5"
            cy="20"
            r="2.3"
            fill="var(--card-bg-solid)"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <circle
            cx="31.5"
            cy="20"
            r="2.3"
            fill="var(--card-bg-solid)"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          {/* Movable bridging contact bar & pushbutton plunger */}
          <line
            x1="13"
            y1="13.5"
            x2="35"
            y2="13.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="24"
            y1="5"
            x2="24"
            y2="13.5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <line
            x1="18.5"
            y1="5"
            x2="29.5"
            y2="5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="45.5" cy="20" r="1.5" fill="currentColor" />
        </svg>
      );

    case "trigger_schedule":
      return (
        <svg viewBox="0 0 48 28" fill="none" aria-hidden="true" className={className}>
          {/* ANSI/IEEE Synchronous Clock Pulse Generator Symbol */}
          <rect
            x="6"
            y="4"
            width="28"
            height="20"
            rx="3"
            fill="currentColor"
            fillOpacity="0.06"
            stroke="currentColor"
            strokeWidth="1.65"
          />
          {/* Digital clock square wave */}
          <path
            d="M 10 18 H 13.5 V 10 H 18.5 V 18 H 22.5 V 10 H 27.5 V 18 H 30"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Output lead */}
          <line
            x1="34"
            y1="14"
            x2="45"
            y2="14"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <circle cx="45.5" cy="14" r="1.5" fill="currentColor" />
        </svg>
      );

    case "timer":
      return (
        <svg viewBox="0 0 48 28" fill="none" aria-hidden="true" className={className}>
          {/* Input lead */}
          <line
            x1="2"
            y1="14"
            x2="10"
            y2="14"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <circle cx="2.5" cy="14" r="1.5" fill="currentColor" />
          {/* ANSI/IEC On-Delay Timing Element Block */}
          <rect
            x="10"
            y="4"
            width="26"
            height="20"
            rx="3"
            fill="currentColor"
            fillOpacity="0.06"
            stroke="currentColor"
            strokeWidth="1.65"
          />
          {/* Delayed step-edge curve inside block */}
          <path
            d="M 14 18 H 20.5 V 9.5 H 31"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M 14 9.5 A 6.5 8.5 0 0 1 20.5 18"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeDasharray="2 2"
          />
          {/* Output lead */}
          <line
            x1="36"
            y1="14"
            x2="45"
            y2="14"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <circle cx="45.5" cy="14" r="1.5" fill="currentColor" />
        </svg>
      );

    case "group":
      return (
        <svg viewBox="0 0 48 28" fill="none" aria-hidden="true" className={className}>
          {/* Bus input lead */}
          <line
            x1="2"
            y1="14"
            x2="11"
            y2="14"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <circle cx="2.5" cy="14" r="1.5" fill="currentColor" />
          {/* Subcircuit / IC Manifold Block */}
          <rect
            x="11"
            y="3.5"
            width="24"
            height="21"
            rx="2.5"
            fill="currentColor"
            fillOpacity="0.06"
            stroke="currentColor"
            strokeWidth="1.65"
            strokeDasharray={isCustomGroup ? "3 2" : undefined}
          />
          {/* Internal bus distribution lines */}
          <path
            d="M 15 14 H 20 M 20 8.5 V 19.5 M 20 8.5 H 30 M 20 14 H 30 M 20 19.5 H 30"
            stroke="currentColor"
            strokeWidth="1.45"
            strokeLinecap="round"
          />
          {/* Parallel output pins */}
          <line
            x1="35"
            y1="8.5"
            x2="45"
            y2="8.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <line
            x1="35"
            y1="14"
            x2="45"
            y2="14"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <line
            x1="35"
            y1="19.5"
            x2="45"
            y2="19.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );

    case "segment":
      return isInputSegment ? (
        <svg viewBox="0 0 48 28" fill="none" aria-hidden="true" className={className}>
          {/* ANSI Transducer / Digital Input Sensor Symbol */}
          <polygon
            points="7,14 17,5 29,5 29,23 17,23"
            fill="currentColor"
            fillOpacity="0.08"
            stroke="currentColor"
            strokeWidth="1.65"
            strokeLinejoin="round"
          />
          <circle cx="21" cy="14" r="2.2" fill="currentColor" />
          <line
            x1="29"
            y1="14"
            x2="45"
            y2="14"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <circle cx="45.5" cy="14" r="1.5" fill="currentColor" />
        </svg>
      ) : (
        <svg viewBox="0 0 48 28" fill="none" aria-hidden="true" className={className}>
          {/* NEMA / ANSI SPST Switched Relay Contact Symbol */}
          <line
            x1="2"
            y1="16"
            x2="14"
            y2="16"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <circle
            cx="16.5"
            cy="16"
            r="2.2"
            fill="var(--card-bg-solid)"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <line
            x1="18.2"
            y1="14.8"
            x2="30"
            y2="7.5"
            stroke="currentColor"
            strokeWidth="1.85"
            strokeLinecap="round"
          />
          <circle
            cx="31.5"
            cy="16"
            r="2.2"
            fill="var(--card-bg-solid)"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <line
            x1="34"
            y1="16"
            x2="45"
            y2="16"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <circle cx="45.5" cy="16" r="1.5" fill="currentColor" />
        </svg>
      );
  }
}

export interface CanvasGateDiagramProps {
  kind: "logic_and" | "logic_or" | "logic_not";
  incomingCount: number;
  inputCount?: number;
  outputSignal: boolean;
}

function buildInputLeadYs(count: number): number[] {
  const clamped = Math.max(1, Math.min(8, count));

  if (clamped === 1) return [22];

  const minY = 10;
  const maxY = 34;
  const step = (maxY - minY) / (clamped - 1);
  const ys: number[] = [];

  for (let i = 0; i < clamped; i += 1) {
    ys.push(Number((minY + step * i).toFixed(2)));
  }

  return ys;
}

/**
 * Interactive US-Standard (ANSI / IEEE Std 91) schematic gate diagram rendered directly inside
 * canvas logic gate nodes, with dynamic input leads and live signal illumination.
 */
export function WorkflowCanvasGateDiagram({
  kind,
  incomingCount,
  inputCount,
  outputSignal,
}: CanvasGateDiagramProps) {
  const hasInputs = incomingCount > 0;
  const activeStroke = outputSignal ? "#10b981" : "currentColor";
  const resolvedInputCount = inputCount ?? (kind === "logic_not" ? 1 : 2);
  const leadYs = buildInputLeadYs(resolvedInputCount);

  return (
    <div
      dir="ltr"
      className="relative flex h-14 w-full items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-1.5 text-[var(--text-primary)]"
    >
      <svg
        viewBox="0 0 96 44"
        fill="none"
        aria-label={`نماد شماتیک ${kind}`}
        className="h-11 w-28 shrink-0"
      >
        {kind === "logic_and" && (
          <>
            {leadYs.map((y, idx) => (
              <line
                key={y}
                x1="6"
                y1={y}
                x2="28"
                y2={y}
                stroke={idx < incomingCount ? activeStroke : "currentColor"}
                strokeOpacity={idx < incomingCount || hasInputs ? 0.9 : 0.45}
                strokeWidth="2"
                strokeLinecap="round"
              />
            ))}
            {/* ANSI D-Shape AND Gate Body */}
            <path
              d="M 28 6 H 48 A 16 16 0 0 1 48 38 H 28 Z"
              fill={outputSignal ? "rgba(16, 185, 129, 0.14)" : "currentColor"}
              fillOpacity={outputSignal ? 1 : 0.07}
              stroke={activeStroke}
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <text
              x="44"
              y="25"
              textAnchor="middle"
              fill={activeStroke}
              fontSize="9.5"
              fontFamily="monospace"
              fontWeight="bold"
            >
              AND
            </text>
            {/* Output Y lead */}
            <line
              x1="64"
              y1="22"
              x2="88"
              y2="22"
              stroke={activeStroke}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <circle cx="88" cy="22" r="2.5" fill={activeStroke} />
          </>
        )}

        {kind === "logic_or" && (
          <>
            {leadYs.map((y, idx) => (
              <line
                key={y}
                x1="6"
                y1={y}
                x2="29"
                y2={y}
                stroke={idx < incomingCount ? activeStroke : "currentColor"}
                strokeOpacity={idx < incomingCount || hasInputs ? 0.9 : 0.45}
                strokeWidth="2"
                strokeLinecap="round"
              />
            ))}
            {/* ANSI Concave-Back Pointed OR Gate Body */}
            <path
              d="M 24 6 H 38 C 49 6 58 12 64 22 C 58 32 49 38 38 38 H 24 Q 33 22 24 6 Z"
              fill={outputSignal ? "rgba(16, 185, 129, 0.14)" : "currentColor"}
              fillOpacity={outputSignal ? 1 : 0.07}
              stroke={activeStroke}
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <text
              x="43"
              y="25"
              textAnchor="middle"
              fill={activeStroke}
              fontSize="9.5"
              fontFamily="monospace"
              fontWeight="bold"
            >
              OR
            </text>
            {/* Output Y lead */}
            <line
              x1="64"
              y1="22"
              x2="88"
              y2="22"
              stroke={activeStroke}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <circle cx="88" cy="22" r="2.5" fill={activeStroke} />
          </>
        )}

        {kind === "logic_not" && (
          <>
            {leadYs.map((y, idx) => (
              <line
                key={y}
                x1="6"
                y1={y}
                x2="26"
                y2={y}
                stroke={idx < incomingCount ? activeStroke : "currentColor"}
                strokeOpacity={idx < incomingCount || hasInputs ? 0.9 : 0.45}
                strokeWidth="2"
                strokeLinecap="round"
              />
            ))}
            {/* ANSI Triangle Inverter Body */}
            <path
              d="M 26 7 L 56 22 L 26 37 Z"
              fill={outputSignal ? "rgba(16, 185, 129, 0.14)" : "currentColor"}
              fillOpacity={outputSignal ? 1 : 0.07}
              stroke={activeStroke}
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <text
              x="37"
              y="25"
              textAnchor="middle"
              fill={activeStroke}
              fontSize="8.5"
              fontFamily="monospace"
              fontWeight="bold"
            >
              NOT
            </text>
            {/* Negation Bubble */}
            <circle
              cx="60.5"
              cy="22"
              r="4"
              fill="var(--bg-main)"
              stroke={activeStroke}
              strokeWidth="2.2"
            />
            {/* Output Y lead */}
            <line
              x1="64.5"
              y1="22"
              x2="88"
              y2="22"
              stroke={activeStroke}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <circle cx="88" cy="22" r="2.5" fill={activeStroke} />
          </>
        )}
      </svg>
    </div>
  );
}
