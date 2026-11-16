import { debugLog } from "@/lib/debug";

export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface TimeoutSignalHandle {
  signal: AbortSignal;
  cleanup: () => void;
}

/**
 * Creates an AbortSignal backed by an explicit timer so requests reliably abort
 * even in runtimes or embedded WebViews without `AbortSignal.timeout`.
 */
export function createTimeoutSignal(timeoutMs: number): TimeoutSignalHandle {
  const controller = new AbortController();
  const safeTimeoutMs = Math.max(1, timeoutMs);
  const timerId = setTimeout(() => {
    const timeoutError = new Error(`Request timed out after ${safeTimeoutMs}ms`);
    timeoutError.name = "TimeoutError";
    controller.abort(timeoutError);
  }, safeTimeoutMs);

  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timerId),
  };
}

export class CircuitOpenError extends Error {
  public readonly serviceName: string;

  constructor(serviceName: string) {
    super(`Circuit breaker is OPEN for ${serviceName}`);
    this.name = "CircuitOpenError";
    this.serviceName = serviceName;
  }
}

export interface CircuitBreakerOptions {
  serviceName: string;
  failureThreshold?: number;
  resetTimeoutMs?: number;
  nowFn?: () => number;
}

/**
 * Production Release-It Circuit Breaker:
 * Trips OPEN after consecutive transient failures, cools down after `resetTimeoutMs`,
 * and allows a single HALF_OPEN probe before restoring CLOSED operation.
 */
export class CircuitBreaker {
  private readonly serviceName: string;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly nowFn: () => number;

  private state: CircuitBreakerState = "CLOSED";
  private consecutiveFailures = 0;
  private openedAtMs = 0;
  private halfOpenProbeInFlight = false;

  constructor(options: CircuitBreakerOptions) {
    this.serviceName = options.serviceName;
    this.failureThreshold = Math.max(1, options.failureThreshold ?? 3);
    this.resetTimeoutMs = Math.max(100, options.resetTimeoutMs ?? 30_000);
    this.nowFn = options.nowFn ?? (() => Date.now());
  }

  public getState(): CircuitBreakerState {
    if (this.state === "OPEN" && this.nowFn() - this.openedAtMs >= this.resetTimeoutMs) {
      return "HALF_OPEN";
    }

    return this.state;
  }

  public reset(): void {
    this.state = "CLOSED";
    this.consecutiveFailures = 0;
    this.openedAtMs = 0;
    this.halfOpenProbeInFlight = false;
  }

  private transitionTo(nextState: CircuitBreakerState): void {
    if (this.state === nextState) return;
    this.state = nextState;

    if (nextState === "OPEN") {
      this.openedAtMs = this.nowFn();
      this.halfOpenProbeInFlight = false;
      debugLog.warn("Resilience", `Circuit breaker opened for ${this.serviceName}`);
    } else if (nextState === "CLOSED") {
      this.consecutiveFailures = 0;
      this.halfOpenProbeInFlight = false;
      debugLog.info("Resilience", `Circuit breaker closed for ${this.serviceName}`);
    }
  }

  public async execute<T>(
    operation: () => Promise<T>,
    options?: { shouldCountFailure?: (error: unknown) => boolean },
  ): Promise<T> {
    const effectiveState = this.getState();

    if (effectiveState === "OPEN") {
      throw new CircuitOpenError(this.serviceName);
    }

    if (effectiveState === "HALF_OPEN") {
      if (this.halfOpenProbeInFlight) {
        throw new CircuitOpenError(this.serviceName);
      }

      this.state = "HALF_OPEN";
      this.halfOpenProbeInFlight = true;
    }

    try {
      const result = await operation();
      this.transitionTo("CLOSED");

      return result;
    } catch (error) {
      const countsAsTrip = options?.shouldCountFailure ? options.shouldCountFailure(error) : true;

      if (this.state === "HALF_OPEN") {
        this.halfOpenProbeInFlight = false;

        if (countsAsTrip) {
          this.transitionTo("OPEN");
        }
      } else if (countsAsTrip) {
        this.consecutiveFailures += 1;

        if (this.consecutiveFailures >= this.failureThreshold) {
          this.transitionTo("OPEN");
        }
      }

      throw error;
    }
  }
}

export interface BackoffRetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  isRetryable?: (error: unknown) => boolean;
  sleepFn?: (delayMs: number) => Promise<void>;
  randomFn?: () => number;
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Computes bounded exponential backoff with full jitter (`[0, capDelay]`).
 */
