// ============================================================
// FILE: src/test/MarketDataProvider.v13.0.0.test.ts
// VERSION: v13.0.0
// COMMIT: 13 (Market Data Provider Foundation)
// STATUS: Draft 🟡
// CHANGELOG: Integration tests for TseMarketProvider with Cache-Aside
// ============================================================

import { MemoryProvider } from "../infrastructure/MemoryProvider.js";
import { TseMarketProvider } from "../infrastructure/TseMarketProvider.js";
import { ServiceContainer } from "../core/ServiceContainer.js";
import { registerMemoryProvider, registerMarketDataProvider } from "../core/ProviderRegistration.js";
import { MarketDataProviderToken, ServiceLifetime } from "../types/ServiceTypes.js";
import { ProviderState } from "../types/ProviderTypes.js";
import { ProviderFetchOptions } from "../types/MarketDataTypes.js";

export async function runMarketDataProviderTest(): Promise<void> {
  console.log("🚀 Starting Market Data Provider Integration Tests (Commit 13)...");
  let passed = 0, failed = 0;
  
  const assert = (cond: boolean, msg: string) => { 
    if(cond) { console.log(`  ✅ ${msg}`); passed++; } 
    else { console.error(`  ❌ ${msg}`); failed++; } 
  };
  
  const assertThrows = async (fn: () => Promise<unknown>, msg: string) => { 
    try { await fn(); console.error(`  ❌ ${msg}`); failed++; } 
    catch { console.log(`  ✅ ${msg}`); passed++; } 
  };

  try {
    // Setup: Create and initialize MemoryProvider
    const memoryProvider = new MemoryProvider();
    await memoryProvider.initialize();
    
    // Create TseMarketProvider with cache
    const tseProvider = new TseMarketProvider(memoryProvider);
    
    // Test 1: State Machine - should throw before initialize
    await assertThrows(
      async () => await tseProvider.getSymbolInfo("فولاد"),
      "getSymbolInfo before initialize throws"
    );
    
    // Initialize TseMarketProvider
    await tseProvider.initialize();
    assert(tseProvider.isReady() === true, "TseMarketProvider is ready after initialize");
    
    // Test 2: getSymbolInfo returns correct data
    const symbolInfo = await tseProvider.getSymbolInfo("فولاد");
    assert(symbolInfo.id === "TSE:فولاد", "Symbol ID is correct");
    assert(symbolInfo.ticker === "فولاد", "Symbol ticker is correct");
    assert(symbolInfo.market === "TSE", "Symbol market is TSE");
    assert(symbolInfo.currency === "IRR", "Symbol currency is IRR");
    assert(symbolInfo.isActive === true, "Symbol is active");
    
    // Test 3: getCandles returns data with UTC timestamps
    const options: ProviderFetchOptions = {
      symbol: "فولاد",
      interval: "1d",
      limit: 5
    };
    const candles = await tseProvider.getCandles(options);
    assert(candles.length === 5, "getCandles returns correct number of candles");
    
    // Safe access to first candle (due to noUncheckedIndexedAccess)
    const firstCandle = candles[0];
    assert(firstCandle !== undefined, "First candle exists");
    if (firstCandle) {
      assert(typeof firstCandle.timestamp === "number", "Timestamp is a number (UTC Epoch ms)");
      assert(firstCandle.timestamp > 0, "Timestamp is positive");
      assert(typeof firstCandle.open === "number", "Open price is a number");
      assert(typeof firstCandle.volume === "number", "Volume is a number");
    }
    
    // Test 4: Cache-Aside - second call should use cache
    const fetchCountBefore = tseProvider.getFetchCount();
    const cachedCandles = await tseProvider.getCandles(options);
    const fetchCountAfter = tseProvider.getFetchCount();
    assert(fetchCountAfter === fetchCountBefore, "Second call uses cache (fetch count unchanged)");
    assert(cachedCandles.length === 5, "Cached candles have correct length");
    
    // Test 5: useCache=false bypasses cache
    const fetchCountBeforeBypass = tseProvider.getFetchCount();
    await tseProvider.getCandles({ ...options, useCache: false });
    const fetchCountAfterBypass = tseProvider.getFetchCount();
    assert(fetchCountAfterBypass === fetchCountBeforeBypass + 1, "useCache=false bypasses cache");
    
    // Test 6: getHealthStatus returns correct data
    const health = await tseProvider.getHealthStatus();
    assert(health.isHealthy === true, "Provider is healthy");
    assert(typeof health.latencyMs === "number", "Latency is a number");
    assert(typeof health.lastCheckedAt === "number", "lastCheckedAt is a number");
    
    // Test 7: DI Integration
    const container = new ServiceContainer();
    registerMemoryProvider(container, memoryProvider, ServiceLifetime.Singleton);
    registerMarketDataProvider(container, tseProvider, ServiceLifetime.Singleton);
    
    const resolvedProvider = container.resolve(MarketDataProviderToken);
    assert(resolvedProvider === tseProvider, "DI resolves correct provider instance");
    
    // Cleanup
    await tseProvider.dispose();
    assert(tseProvider.getState() === ProviderState.DISPOSED, "Provider state is DISPOSED");
    await memoryProvider.dispose();

  } catch (e) { 
    console.error("  ❌ Fatal test error:", e); 
    failed++; 
  }

  console.log(`\n======================================`);
  console.log(`Market Data Provider Tests: ${passed} Passed, ${failed} Failed`);
  console.log(`======================================\n`);
  
  if (failed > 0) throw new Error("Market Data Provider tests failed!");
}
