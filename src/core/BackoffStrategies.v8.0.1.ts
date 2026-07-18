// ============================================================
// FILE: src/core/BackoffStrategies.v8.0.1.ts
// VERSION: v8.0.1
// COMMIT: 8 (Smart Retry Classification - Refactored)
// STATUS: Draft 🟡
// CHANGELOG:
//   v8.0.1 - Refinements based on review findings:
//            - Added sanitizeRetryAfterMs() to handle negative, NaN, Infinity
//            - Documented cap behavior: maxDelayMs is a HARD CAP on all delays
//            - All strategies now validate retryAfterMs before use
//            - Added JITTER_MAX_RATIO constant for bounded jitter
//   v8.0.0 - Initial release
// ============================================================

import {
  IBackoffStrategy,
  ExecutionContext,
  ToolExecutionError,
  RetryPolicyConfig,
} from "../types/ToolTypes.js";

// ============================================================
// Constants
// ============================================================

/**
 * Maximum ratio of jitter relative to base delay.
 * Jitter is bounded between 0 and (baseDelayMs * JITTER_MAX_RATIO).
 */
const JITTER_MAX_RATIO = 1.0;

// ============================================================
// Helper: Sanitize retryAfterMs
// Returns undefined if value is invalid (negative, NaN, Infinity)
// ============================================================

function sanitizeRetryAfterMs(value: unknown): number | undefined {
  if (typeof value !== "number") return undefined;
  if (!Number.isFinite(value)) return undefined;
  if (value < 0) return undefined;
  return value;
}

// ============================================================
// Fixed Delay Strategy
// Always returns the same delay regardless of attempt number.
// 
// CAP BEHAVIOR: maxDelayMs is a HARD CAP.
// If retryAfterMs > maxDelayMs, the delay is capped at maxDelayMs.
// This is intentional to prevent excessive delays from upstream hints.
// ============================================================

export class FixedDelayStrategy implements IBackoffStrategy {
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;

  constructor(baseDelayMs: number = 1000, maxDelayMs: number = 5000) {
    this.baseDelayMs = baseDelayMs;
    this.maxDelayMs = maxDelayMs;
  }

  public getDelayMs(context: ExecutionContext, error: ToolExecutionError): number {
    // Sanitize retryAfterMs
    const retryAfter = sanitizeRetryAfterMs(error.retryAfterMs);
    
    // If retryAfterMs is present and valid, use it (with cap)
    if (retryAfter !== undefined) {
      return Math.min(retryAfter, this.maxDelayMs);
    }
    
    // Otherwise use fixed base delay (with cap)
    return Math.min(this.baseDelayMs, this.maxDelayMs);
  }
}

// ============================================================
// Exponential Strategy
// delay = baseDelay * multiplier^(attempt-1), capped at maxDelay.
// 
// attempt 0 = first execution (no delay needed, but formula handles it)
// attempt 1 = first retry: baseDelay * multiplier^0 = baseDelay
// attempt 2 = second retry: baseDelay * multiplier^1
// attempt 3 = third retry: baseDelay * multiplier^2
// etc.
// 
// CAP BEHAVIOR: maxDelayMs is a HARD CAP.
// ============================================================

export class ExponentialStrategy implements IBackoffStrategy {
  private readonly baseDelayMs: number;
  private readonly multiplier: number;
  private readonly maxDelayMs: number;

  constructor(baseDelayMs: number = 100, multiplier: number = 2, maxDelayMs: number = 2000) {
    this.baseDelayMs = baseDelayMs;
    this.multiplier = multiplier;
    this.maxDelayMs = maxDelayMs;
  }

