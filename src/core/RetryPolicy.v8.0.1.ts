// ============================================================
// FILE: src/core/RetryPolicy.v8.0.1.ts
// VERSION: v8.0.1
// COMMIT: 8 (Smart Retry Classification - Refactored)
// STATUS: Draft 🟡
// CHANGELOG:
//   v8.0.1 - Critical fixes based on review findings:
//            - FIXED: calculateDelay() now uses resolved policy parameters
//            - FIXED: retryableCategories is now deep-frozen
//            - ADDED: Runtime validation for retryableCategories (only valid ErrorCategory values)
//            - ADDED: respectRetryAfterMs option (INTENTIONAL OVERRIDE of maxDelayMs)
//            - FIXED: resolvePolicy() ALWAYS sanitizes/freeze output (even without toolPolicy)
//            - CLARIFIED: defaultBackoffStrategy only used for getBackoffStrategy()
//   v8.0.0 - Initial release
// ============================================================

import {
  IRetryPolicy,
  IBackoffStrategy,
  RetryPolicyConfig,
  RetryDecision,
  ToolExecutionError,
  ExecutionContext,
  ToolMetadata,
  ErrorCategory,
} from "../types/ToolTypes.js";
import {
  ExponentialStrategy,
  ExponentialJitterStrategy,
} from "./BackoffStrategies.js";

// ============================================================
// Valid Error Categories (for validation)
// ============================================================

const VALID_CATEGORIES: ReadonlySet<ErrorCategory> = new Set<ErrorCategory>([
  "TRANSIENT", "TIMEOUT", "RATE_LIMIT", "NETWORK",
  "VALIDATION", "AUTH", "NOT_FOUND", "CONFLICT", "UNKNOWN",
]);

export const DEFAULT_RETRY_POLICY_CONFIG: RetryPolicyConfig = Object.freeze({
  maxRetries: 3,
  baseDelayMs: 100,
  backoffMultiplier: 2,
  maxDelayMs: 2000,
  jitter: true,
  retryableCategories: Object.freeze([
    "TRANSIENT",
    "TIMEOUT",
    "RATE_LIMIT",
    "NETWORK",
  ] as const),
  respectRetryAfterMs: false,
});

const NON_RETRYABLE_CATEGORIES: ReadonlySet<ErrorCategory> = new Set([
  "VALIDATION",
  "AUTH",
  "NOT_FOUND",
  "UNKNOWN",
]);

const IDEMPOTENCY_REQUIRED_CATEGORIES: ReadonlySet<ErrorCategory> = new Set([
  "NETWORK",
  "TIMEOUT",
]);

interface MutableRetryPolicyConfig {
  maxRetries?: number;
  baseDelayMs?: number;
  backoffMultiplier?: number;
  maxDelayMs?: number;
  jitter?: boolean;
  retryableCategories?: readonly ErrorCategory[];
  respectRetryAfterMs?: boolean;
}

// ============================================================
// sanitizePolicy: Runtime validation + sanitization
// 
// VALIDATION:
// - retryableCategories: only valid ErrorCategory values accepted
// - numeric fields: clamped to safe ranges
// - boolean fields: coerced to boolean
// 
// If all categories in retryableCategories are invalid, returns undefined
// (caller will fall back to default)
// ============================================================

function sanitizePolicy(policy: Partial<RetryPolicyConfig>): MutableRetryPolicyConfig {
  const sanitized: MutableRetryPolicyConfig = {};

  if (policy.maxRetries !== undefined) {
    const value = Math.max(0, Math.floor(policy.maxRetries));
    sanitized.maxRetries = Number.isFinite(value) ? value : 0;
  }

  if (policy.baseDelayMs !== undefined) {
    const value = Math.max(0, policy.baseDelayMs);
    sanitized.baseDelayMs = Number.isFinite(value) ? value : 100;
  }

  if (policy.backoffMultiplier !== undefined) {
    const value = Math.max(0.001, policy.backoffMultiplier);
    sanitized.backoffMultiplier = Number.isFinite(value) ? value : 2;
  }

  if (policy.maxDelayMs !== undefined) {
    const value = Math.max(0, policy.maxDelayMs);
    sanitized.maxDelayMs = Number.isFinite(value) ? value : 2000;
  }

  if (policy.jitter !== undefined) {
    sanitized.jitter = Boolean(policy.jitter);
  }

  if (policy.retryableCategories !== undefined) {
    // RUNTIME VALIDATION: Filter out invalid categories
    const validCategories = policy.retryableCategories.filter(
      cat => VALID_CATEGORIES.has(cat as ErrorCategory)
    );
    
    // If all categories were invalid, return undefined (will fall back to default)
    if (validCategories.length === 0) {
      sanitized.retryableCategories = undefined;
    } else {
      // Deep freeze the validated array
      sanitized.retryableCategories = Object.freeze([...validCategories] as ErrorCategory[]);
    }
  }

  if (policy.respectRetryAfterMs !== undefined) {
    sanitized.respectRetryAfterMs = Boolean(policy.respectRetryAfterMs);
  }

  return sanitized;
}

function buildBackoffStrategyFromPolicy(policy: RetryPolicyConfig): IBackoffStrategy {
  if (policy.jitter === false) {
    return new ExponentialStrategy(
      policy.baseDelayMs,
      policy.backoffMultiplier,
      policy.maxDelayMs
    );
  }
  return new ExponentialJitterStrategy(
    policy.baseDelayMs,
    policy.backoffMultiplier,
    policy.maxDelayMs
  );
}

