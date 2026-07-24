// ============================================================
// GAPGPT V7
// Main Entry Point
// Commit 14 Stable (Market Data Foundation)
// ============================================================
import { runMarketDataProviderTest } from "./test/MarketDataProvider.v14.0.0.test.js";

async function main(): Promise<void> {
  console.log("\n======================================");
  console.log("GAPGPT V7 - Market Data Foundation Test (Commit 14)");
  console.log("======================================\n");

  await runMarketDataProviderTest();

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
