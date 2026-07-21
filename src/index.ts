// ============================================================
// GAPGPT V7
// Main Entry
// Commit 12 Stable (Focused on Provider Integration)
// ============================================================
import { runProviderIntegrationTest } from "./test/ProviderIntegration.v12.0.0.test.js";

async function main(): Promise<void> {
  console.log("\n======================================");
  console.log("GAPGPT V7 - Provider Integration Test (Commit 12)");
  console.log("======================================\n");

  await runProviderIntegrationTest();

  console.log("\n======================================");
  console.log("Test completed successfully.");
  console.log("======================================\n");
}

main().catch((error) => {
  console.error("\n======================================");
  console.error("Fatal Error");
  console.error("======================================");
  console.error(error);
  console.error("\n");
  process.exit(1);
});
