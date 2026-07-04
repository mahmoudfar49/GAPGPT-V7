/**
 * GAPGPT V7 - Security Configuration
 * Single Source of Truth for all system parameters.
 * Version: 2.1 (Production-Grade)
 */

export interface RateLimitConfig {
    maxRequests: number;
    intervalMs: number;
    parallelism: number;
    waitIntervalMs: number;
    timeoutMs: number;
}

export interface RetryConfig {
    maxRetries: number;
    delayMs: number;
}

export interface CircuitBreakerConfig {
    failureThreshold: number;
    resetTimeoutMs: number;
}

export interface CacheConfig {
    defaultTtlMs: number;
}

export interface HealthMonitorConfig {
    checkIntervalMs: number;
}

export const SecurityConfig = Object.freeze({
    rateLimit: {
        maxRequests: 1,
        intervalMs: 800,
        parallelism: 1,
        waitIntervalMs: 100,
        timeoutMs: 5000,
    } as RateLimitConfig,

    retry: {
        maxRetries: 3,
        delayMs: 1000,
    } as RetryConfig,

    circuitBreaker: {
        failureThreshold: 5,
        resetTimeoutMs: 30000,
    } as CircuitBreakerConfig,

    cache: {
        defaultTtlMs: 60000,
    } as CacheConfig,

    healthMonitor: {
        checkIntervalMs: 5000,
    } as HealthMonitorConfig,
});
