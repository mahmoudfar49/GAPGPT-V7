// ============================================================
// GAPGPT V7
// Retry Engine Implementation - Type Inference Fixed
// Commit 4.1 Stable
// ============================================================

import { SecurityConfigSchema, BackoffStrategy } from "../config/SecurityConfig.js";

export interface RetryContext {
  readonly attempt: number;
  readonly delayMs: number;
  readonly error: Error;
}

export class RetryEngine {
  private readonly config: SecurityConfigSchema["retry"];

  constructor(config: SecurityConfigSchema["retry"]) {
    if (!config) {
      throw new Error("Retry configuration is required.");
    }
    this.config = config;
  }

  public async execute<T>(
    operation: () => Promise<T>,
    onRetry?: (context: RetryContext) => void,
  ): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        return await operation();
      } catch (error: unknown) {
        attempt++;

        if (attempt >= this.config.maxAttempts) {
          throw error instanceof Error ? error : new Error(String(error));
        }

        const currentError = error instanceof Error ? error : new Error(String(error));
        const delayMs = this.calculateDelay(attempt, this.config.strategy);

        if (onRetry) {
          onRetry(Object.freeze({ attempt, delayMs, error: currentError }));
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  private calculateDelay(attempt: number, strategy: BackoffStrategy): number {
    let delay = 0;

    switch (strategy) {
      case "exponential":
        delay = this.config.baseDelayMs * Math.pow(2, attempt - 1);
        break;
      case "linear":
        delay = this.config.baseDelayMs * attempt;
        break;
      case "fixed":
        delay = this.config.baseDelayMs;
        break;
      default: {
        // ✅ Fix: Safe runtime handling ensuring exhaustive checks are fully compliant
        const exhaustiveCheck: never = strategy as never;
        throw new Error(`Unknown backoff strategy context: ${String(exhaustiveCheck)}`);
      }
    }

    return Math.min(delay, this.config.maxDelayMs);
  }
}