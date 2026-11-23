import { getLocalWs } from "@/features/iot/services/localWs/client";
import { getIoTStoreSnapshot } from "@/features/iot/services/storeBridge";
import { clampAnalogValue, clampPwmResolution, getAnalogMaxDuty } from "./analogOutput";

export type AnalogRampTransportMode = "local" | "mqtt" | "lowData";

export interface SmoothPwmRampPlan {
  steps: number[];
  intervalMs: number;
}

const LOCAL_WS_OPEN_READY_STATE = 1;
const LOCAL_STEP_INTERVAL_MS = 28;
const MQTT_STEP_INTERVAL_MS = 55;
const LOCAL_MIN_JUMP_RATIO = 0.02;
const MQTT_MIN_JUMP_RATIO = 0.04;
const EASE_OUT_EXPONENT = 1.75;

/**
 * Resolves the optimal PWM ramp transport profile based on active hardware link
 * and user bandwidth preference (`local` LAN WebSocket, `mqtt` Internet, or `lowData`).
 */
export function resolveAnalogRampTransportMode(lowDataMode = false): AnalogRampTransportMode {
  if (lowDataMode) return "lowData";

  const snapshot = getIoTStoreSnapshot();
  const ws = getLocalWs();

  if (snapshot.isLocal && ws?.readyState === LOCAL_WS_OPEN_READY_STATE) {
    return "local";
  }

  return "mqtt";
}

/**
 * Computes a deduplicated, eased sequence of integer PWM duty values from `fromDuty`
 * to `toDuty` so LED brightness dims smoothly while landing on the exact target duty.
 */
export function buildSmoothPwmRampSteps(
  fromDuty: number,
  toDuty: number,
  resolution?: number | null,
  mode: AnalogRampTransportMode = "mqtt",
): SmoothPwmRampPlan {
  const res = clampPwmResolution(resolution);
  const start = clampAnalogValue(fromDuty, res);
  const target = clampAnalogValue(toDuty, res);

  if (start === target) {
    return {
      steps: [],
      intervalMs: mode === "local" ? LOCAL_STEP_INTERVAL_MS : MQTT_STEP_INTERVAL_MS,
    };
  }

  if (mode === "lowData") {
    return { steps: [target], intervalMs: MQTT_STEP_INTERVAL_MS };
  }

  const maxDuty = getAnalogMaxDuty(res);
  const delta = target - start;
  const deltaRatio = Math.abs(delta) / maxDuty;
  const intervalMs = mode === "local" ? LOCAL_STEP_INTERVAL_MS : MQTT_STEP_INTERVAL_MS;
  const minJumpRatio = mode === "local" ? LOCAL_MIN_JUMP_RATIO : MQTT_MIN_JUMP_RATIO;

  if (deltaRatio < minJumpRatio || Math.abs(delta) <= 2) {
    return { steps: [target], intervalMs };
  }

  const stepCount =
    mode === "local"
      ? Math.min(14, Math.max(4, Math.round(4 + deltaRatio * 14)))
      : Math.min(8, Math.max(3, Math.round(3 + deltaRatio * 7)));

  const steps: number[] = [];
  let prev = start;

  for (let i = 1; i <= stepCount; i++) {
    const t = i / stepCount;
    // Gentle ease-out starts moving immediately on frame 1 (low perceived lag)
    // and decelerates smoothly into the final duty where human vision is most sensitive.
    const eased = i === stepCount ? 1 : 1 - (1 - t) ** EASE_OUT_EXPONENT;
    const duty = i === stepCount ? target : clampAnalogValue(start + delta * eased, res);

    if (duty !== prev) {
      steps.push(duty);
      prev = duty;
    }
  }

  if (steps.length === 0 || steps[steps.length - 1] !== target) {
    steps.push(target);
  }

  return { steps, intervalMs };
}

export interface AnalogRampDispatchers {
  /** Sends a fast non-persistent hardware step (QoS 0 over MQTT, skipStoreUpdate). */
  sendStep: (duty: number) => void;
  /** Sends the final reliable commit (configured QoS + Cloudflare persist). */
  sendCommit: (duty: number) => void;
}

interface PinRampEntry {
  currentDuty: number;
  targetDuty: number;
  queue: number[];
  intervalMs: number;
  lastSentAt: number;
  commitOnFinish: boolean;
  timerId: ReturnType<typeof setTimeout> | null;
  dispatchers: AnalogRampDispatchers;
}

const activeRamps = new Map<string, PinRampEntry>();

function clearRampTimer(entry: PinRampEntry): void {
  if (entry.timerId !== null) {
    clearTimeout(entry.timerId);
    entry.timerId = null;
  }
}