  public getDelayMs(context: ExecutionContext, error: ToolExecutionError): number {
    // Sanitize retryAfterMs
    const retryAfter = sanitizeRetryAfterMs(error.retryAfterMs);
    
    // If retryAfterMs is present and valid, use it (with cap)
    if (retryAfter !== undefined) {
      return Math.min(retryAfter, this.maxDelayMs);
    }
    
    // Calculate exponential delay
    // attempt 0 -> exponent 0 -> delay = baseDelay * 1 = baseDelay
    // attempt 1 -> exponent 0 -> delay = baseDelay * 1 = baseDelay
    // attempt 2 -> exponent 1 -> delay = baseDelay * multiplier
    const exponent = Math.max(0, context.attempt);
    const delay = this.baseDelayMs * Math.pow(this.multiplier, exponent);
    
    return Math.min(delay, this.maxDelayMs);
  }
}

// ============================================================
// Exponential Jitter Strategy
// delay = exponential + bounded random jitter
// Prevents thundering herd problem in distributed systems.
// 
// Jitter is bounded between 0 and (baseDelayMs * JITTER_MAX_RATIO).
// Total delay is capped at maxDelayMs.
// 
// CAP BEHAVIOR: maxDelayMs is a HARD CAP on the TOTAL delay (exponential + jitter).
// ============================================================

export class ExponentialJitterStrategy implements IBackoffStrategy {
  private readonly baseDelayMs: number;
  private readonly multiplier: number;
  private readonly maxDelayMs: number;
  private readonly randomFn: () => number;

  constructor(
    baseDelayMs: number = 100,
    multiplier: number = 2,
    maxDelayMs: number = 2000,
    randomFn: () => number = Math.random
  ) {
    this.baseDelayMs = baseDelayMs;
    this.multiplier = multiplier;
    this.maxDelayMs = maxDelayMs;
    this.randomFn = randomFn;
  }

  public getDelayMs(context: ExecutionContext, error: ToolExecutionError): number {
    // Sanitize retryAfterMs
    const retryAfter = sanitizeRetryAfterMs(error.retryAfterMs);
    
    // If retryAfterMs is present and valid, use it (with cap)
    if (retryAfter !== undefined) {
      return Math.min(retryAfter, this.maxDelayMs);
    }
    
    // Calculate exponential component
    const exponent = Math.max(0, context.attempt);
    const exponential = this.baseDelayMs * Math.pow(this.multiplier, exponent);
    
    // Calculate bounded jitter: random value between 0 and (baseDelayMs * JITTER_MAX_RATIO)
    const maxJitter = this.baseDelayMs * JITTER_MAX_RATIO;
    const jitter = this.randomFn() * maxJitter;
    
    // Total delay capped at maxDelayMs
    const totalDelay = exponential + jitter;
    return Math.min(totalDelay, this.maxDelayMs);
  }
}

// ============================================================
// Default Backoff Strategy Factory
// Returns the recommended default strategy based on config
// ============================================================

export function createDefaultBackoffStrategy(
  config?: Partial<RetryPolicyConfig>
): IBackoffStrategy {
  if (config?.jitter === false) {
    return new ExponentialStrategy(
      config.baseDelayMs ?? 100,
      config.backoffMultiplier ?? 2,
      config.maxDelayMs ?? 2000
    );
  }
  
  return new ExponentialJitterStrategy(
    config?.baseDelayMs ?? 100,
    config?.backoffMultiplier ?? 2,
    config?.maxDelayMs ?? 2000
  );
}

// ============================================================
// Pre-configured Strategy Instances
// For convenience and consistency
// 
// NOTE: These instances use Math.random() by default, so they
// are NOT deterministic. For testing, create your own instance
// with a seeded random function.
// ============================================================

export const DEFAULT_BACKOFF_STRATEGY: IBackoffStrategy = Object.freeze(
  new ExponentialJitterStrategy(100, 2, 2000)
);

export const FAST_BACKOFF_STRATEGY: IBackoffStrategy = Object.freeze(
  new ExponentialJitterStrategy(50, 2, 1000)
);

export const SLOW_BACKOFF_STRATEGY: IBackoffStrategy = Object.freeze(
  new ExponentialJitterStrategy(500, 2, 5000)
);