export function computeFullJitterDelayMs(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  randomFn: () => number = Math.random,
): number {
  const cap = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt));

  return Math.max(1, Math.round(randomFn() * cap));
}

/**
 * Bounded retry runner using exponential backoff + full jitter for idempotent operations.
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: BackoffRetryOptions = {},
): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const baseDelayMs = Math.max(1, options.baseDelayMs ?? 300);
  const maxDelayMs = Math.max(baseDelayMs, options.maxDelayMs ?? 5000);
  const sleep = options.sleepFn ?? defaultSleep;
  const randomFn = options.randomFn ?? Math.random;
  const isRetryable = options.isRetryable ?? ((err) => !(err instanceof CircuitOpenError));

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt >= maxAttempts - 1;

      if (isLastAttempt || !isRetryable(error)) {
        throw error;
      }

      const delayMs = computeFullJitterDelayMs(attempt, baseDelayMs, maxDelayMs, randomFn);
      options.onRetry?.(attempt + 1, delayMs, error);
      await sleep(delayMs);
    }
  }

  throw lastError;
}

const MAX_LATENCY_SAMPLES = 64;

export interface IntegrationRedMetrics {
  requests: number;
  errors: number;
  retries: number;
  circuitOpens: number;
  lastLatencyMs: number;
  p95LatencyMs: number;
}

interface InternalMetricBucket extends IntegrationRedMetrics {
  latencySamples: number[];
}

export type IntegrationName = "cloudflare" | "archive" | "localWs" | "mqtt";

const metricBuckets = new Map<IntegrationName, InternalMetricBucket>();

function getOrCreateBucket(name: IntegrationName): InternalMetricBucket {
  let bucket = metricBuckets.get(name);

  if (!bucket) {
    bucket = {
      requests: 0,
      errors: 0,
      retries: 0,
      circuitOpens: 0,
      lastLatencyMs: 0,
      p95LatencyMs: 0,
      latencySamples: [],
    };
    metricBuckets.set(name, bucket);
  }

  return bucket;
}

function computeP95(samples: number[]): number {
  if (samples.length === 0) return 0;

  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(0.95 * (sorted.length - 1)));

  return sorted[index];
}

export function recordIntegrationRequest(
  name: IntegrationName,
  durationMs: number,
  ok: boolean,
): void {
  const bucket = getOrCreateBucket(name);
  bucket.requests += 1;

  if (!ok) {
    bucket.errors += 1;
  }

  const rounded = Math.max(0, Math.round(durationMs));
  bucket.lastLatencyMs = rounded;
  bucket.latencySamples.push(rounded);

  if (bucket.latencySamples.length > MAX_LATENCY_SAMPLES) {
    bucket.latencySamples.shift();
  }

  bucket.p95LatencyMs = computeP95(bucket.latencySamples);
}

export function recordIntegrationRetry(name: IntegrationName): void {
  getOrCreateBucket(name).retries += 1;
}

export function recordCircuitOpen(name: IntegrationName): void {
  getOrCreateBucket(name).circuitOpens += 1;
}

export interface ReliabilityHealthSnapshot {
  status: "healthy" | "degraded";
  circuits: Record<string, CircuitBreakerState>;
  metrics: Partial<Record<IntegrationName, IntegrationRedMetrics>>;
}

export function getReliabilityHealthSnapshot(
  breakers: Record<string, CircuitBreaker> = {},
): ReliabilityHealthSnapshot {
  const circuits: Record<string, CircuitBreakerState> = {};
  let hasOpenCircuit = false;

  for (const [name, breaker] of Object.entries(breakers)) {
    const state = breaker.getState();
    circuits[name] = state;

    if (state === "OPEN") {
      hasOpenCircuit = true;
    }
  }

  const metrics: Partial<Record<IntegrationName, IntegrationRedMetrics>> = {};

  for (const [name, bucket] of metricBuckets.entries()) {
    metrics[name] = {
      requests: bucket.requests,
      errors: bucket.errors,
      retries: bucket.retries,
      circuitOpens: bucket.circuitOpens,
      lastLatencyMs: bucket.lastLatencyMs,
      p95LatencyMs: bucket.p95LatencyMs,
    };
  }

  return {
    status: hasOpenCircuit ? "degraded" : "healthy",
    circuits,
    metrics,
  };
}
