// ============================================================
// FILE: src/types/ServiceTypes.v12.0.0.ts
// VERSION: v12.0.0
// COMMIT: 12 (Provider Foundation + MemoryProvider)
// STATUS: FROZEN 🟢
// CHANGELOG: Strongly-typed Provider Tokens (Safe import from v10.1.0)
// ============================================================
import { ServiceToken } from './ServiceTypes.v10.1.0.js';
import { IMarketProvider, IMemoryProvider, ILLMProvider, ICacheProvider } from './ProviderContracts.js';

// Re-export everything from v10.1.0 (which includes v10.0.0)
export * from './ServiceTypes.v10.1.0.js';

// New strictly-typed tokens for Commit 12
export const MarketProviderToken = new ServiceToken<IMarketProvider>('MarketProvider');
export const MemoryProviderToken = new ServiceToken<IMemoryProvider>('MemoryProvider');
export const LLMProviderToken = new ServiceToken<ILLMProvider>('LLMProvider');
export const CacheProviderToken = new ServiceToken<ICacheProvider>('CacheProvider');
