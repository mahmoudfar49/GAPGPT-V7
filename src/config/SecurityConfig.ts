import { deepFreeze } from "../core/deepFreeze.js";

export type BackoffStrategy =
  | "Fixed"
  | "Linear"
  | "Exponential"
  | "FullJitter";

export interface RateLimitConfig {
  readonly maxRequests: number;
  readonly intervalMs: number;
  readonly parallelism: number;
  readonly waitIntervalMs: number;
  readonly timeoutMs: number;
}

export interface RetryConfig {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly strategy: BackoffStrategy;
}

export interface CircuitBreakerConfig {
  readonly failureThreshold: number;
  readonly resetTimeoutMs: number;
}

export interface CacheConfig {
  readonly defaultTtlMs: number;
}

export interface HealthMonitorConfig {
  readonly checkIntervalMs: number;
}

export interface SecurityConfigSchema {
  readonly rateLimit: RateLimitConfig;
  readonly retry: RetryConfig;
  readonly circuitBreaker: CircuitBreakerConfig;
  readonly cache: CacheConfig;
  readonly healthMonitor: HealthMonitorConfig;
}

export const SecurityConfig: Readonly<SecurityConfigSchema> = deepFreeze({
  rateLimit: {
    maxRequests: 1,
    intervalMs: 800,
    parallelism: 1,
    waitIntervalMs: 100,
    timeoutMs: 5000,
  },

  retry: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    strategy: "FullJitter",
  },

  circuitBreaker: {
    failureThreshold: 5,
    resetTimeoutMs: 30000,
  },

  cache: {
    defaultTtlMs: 60000,
  },

  healthMonitor: {
    checkIntervalMs: 5000,
  },
});