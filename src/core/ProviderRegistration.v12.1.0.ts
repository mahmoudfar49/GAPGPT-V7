// ============================================================
// FILE: src/core/ProviderRegistration.v12.1.0.ts
// VERSION: v12.1.0
// COMMIT: 12 (Provider Foundation + MemoryProvider)
// STATUS: FROZEN 🟢
// NOTE: Stateless, thin helper for DI registration with strict type safety.
// ============================================================
import { IServiceContainer, ServiceLifetime } from "../types/ServiceTypes.js";
import { IMarketProvider, IMemoryProvider, ILLMProvider, ICacheProvider } from "../types/ProviderContracts.js";
import { MarketProviderToken, MemoryProviderToken, LLMProviderToken, CacheProviderToken } from "../types/ServiceTypes.js";

export function registerMarketProvider(container: IServiceContainer, provider: IMarketProvider, lifetime: ServiceLifetime = ServiceLifetime.Singleton): void {
  container.register(MarketProviderToken, () => provider, lifetime);
}

export function registerMemoryProvider(container: IServiceContainer, provider: IMemoryProvider, lifetime: ServiceLifetime = ServiceLifetime.Singleton): void {
  container.register(MemoryProviderToken, () => provider, lifetime);
}

export function registerLLMProvider(container: IServiceContainer, provider: ILLMProvider, lifetime: ServiceLifetime = ServiceLifetime.Singleton): void {
  container.register(LLMProviderToken, () => provider, lifetime);
}

export function registerCacheProvider(container: IServiceContainer, provider: ICacheProvider, lifetime: ServiceLifetime = ServiceLifetime.Singleton): void {
  container.register(CacheProviderToken, () => provider, lifetime);
}
