import type { RetryConfig } from "../config/SecurityConfig.js";
import { RetryEngine, type RetryLog } from "../infrastructure/RetryEngine.js";
import {
  printSection,
  printSuccess,
  printInfo,
} from "./helpers/testUtils.js";

export async function runRetryEngineTest(): Promise<void> {
  printSection("RetryEngine Test");

  // ---------------------------------------------------------------------------
  // Scenario 1
  // Direct execution without retry
  // ---------------------------------------------------------------------------

  printInfo("Scenario 1: Direct execution without retry");

  const noRetryConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelayMs: 100,
    maxDelayMs: 500,
    strategy: "Fixed",
  };

  const noRetryEngine = new RetryEngine(noRetryConfig);

  let noRetryCallCount = 0;

  const directResult = await noRetryEngine.execute(async () => {
    noRetryCallCount += 1;
    return "Operation Output Data";
  });

  if (directResult !== "Operation Output Data") {
    throw new Error("Unexpected direct result from RetryEngine.");
  }

  if (noRetryCallCount !== 1) {
    throw new Error(
      `Expected one operation call, received ${noRetryCallCount}.`
    );
  }

  printSuccess("Direct execution without retry passed.");

  // ---------------------------------------------------------------------------
  // Scenario 2
  // Retry until success using FullJitter
  // ---------------------------------------------------------------------------

  printInfo("Scenario 2: Retry until success (FullJitter)");

  const retryConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelayMs: 100,
    maxDelayMs: 1000,
    strategy: "FullJitter",
  };

  const retryEngine = new RetryEngine(retryConfig);

  let retryCallCount = 0;

  const retryLogs: RetryLog[] = [];

  const eventualResult = await retryEngine.execute(
    async () => {
      retryCallCount += 1;

      if (retryCallCount < 3) {
        throw new Error(`Temporary failure #${retryCallCount}`);
      }

      return "Final Success Value";
    },
    (attempt, error, nextDelayMs) => {
      retryLogs.push({
        attempt,
        delayMs: nextDelayMs,
      });

      const message =
        error instanceof Error ? error.message : String(error);

      printInfo(
        `Retry attempt ${attempt} failed: ${message}. Next delay: ${nextDelayMs}ms`
      );
    }
  );

  if (eventualResult !== "Final Success Value") {
    throw new Error("Unexpected eventual result from RetryEngine.");
  }

  if (retryCallCount !== 3) {
    throw new Error(
      `Expected three operation calls, received ${retryCallCount}.`
    );
  }

  if (retryLogs.length !== retryConfig.maxAttempts - 1) {
    throw new Error(
      `Expected ${
        retryConfig.maxAttempts - 1
      } retry logs, received ${retryLogs.length}.`
    );
  }

  for (const log of retryLogs) {
    if (log.attempt < 1) {
      throw new Error(
        `Invalid retry attempt index: ${log.attempt}.`
      );
    }

    if (!Number.isInteger(log.delayMs)) {
      throw new Error(
        `Retry delay should be an integer. Received ${log.delayMs}.`
      );
    }

    if (
      log.delayMs < 0 ||
      log.delayMs > retryConfig.maxDelayMs
    ) {
      throw new Error(
        `Retry delay out of bounds. Attempt=${log.attempt}, Delay=${log.delayMs}`
      );
    }
  }

  printSuccess(
    `Retry execution with FullJitter passed (${retryLogs.length} retries).`
  );

  // ---------------------------------------------------------------------------
  // Scenario 3
  // Exhaust retries and propagate final error
  // ---------------------------------------------------------------------------

  printInfo("Scenario 3: Exhaust retries and propagate error");

  const failureConfig: RetryConfig = {
    maxAttempts: 2,
    baseDelayMs: 50,
    maxDelayMs: 200,
    strategy: "Linear",
  };

  const failureEngine = new RetryEngine(failureConfig);

  let failureCallCount = 0;

  try {
    await failureEngine.execute(async () => {
      failureCallCount += 1;
      throw new Error("Persistent Database Error");
    });

    throw new Error("RetryEngine should have thrown after max attempts.");
  } catch (error: unknown) {
    const finalError =
      error instanceof Error
        ? error
        : new Error(String(error));

    if (finalError.message !== "Persistent Database Error") {
      throw new Error(
        `Unexpected final error: ${finalError.message}`
      );
    }

    if (failureCallCount !== failureConfig.maxAttempts) {
      throw new Error(
        `Expected ${failureConfig.maxAttempts} failed attempts, received ${failureCallCount}.`
      );
    }

    printInfo(
      `Failure propagated correctly after ${failureCallCount} attempts.`
    );
  }

  printSuccess("Final error propagation after exhausted retries passed.");
}