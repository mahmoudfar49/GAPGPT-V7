// ============================================================
// FILE: src/test/ProviderIntegration.v12.0.0.test.ts
// VERSION: v12.0.0
// COMMIT: 12 (Provider Foundation + MemoryProvider)
// STATUS: FROZEN 🟢
// ============================================================
import { ServiceContainer } from "../core/ServiceContainer.js";
import { ServiceLifetime, MemoryProviderToken } from "../types/ServiceTypes.js";
import { MemoryProvider } from "../infrastructure/MemoryProvider.js";
import { ProviderState } from "../types/ProviderTypes.js";
import { registerMemoryProvider } from "../core/ProviderRegistration.js";

export async function runProviderIntegrationTest(): Promise<void> {
  console.log("🚀 Starting Provider Integration Tests (Commit 12)...");
  let passed = 0, failed = 0;
  
  const assert = (cond: boolean, msg: string) => { 
    if(cond) { console.log(`  ✅ ${msg}`); passed++; } 
    else { console.error(`  ❌ ${msg}`); failed++; } 
  };
  
  const assertThrows = async (fn: () => any, msg: string) => { 
    try { await fn(); console.error(`  ❌ ${msg}`); failed++; } 
    catch { console.log(`  ✅ ${msg}`); passed++; } 
  };

  try {
    const provider = new MemoryProvider();
    assert(provider.getState() === ProviderState.CREATED, "Initial state is CREATED");
    assert(provider.isReady() === false, "isReady() is false before init");

    await assertThrows(async () => await provider.get("k"), "get() before initialize throws");
    
    await provider.initialize();
    assert(provider.isReady() === true, "isReady() is true after init");
    
    await provider.put("key1", "value1");
    assert(await provider.get("key1") === "value1", "put and get work correctly");
    assert(await provider.get("missing") === undefined, "get missing key returns undefined");
    
    await provider.delete("key1");
    assert(await provider.get("key1") === undefined, "delete removes key");
    
    await provider.put("k2", "v2");
    await provider.clear();
    assert(await provider.get("k2") === undefined, "clear removes all");

    await provider.dispose();
    assert(provider.getState() === ProviderState.DISPOSED, "State is DISPOSED");
    await assertThrows(async () => await provider.put("k", "v"), "put after dispose throws");

    // DI Integration
    const container = new ServiceContainer();
    const memProv = new MemoryProvider();
    await memProv.initialize();
    registerMemoryProvider(container, memProv, ServiceLifetime.Singleton);
    
    const resolved = container.resolve(MemoryProviderToken);
    assert(resolved === memProv, "Resolves correct instance");
    assert(container.resolve(MemoryProviderToken) === resolved, "Singleton behavior verified");

  } catch (e) { 
    console.error("  ❌ Fatal test error:", e); 
    failed++; 
  }

  console.log(`\n======================================`);
  console.log(`Integration Tests: ${passed} Passed, ${failed} Failed`);
  console.log(`======================================\n`);
  
  if (failed > 0) throw new Error("Provider Integration tests failed!");
}
