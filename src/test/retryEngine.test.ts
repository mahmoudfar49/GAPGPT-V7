// ============================================================
// GAPGPT V7
// RetryEngine Tests
// Commit 4.1 Stable
// ============================================================

import { RetryEngine } from "../infrastructure/RetryEngine.js";
import { SecurityConfig } from "../config/SecurityConfig.js";

import {
  ok,
  write,
  printSection,
  printSuccess,
} from "./helpers/testUtils.js";

export async function runRetryEngineTest(): Promise<void> {

  printSection("RetryEngine");

  const retry = new RetryEngine(
    SecurityConfig.retry,
  );

  //-------------------------------------------------------
  // Test 1
  // Success on first attempt
  //-------------------------------------------------------

  write("Success on first attempt...");

  let counter = 0;

  const result1 = await retry.execute(async () => {

    counter++;

    return 12345;

  });

  ok(
    result1 === 12345,
    "Returned expected value",
  );

  ok(
    counter === 1,
    "Executed only once",
  );

  //-------------------------------------------------------
  // Test 2
  // Fail twice then succeed
  //-------------------------------------------------------

  write("Retry until success...");

  let attempts = 0;

  const result2 = await retry.execute(async () => {

    attempts++;

    if (attempts < 3) {

      throw new Error("temporary");

    }

    return "SUCCESS";

  });

  ok(
    result2 === "SUCCESS",
    "Recovered after retries",
  );

  ok(
    attempts === 3,
    "Retried expected number of times",
  );

  //-------------------------------------------------------
  // Test 3
  // Exhaust retries
  //-------------------------------------------------------

  write("Exhaust retry attempts...");

  let failed = false;

  try {

    await retry.execute(async () => {

      throw new Error("always fail");

    });

  }

  catch {

    failed = true;

  }

  ok(
    failed,
    "Throws after max attempts",
  );

  //-------------------------------------------------------
  // Configuration Checks
  //-------------------------------------------------------

  ok(

    SecurityConfig.retry.maxAttempts > 0,

    "maxAttempts configured",

  );

  ok(

    SecurityConfig.retry.baseDelayMs >= 0,

    "baseDelay configured",

  );

  ok(

    SecurityConfig.retry.maxDelayMs >=
    SecurityConfig.retry.baseDelayMs,

    "maxDelay configured",

  );

  ok(

    [
      "fixed",
      "linear",
      "exponential",
    ].includes(
      SecurityConfig.retry.strategy,
    ),

    "strategy configured",

  );

  printSuccess(
    "RetryEngine tests passed.",
  );

}