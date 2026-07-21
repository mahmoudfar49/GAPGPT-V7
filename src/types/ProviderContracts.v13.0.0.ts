// ============================================================
// FILE: src/types/ProviderContracts.v13.0.0.ts
// VERSION: v13.0.0
// COMMIT: 13 (Market Data Provider Foundation)
// STATUS: Draft 🟡
// CHANGELOG: Added IMarketDataProvider (standalone, no IProvider inheritance)
// ============================================================

import { MarketSymbol, OhlcvCandle, ProviderFetchOptions, ProviderHealthStatus } from './MarketDataTypes.js';

/**
 * Contract for Market Data Providers.
 * Standalone interface (no inheritance from IProvider) to maintain 
 * Layered Architecture purity. Implementations can still implement 
 * IProvider separately if needed.
 */
export interface IMarketDataProvider {
  /**
   * Fetches metadata for a specific symbol.
   */
  getSymbolInfo(symbol: string): Promise<MarketSymbol>;

  /**
   * Fetches OHLCV candle data based on options.
   * Implementations MUST handle normalization, caching, and rate limiting 
   * internally, returning standardized OhlcvCandle array.
   */
  getCandles(options: ProviderFetchOptions): Promise<OhlcvCandle[]>;

  /**
   * Optional: Check provider health status.
   */
  getHealthStatus?(): Promise<ProviderHealthStatus>;
}

// Re-export previous contracts for backward compatibility
export * from './ProviderContracts.v12.0.0.js';
