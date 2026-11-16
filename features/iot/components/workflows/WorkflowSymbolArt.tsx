"use client";

interface SymbolSvgProps {
  className: string;
}

export function AndGateSymbolSvg({ className }: SymbolSvgProps) {
  return (
    <svg viewBox="0 0 48 28" fill="none" aria-hidden="true" className={className}>
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
      <path
        d="M 13 4 H 24 A 10 10 0 0 1 24 24 H 13 Z"
        fill="currentColor"
        fillOpacity="0.08"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinejoin="round"
      />
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
}

export function OrGateSymbolSvg({ className }: SymbolSvgProps) {
  return (
    <svg viewBox="0 0 48 28" fill="none" aria-hidden="true" className={className}>
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
      <path
        d="M 11 4 H 19 C 26 4 31.5 8 35 14 C 31.5 20 26 24 19 24 H 11 Q 16.5 14 11 4 Z"
        fill="currentColor"
        fillOpacity="0.08"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinejoin="round"
      />
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
}

export function NotGateSymbolSvg({ className }: SymbolSvgProps) {
  return (
    <svg viewBox="0 0 48 28" fill="none" aria-hidden="true" className={className}>
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
      <path
        d="M 12 4.5 L 30 14 L 12 23.5 Z"
        fill="currentColor"
        fillOpacity="0.08"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinejoin="round"
      />
      <circle
        cx="33"
        cy="14"
        r="2.75"
        fill="var(--card-bg-solid)"
        stroke="currentColor"
        strokeWidth="1.85"
      />
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
}

export function TriggerManualSymbolSvg({ className }: SymbolSvgProps) {
  return (
    <svg viewBox="0 0 48 28" fill="none" aria-hidden="true" className={className}>
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
}

export function TriggerScheduleSymbolSvg({ className }: SymbolSvgProps) {
  return (
    <svg viewBox="0 0 48 28" fill="none" aria-hidden="true" className={className}>
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
      <path
        d="M 10 18 H 13.5 V 10 H 18.5 V 18 H 22.5 V 10 H 27.5 V 18 H 30"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
}

export function TimerSymbolSvg({ className }: SymbolSvgProps) {
  return (
    <svg viewBox="0 0 48 28" fill="none" aria-hidden="true" className={className}>
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
}

export function GroupSymbolSvg({
  className,
  isCustomGroup,
}: SymbolSvgProps & { isCustomGroup: boolean }) {
  return (
    <svg viewBox="0 0 48 28" fill="none" aria-hidden="true" className={className}>
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
      <path
        d="M 15 14 H 20 M 20 8.5 V 19.5 M 20 8.5 H 30 M 20 14 H 30 M 20 19.5 H 30"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
      />
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
}

export function SegmentSymbolSvg({
  className,
  isInputSegment,
}: SymbolSvgProps & { isInputSegment: boolean }) {
  if (isInputSegment) {
    return (
      <svg viewBox="0 0 48 28" fill="none" aria-hidden="true" className={className}>
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
    );
  }

  return (
    <svg viewBox="0 0 48 28" fill="none" aria-hidden="true" className={className}>
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