export class DefaultRetryPolicy implements IRetryPolicy {
  // NOTE: This strategy is ONLY used by getBackoffStrategy() for external consumers.
  // calculateDelay() builds its own strategy from the resolved policy parameters.
  // This separation allows per-call policy overrides while maintaining a default for inspection.
  private readonly defaultBackoffStrategy: IBackoffStrategy;

  constructor(defaultBackoffStrategy?: IBackoffStrategy) {
    this.defaultBackoffStrategy = defaultBackoffStrategy ?? new ExponentialJitterStrategy(100, 2, 2000);
  }

  // ========================================================
  // resolvePolicy: ALWAYS sanitizes and freezes output
  // 
  // GUARANTEE: Output is always immutable, regardless of input mutability.
  // Even if toolPolicy is undefined, defaultPolicy is sanitized/frozen.
  // 
  // VALIDATION: retryableCategories are validated at runtime.
  // Invalid categories are filtered out. If all are invalid, falls back to default.
  // ========================================================
  public resolvePolicy(
    defaultPolicy: RetryPolicyConfig,
    toolPolicy?: Partial<RetryPolicyConfig>
  ): RetryPolicyConfig {
    // ALWAYS sanitize defaultPolicy first (ensures immutability)
    const sanitizedDefault = sanitizePolicy(defaultPolicy);

    if (!toolPolicy) {
      // No tool policy: return sanitized default (with fallbacks to DEFAULT_RETRY_POLICY_CONFIG)
      return Object.freeze({
        maxRetries: sanitizedDefault.maxRetries ?? defaultPolicy.maxRetries,
        baseDelayMs: sanitizedDefault.baseDelayMs ?? defaultPolicy.baseDelayMs,
        backoffMultiplier: sanitizedDefault.backoffMultiplier ?? defaultPolicy.backoffMultiplier,
        maxDelayMs: sanitizedDefault.maxDelayMs ?? defaultPolicy.maxDelayMs,
        jitter: sanitizedDefault.jitter ?? defaultPolicy.jitter,
        retryableCategories: sanitizedDefault.retryableCategories ?? defaultPolicy.retryableCategories,
        respectRetryAfterMs: sanitizedDefault.respectRetryAfterMs ?? defaultPolicy.respectRetryAfterMs ?? false,
      });
    }

    // Tool policy exists: sanitize it and merge with sanitized default
    const sanitizedTool = sanitizePolicy(toolPolicy);

    return Object.freeze({
      maxRetries: sanitizedTool.maxRetries ?? sanitizedDefault.maxRetries ?? defaultPolicy.maxRetries,
      baseDelayMs: sanitizedTool.baseDelayMs ?? sanitizedDefault.baseDelayMs ?? defaultPolicy.baseDelayMs,
      backoffMultiplier: sanitizedTool.backoffMultiplier ?? sanitizedDefault.backoffMultiplier ?? defaultPolicy.backoffMultiplier,
      maxDelayMs: sanitizedTool.maxDelayMs ?? sanitizedDefault.maxDelayMs ?? defaultPolicy.maxDelayMs,
      jitter: sanitizedTool.jitter ?? sanitizedDefault.jitter ?? defaultPolicy.jitter,
      retryableCategories: sanitizedTool.retryableCategories ?? sanitizedDefault.retryableCategories ?? defaultPolicy.retryableCategories,
      respectRetryAfterMs: sanitizedTool.respectRetryAfterMs ?? sanitizedDefault.respectRetryAfterMs ?? defaultPolicy.respectRetryAfterMs ?? false,
    });
  }

  public shouldRetry(
    error: ToolExecutionError,
    context: ExecutionContext,
    policy: RetryPolicyConfig,
    metadata?: ToolMetadata
  ): RetryDecision {
    const category = error.category;

    if (NON_RETRYABLE_CATEGORIES.has(category)) {
      return "fail";
    }

    if (!policy.retryableCategories.includes(category)) {
      return "fail";
    }

    if (context.attempt >= policy.maxRetries) {
      return "fail";
    }

    if (IDEMPOTENCY_REQUIRED_CATEGORIES.has(category)) {
      if (metadata?.idempotent === true) return "retry";
      if (metadata?.idempotent === false) return "fail";
      return "fail";
    }

    return "retry";
  }

  public getBackoffStrategy(): IBackoffStrategy {
    return this.defaultBackoffStrategy;
  }

  public calculateDelay(
    error: ToolExecutionError,
    context: ExecutionContext,
    policy: RetryPolicyConfig
  ): number {
    // Handle retryAfterMs
    if (error.retryAfterMs !== undefined && Number.isFinite(error.retryAfterMs) && error.retryAfterMs >= 0) {
      // DESIGN DECISION: respectRetryAfterMs is an INTENTIONAL OVERRIDE of maxDelayMs.
      // When true, the upstream hint is respected exactly (no cap).
      // This allows explicit control when upstream knows better (e.g., rate limit windows).
      // When false (default), maxDelayMs acts as a hard cap to prevent excessive delays.
      if (policy.respectRetryAfterMs) {
        return error.retryAfterMs;  // No cap - intentional override
      }
      return Math.min(error.retryAfterMs, policy.maxDelayMs);  // Hard cap
    }

    // Build strategy from RESOLVED policy parameters
    const strategy = buildBackoffStrategyFromPolicy(policy);
    
    const errorWithoutRetryAfter: ToolExecutionError = {
      ...error,
      retryAfterMs: undefined,
    };

    return strategy.getDelayMs(context, errorWithoutRetryAfter);
  }
}
