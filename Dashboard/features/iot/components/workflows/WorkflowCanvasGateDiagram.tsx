"use client";

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

interface GateLeadsProps {
  leadYs: number[];
  leadEndX: number;
  incomingCount: number;
  hasInputs: boolean;
  activeStroke: string;
}

function GateInputLeads({
  leadYs,
  leadEndX,
  incomingCount,
  hasInputs,
  activeStroke,
}: GateLeadsProps) {
  return (
    <>
      {leadYs.map((y, idx) => (
        <line
          key={y}
          x1="6"
          y1={y}
          x2={leadEndX}
          y2={y}
          stroke={idx < incomingCount ? activeStroke : "currentColor"}
          strokeOpacity={idx < incomingCount || hasInputs ? 0.9 : 0.45}
          strokeWidth="2"
          strokeLinecap="round"
        />
      ))}
    </>
  );
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
  const bodyFill = outputSignal ? "rgba(16, 185, 129, 0.14)" : "currentColor";
  const bodyFillOpacity = outputSignal ? 1 : 0.07;

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
            <GateInputLeads
              leadYs={leadYs}
              leadEndX={28}
              incomingCount={incomingCount}
              hasInputs={hasInputs}
              activeStroke={activeStroke}
            />
            <path
              d="M 28 6 H 48 A 16 16 0 0 1 48 38 H 28 Z"
              fill={bodyFill}
              fillOpacity={bodyFillOpacity}
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
            <GateInputLeads
              leadYs={leadYs}
              leadEndX={29}
              incomingCount={incomingCount}
              hasInputs={hasInputs}
              activeStroke={activeStroke}
            />
            <path
              d="M 24 6 H 38 C 49 6 58 12 64 22 C 58 32 49 38 38 38 H 24 Q 33 22 24 6 Z"
              fill={bodyFill}
              fillOpacity={bodyFillOpacity}
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
            <GateInputLeads
              leadYs={leadYs}
              leadEndX={26}
              incomingCount={incomingCount}
              hasInputs={hasInputs}
              activeStroke={activeStroke}
            />
            <path
              d="M 26 7 L 56 22 L 26 37 Z"
              fill={bodyFill}
              fillOpacity={bodyFillOpacity}
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
            <circle
              cx="60.5"
              cy="22"
              r="4"
              fill="var(--bg-main)"
              stroke={activeStroke}
              strokeWidth="2.2"
            />
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
