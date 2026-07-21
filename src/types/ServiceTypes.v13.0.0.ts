// ============================================================
// FILE: src/types/ServiceTypes.v13.0.0.ts
// VERSION: v13.0.0
// COMMIT: 13 (Market Data Provider Foundation)
// STATUS: Draft 🟡
// CHANGELOG: Added strongly-typed MarketDataProviderToken
// ============================================================
import { ServiceToken } from './ServiceTypes.v10.1.0.js';
import { IMarketDataProvider } from './ProviderContracts.js';

// Re-export everything from v12.0.0 (which includes v10/v11)
export * from './ServiceTypes.v12.0.0.js';

// New strictly-typed token for Commit 13
export const MarketDataProviderToken = new ServiceToken<IMarketDataProvider>('MarketDataProvider');
