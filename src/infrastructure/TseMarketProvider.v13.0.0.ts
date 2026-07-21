// ============================================================
// FILE: src/infrastructure/TseMarketProvider.v13.0.0.ts
// VERSION: v13.0.0
// COMMIT: 13 (Market Data Provider Foundation)
// STATUS: Draft 🟡
// CHANGELOG: First market data provider with Cache-Aside pattern
// ============================================================

import { BaseProvider } from "../core/BaseProvider.js";
import { IMarketDataProvider, IMemoryProvider } from "../types/ProviderContracts.js";
import { 
  MarketSymbol, 
  OhlcvCandle, 
  ProviderFetchOptions, 
  ProviderHealthStatus
} from "../types/MarketDataTypes.js";
import { ProviderKind, ProviderState, ProviderMetadata } from "../types/ProviderTypes.js";

export class TseMarketProvider extends BaseProvider implements IMarketDataProvider {
  public readonly metadata: ProviderMetadata = Object.freeze({
    name: "TseMarketProvider",
    version: "13.0.0",
    kind: ProviderKind.MARKET,
    capabilities: Object.freeze(["getSymbolInfo", "getCandles", "getHealthStatus"]),
  });

  private fetchCount = 0; // For testing cache effectiveness

  constructor(private readonly cache: IMemoryProvider) {
    super();
  }

  protected async onInitialize(): Promise<void> {
    // No-op for mock provider
  }

  protected async onDispose(): Promise<void> {
    // No-op for mock provider
  }

  public async getSymbolInfo(symbol: string): Promise<MarketSymbol> {
    this.ensureState(ProviderState.READY, "getSymbolInfo");
    
    // Mock implementation
    return {
      id: `TSE:${symbol}`,
      ticker: symbol,
      name: `Mock ${symbol} Company`,
      market: 'TSE',
      currency: 'IRR',
      isActive: true,
    };
  }

  public async getCandles(options: ProviderFetchOptions): Promise<OhlcvCandle[]> {
    this.ensureState(ProviderState.READY, "getCandles");

    const cacheKey = `candles:${options.symbol}:${options.interval}`;
    const useCache = options.useCache !== false; // Default: true

    // 1. Check cache first (Cache-Aside pattern)
    if (useCache) {
      const cached = await this.cache.get(cacheKey);
      if (cached !== undefined) {
        return cached as OhlcvCandle[];
      }
    }

    // 2. Cache miss: Fetch data (Mock implementation)
    this.fetchCount++;
    const candles = this.generateMockCandles(options);

    // 3. Store in cache
    // NOTE: TTL-based expiration will be added when MemoryProvider supports it natively.
    // For now, we use simple cache-aside pattern.
    if (useCache) {
      await this.cache.put(cacheKey, candles);
    }

    return candles;
  }

  public async getHealthStatus(): Promise<ProviderHealthStatus> {
    this.ensureState(ProviderState.READY, "getHealthStatus");
    
    return {
      isHealthy: true,
      latencyMs: 50,
      lastCheckedAt: Date.now(),
    };
  }

  /**
   * Get fetch count (for testing cache effectiveness)
   */
  public getFetchCount(): number {
    return this.fetchCount;
  }

  /**
   * Generate mock OHLCV candles with UTC timestamps
   */
  private generateMockCandles(options: ProviderFetchOptions): OhlcvCandle[] {
    const candles: OhlcvCandle[] = [];
    const now = Date.now();
    const limit = options.limit || 10;
    
    for (let i = 0; i < limit; i++) {
      candles.push({
        timestamp: now - i * 60000, // UTC Epoch ms
        open: 100 + Math.random() * 10,
        high: 105 + Math.random() * 10,
        low: 95 + Math.random() * 10,
        close: 102 + Math.random() * 10,
        volume: 500000 + Math.random() * 100000,
      });
    }

    return candles;
  }
}
