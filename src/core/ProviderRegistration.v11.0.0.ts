// ============================================================
// FILE: src/core/ProviderRegistration.v11.0.0.ts
// VERSION: v11.0.0
// COMMIT: 11 (DI Integration)
// STATUS: Draft 🟡
// CHANGELOG:
//   v11.0.0 - Helper functions for Provider registration:
//            - registerMarketProvider()
//            - registerMemoryProvider()
//            - registerLLMProvider()
//            - registerCacheProvider()
//            - NOTE: These helpers simplify bootstrap code
//            - NOTE: Actual provider implementations deferred to Commit 12+
// ============================================================

import { IServiceContainer, ServiceLifetime } from "../types/ServiceTypes.js";
import { 
  MarketProviderToken, 
  MemoryProviderToken, 
  LLMProviderToken, 
  CacheProviderToken 
} from "../types/ServiceTypes.js";
import { 
  IMarketProvider, 
  IMemoryProvider, 
  ILLMProvider, 
  ICacheProvider 
} from "../types/ProviderContracts.js";

/**
 * Helper function to register a Market Provider.
 * Simplifies bootstrap code and ensures type-safe registration.
 * 
 * @param container - The service container
 * @param provider - The market provider implementation
 * @param lifetime - Service lifetime (default: Singleton)
 */
export function registerMarketProvider(
  container: IServiceContainer,
  provider: IMarketProvider,
  lifetime: ServiceLifetime = ServiceLifetime.Singleton
): void {
  container.register(MarketProviderToken, () => provider, lifetime);
}

/**
 * Helper function to register a Memory Provider.
 * Simplifies bootstrap code and ensures type-safe registration.
 * 
 * @param container - The service container
 * @param provider - The memory provider implementation
 * @param lifetime - Service lifetime (default: Singleton)
 */
export function registerMemoryProvider(
  container: IServiceContainer,
  provider: IMemoryProvider,
  lifetime: ServiceLifetime = ServiceLifetime.Singleton
): void {
  container.register(MemoryProviderToken, () => provider, lifetime);
}

/**
 * Helper function to register an LLM Provider.
 * Simplifies bootstrap code and ensures type-safe registration.
 * 
 * @param container - The service container
 * @param provider - The LLM provider implementation
 * @param lifetime - Service lifetime (default: Singleton)
 */
export function registerLLMProvider(
  container: IServiceContainer,
  provider: ILLMProvider,
  lifetime: ServiceLifetime = ServiceLifetime.Singleton
): void {
  container.register(LLMProviderToken, () => provider, lifetime);
}

/**
 * Helper function to register a Cache Provider.
 * Simplifies bootstrap code and ensures type-safe registration.
 * 
 * @param container - The service container
 * @param provider - The cache provider implementation
 * @param lifetime - Service lifetime (default: Singleton)
 */
export function registerCacheProvider(
  container: IServiceContainer,
  provider: ICacheProvider,
  lifetime: ServiceLifetime = ServiceLifetime.Singleton
): void {
  container.register(CacheProviderToken, () => provider, lifetime);
}
