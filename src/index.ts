import { runRateLimiterTest } from "./test/rateLimiter.test.js";
import { runRetryEngineTest } from "./test/retryEngine.test.js";

type AsyncTest = () => Promise<void>;

async function main(): Promise<void> {
  const startedAt = Date.now();

  console.log("========== GAPGPT V7 Test Runner ==========");
  console.log(`Started : ${new Date(startedAt).toISOString()}`);

  const testSuite: ReadonlyArray<AsyncTest> = [
    runRateLimiterTest,
    runRetryEngineTest,
  ];

  for (const test of testSuite) {
    await test();
  }

  const finishedAt = Date.now();

  console.log("\n=============== ALL TESTS PASSED ===============");
  console.log(`Finished : ${new Date(finishedAt).toISOString()}`);
  console.log(`Execution completed in ${finishedAt - startedAt}ms`);
}

main().catch((error: unknown) => {
  const finalError =
    error instanceof Error
      ? error
      : new Error(String(error));

  console.error("\n❌ Test execution failed:");
  console.error(finalError.stack ?? finalError.message);

  process.exit(1);
});