function scheduleNextRampTick(pin: string, entry: PinRampEntry): void {
  clearRampTimer(entry);

  if (entry.queue.length === 0) {
    if (entry.commitOnFinish) {
      const finalDuty = entry.targetDuty;
      const { sendCommit } = entry.dispatchers;
      activeRamps.delete(pin);
      sendCommit(finalDuty);
    }
    return;
  }

  const now = Date.now();
  const waitMs = Math.max(0, entry.intervalMs - (now - entry.lastSentAt));

  const runTick = () => {
    entry.timerId = null;
    if (activeRamps.get(pin) !== entry) return;

    const nextDuty = entry.queue.shift();
    if (nextDuty === undefined) {
      if (entry.commitOnFinish) {
        const finalDuty = entry.targetDuty;
        const { sendCommit } = entry.dispatchers;
        activeRamps.delete(pin);
        sendCommit(finalDuty);
      }
      return;
    }

    entry.currentDuty = nextDuty;
    entry.lastSentAt = Date.now();

    const isLastStep = entry.queue.length === 0;
    if (isLastStep && entry.commitOnFinish) {
      const { sendCommit } = entry.dispatchers;
      activeRamps.delete(pin);
      sendCommit(nextDuty);
      return;
    }

    entry.dispatchers.sendStep(nextDuty);

    if (entry.queue.length > 0) {
      scheduleNextRampTick(pin, entry);
    }
  };

  if (waitMs === 0) {
    runTick();
  } else {
    entry.timerId = setTimeout(runTick, waitMs);
  }
}

/**
 * Cancels any in-flight PWM smooth ramp for `pin` (e.g. when toggling Power OFF/ON).
 */
export function cancelAnalogRamp(pin: string): void {
  if (!pin) return;

  const entry = activeRamps.get(pin);
  if (!entry) return;

  clearRampTimer(entry);
  activeRamps.delete(pin);
}

/**
 * Drives a PWM pin smoothly toward `targetDuty` during live slider drag or click-to-jump.
 * Automatically retargets seamlessly from the last dispatched hardware duty.
 */
export function driveAnalogPinRamp(
  pin: string,
  targetDuty: number,
  resolution: number,
  currentStoreDuty: number,
  lowDataMode: boolean,
  dispatchers: AnalogRampDispatchers,
): void {
  if (!pin) return;

  const clampedTarget = clampAnalogValue(targetDuty, resolution);
  const mode = resolveAnalogRampTransportMode(lowDataMode);
  const existing = activeRamps.get(pin);
  const startDuty = existing
    ? existing.currentDuty
    : clampAnalogValue(currentStoreDuty, resolution);
  const plan = buildSmoothPwmRampSteps(startDuty, clampedTarget, resolution, mode);

  if (existing) {
    clearRampTimer(existing);
    existing.targetDuty = clampedTarget;
    existing.queue = plan.steps;
    existing.intervalMs = plan.intervalMs;
    existing.commitOnFinish = false;
    existing.dispatchers = dispatchers;
    scheduleNextRampTick(pin, existing);
    return;
  }

  const entry: PinRampEntry = {
    currentDuty: startDuty,
    targetDuty: clampedTarget,
    queue: plan.steps,
    intervalMs: plan.intervalMs,
    lastSentAt: 0,
    commitOnFinish: false,
    timerId: null,
    dispatchers,
  };

  activeRamps.set(pin, entry);
  scheduleNextRampTick(pin, entry);
}

/**
 * Commits the final PWM duty on pointer release or keyboard step.
 * If a smooth ramp is still gliding toward `finalDuty`, finishes the ramp smoothly
 * and executes the reliable commit (`persistToCloud: true`) on the final frame.
 */
export function commitAnalogPinRamp(
  pin: string,
  finalDuty: number,
  resolution: number,
  currentStoreDuty: number,
  lowDataMode: boolean,
  dispatchers: AnalogRampDispatchers,
): void {
  if (!pin) return;

  const clampedFinal = clampAnalogValue(finalDuty, resolution);
  const existing = activeRamps.get(pin);

  if (existing) {
    existing.dispatchers = dispatchers;
    existing.commitOnFinish = true;

    if (existing.targetDuty !== clampedFinal) {
      const mode = resolveAnalogRampTransportMode(lowDataMode);
      const plan = buildSmoothPwmRampSteps(existing.currentDuty, clampedFinal, resolution, mode);
      existing.targetDuty = clampedFinal;
      existing.queue = plan.steps;
      existing.intervalMs = plan.intervalMs;
    }

    if (existing.queue.length === 0) {
      clearRampTimer(existing);
      activeRamps.delete(pin);
      dispatchers.sendCommit(clampedFinal);
      return;
    }

    if (existing.timerId === null) {
      scheduleNextRampTick(pin, existing);
    }
    return;
  }

  const startDuty = clampAnalogValue(currentStoreDuty, resolution);
  const mode = resolveAnalogRampTransportMode(lowDataMode);
  const plan = buildSmoothPwmRampSteps(startDuty, clampedFinal, resolution, mode);

  if (plan.steps.length <= 1) {
    dispatchers.sendCommit(clampedFinal);
    return;
  }

  const entry: PinRampEntry = {
    currentDuty: startDuty,
    targetDuty: clampedFinal,
    queue: plan.steps,
    intervalMs: plan.intervalMs,
    lastSentAt: 0,
    commitOnFinish: true,
    timerId: null,
    dispatchers,
  };

  activeRamps.set(pin, entry);
  scheduleNextRampTick(pin, entry);
}
