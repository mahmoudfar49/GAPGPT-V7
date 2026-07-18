// ============================================================
// FILE: src/core/BackoffStrategies.ts
// VERSION: Shim
// COMMIT: 8 (Smart Retry Classification - Refactored)
// STATUS: Draft 🟡
// CHANGELOG:
//   Entry point for BackoffStrategies v8.0.1
// ============================================================
export {
  FixedDelayStrategy,
  ExponentialStrategy,
  ExponentialJitterStrategy,
  createDefaultBackoffStrategy,
  DEFAULT_BACKOFF_STRATEGY,
  FAST_BACKOFF_STRATEGY,
  SLOW_BACKOFF_STRATEGY,
} from "./BackoffStrategies.v8.0.1.js";
