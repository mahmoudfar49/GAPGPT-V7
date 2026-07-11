// ============================================================
// GAPGPT V7
// Main Entry
// Commit 4.1 Stable
// ============================================================

import { runRateLimiterTest } from "./test/rateLimiter.test.js";
import { runRetryEngineTest } from "./test/retryEngine.test.js";
import { runBackupManagerTest } from "./test/backupManager.test.js";

async function main(): Promise<void> {

  const args = process.argv.slice(2);

  //----------------------------------------------------------
  // Run Backup Test Only
  //----------------------------------------------------------

  if (args.includes("--backup")) {

    console.log();
    console.log("======================================");
    console.log("Running BackupManager Tests");
    console.log("======================================");
    console.log();

    await runBackupManagerTest();

    console.log();
    console.log("BackupManager completed successfully.");
    console.log();

    return;
  }

  //----------------------------------------------------------
  // Run All Tests
  //----------------------------------------------------------

  console.log();
  console.log("======================================");
  console.log("GAPGPT V7 - Commit 4 Test Suite");
  console.log("======================================");
  console.log();

  await runRateLimiterTest();

  console.log();

  await runRetryEngineTest();

  console.log();

  await runBackupManagerTest();

  console.log();

  console.log("======================================");
  console.log("All tests completed successfully.");
  console.log("======================================");
  console.log();
}

main().catch((error) => {

  console.error();
  console.error("======================================");
  console.error("Fatal Error");
  console.error("======================================");
  console.error(error);
  console.error();

  process.exit(1);

});