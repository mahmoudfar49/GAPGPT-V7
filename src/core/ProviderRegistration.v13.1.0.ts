// ============================================================
// FILE: src/core/ProviderRegistration.v13.1.0.ts
// VERSION: v13.1.0
// COMMIT: 13 (Market Data Provider Foundation)
// STATUS: Draft 🟡
// CHANGELOG: Added registerMarketDataProvider helper
// ============================================================

import { IServiceContainer, ServiceLifetime } from "../types/ServiceTypes.js";
import { IMarketDataProvider } from "../types/ProviderContracts.js";
import { MarketDataProviderToken } from "../types/ServiceTypes.js";

// Re-export all previous registration helpers
export * from "./ProviderRegistration.v12.1.0.js";

/**
 * Register a MarketDataProvider in the DI container.
 */
export function registerMarketDataProvider(
  container: IServiceContainer,
  provider: IMarketDataProvider,
  lifetime: ServiceLifetime = ServiceLifetime.Singleton
): void {
  container.register(MarketDataProviderToken, () => provider, lifetime);
}
