// ============================================================
// FILE: src/test/MarketDataProvider.v14.0.0.test.ts
// VERSION: v14.0.0
// COMMIT: 14 (Market Data Foundation)
// STATUS: Draft 🟡
// ============================================================

import { MemoryProvider } from "../infrastructure/MemoryProvider.js";
import { TseMarketProvider } from "../infrastructure/TseMarketProvider.js";
import { QuotaManager } from "../infrastructure/QuotaManager.js";
import { ServiceContainer } from "../core/ServiceContainer.js";
import { registerMemoryProvider, registerMarketDataProvider } from "../core/ProviderRegistration.js";
import { MarketDataProviderToken, ServiceLifetime } from "../types/ServiceTypes.js";
import { ProviderState } from "../types/ProviderTypes.js";
import { ProviderFetchOptions } from "../types/MarketDataTypes.js";

export async function runMarketDataProviderTest(): Promise<void> {
  console.log("🚀 Starting Market Data Provider Integration Tests (Commit 14)...");
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
    const memoryProvider = new MemoryProvider();
    await memoryProvider.initialize();
    
    const quotaManager = new QuotaManager();
    const tseProvider = new TseMarketProvider(memoryProvider, quotaManager);
    
    await assertThrows(
      async () => await tseProvider.getSymbolInfo("فولاد"),
      "getSymbolInfo before initialize throws"
    );
    
    await tseProvider.initialize();
    assert(tseProvider.isReady() === true, "TseMarketProvider is ready after initialize");
    
    const symbolInfo = await tseProvider.getSymbolInfo("فولاد");
    assert(symbolInfo.id === "TSETMC:فولاد", "Symbol ID is correct");
    assert(symbolInfo.market === "TSETMC", "Symbol market is TSETMC");
    
    const options: ProviderFetchOptions = { symbol: "فولاد", interval: "1d", limit: 5 };
    const candles = await tseProvider.getCandles(options);
    assert(candles.length === 5, "getCandles returns correct number of candles");
    
    // Safe access to first candle (due to noUncheckedIndexedAccess)
    const firstCandle = candles[0];
    assert(firstCandle !== undefined, "First candle exists");
    if (firstCandle) {
      assert(firstCandle.isAdjusted === true, "Candles are marked as adjusted");
    }
    
    const fetchCountBefore = tseProvider.getFetchCount();
    await tseProvider.getCandles(options);
    const fetchCountAfter = tseProvider.getFetchCount();
    assert(fetchCountAfter === fetchCountBefore, "Second call uses cache (fetch count unchanged)");
    
    const health = await tseProvider.getHealthStatus();
    assert(health.isHealthy === true, "Provider is healthy");
    
    const container = new ServiceContainer();
    registerMemoryProvider(container, memoryProvider, ServiceLifetime.Singleton);
    registerMarketDataProvider(container, tseProvider, ServiceLifetime.Singleton);
    
    const resolvedProvider = container.resolve(MarketDataProviderToken);
    assert(resolvedProvider === tseProvider, "DI resolves correct provider instance");
    
    await tseProvider.dispose();
    assert(tseProvider.getState() === ProviderState.DISPOSED, "Provider state is DISPOSED");
    await memoryProvider.dispose();

  } catch (e) { 
    console.error("  ❌ Fatal test error:", e); 
    failed++; 
  }

  console.log(`\n======================================`);
  console.log(`Market Data Provider Tests (v14): ${passed} Passed, ${failed} Failed`);
  console.log(`======================================\n`);
  
  if (failed > 0) throw new Error("Market Data Provider tests failed!");
}
