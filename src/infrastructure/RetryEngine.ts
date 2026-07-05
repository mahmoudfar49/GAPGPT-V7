import type { RetryConfig } from "../config/SecurityConfig.js";
import { Timer } from "../core/Timer.js";

export interface RetryLog {
  readonly attempt: number;
  readonly delayMs: number;
}

export type RetryCallback = (
  attempt: number,
  error: unknown,
  nextDelayMs: number
) => void;

/**
 * Generic retry engine with configurable backoff strategies.
 */
export class RetryEngine {
  public constructor(private readonly config: RetryConfig) {}

  /**
   * Executes an asynchronous operation with retry support.
   */
  public async execute<T>(
    operation: () => Promise<T>,
    onRetry?: RetryCallback
  ): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        attempt += 1;
        return await operation();
      } catch (error: unknown) {
        if (attempt >= this.config.maxAttempts) {
          throw this.toError(error);
        }

        const delayMs = this.calculateDelay(attempt);

        onRetry?.(attempt, error, delayMs);

        await Timer.sleep(delayMs);
      }
    }
  }

  /**
   * Calculates the delay before the next retry attempt.
   */
  private calculateDelay(attempt: number): number {
    const {
      baseDelayMs,
      maxDelayMs,
      strategy,
    } = this.config;

    switch (strategy) {
      case "Fixed":
        return Math.min(baseDelayMs, maxDelayMs);

      case "Linear":
        return Math.min(baseDelayMs * attempt, maxDelayMs);

      case "Exponential":
        return Math.min(
          baseDelayMs * Math.pow(2, attempt - 1),
          maxDelayMs
        );

      case "FullJitter": {
        const exponentialDelay =
          baseDelayMs * Math.pow(2, attempt - 1);

        const cappedDelay = Math.min(
          exponentialDelay,
          maxDelayMs
        );

        if (cappedDelay <= 0) {
          return 0;
        }

        return Math.floor(Math.random() * cappedDelay);
      }

      default: {
        const exhaustiveCheck: never = strategy;
        throw new Error(
          `Unsupported retry strategy: ${String(exhaustiveCheck)}`
        );
      }
    }
  }

  /**
   * Normalizes unknown values into Error instances.
   */
  private toError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }

    if (error === null || error === undefined) {
      return new Error("Unknown retry failure.");
    }

    return new Error(String(error));
  }
}