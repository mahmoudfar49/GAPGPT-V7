// ============================================================
// FILE: src/infrastructure/TseMarketProvider.v13.0.0.ts
// VERSION: v13.0.0
// COMMIT: 13 (Market Data Provider Foundation)
// STATUS: FROZEN 🟢 (Updated for v14 Type Compatibility)
// ============================================================

import { BaseProvider } from "../core/BaseProvider.js";
import { IMarketDataProvider, IMemoryProvider } from "../types/ProviderContracts.js";
import { 
  MarketSymbol, 
  TseDailyCandle, 
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

  private fetchCount = 0;

  constructor(private readonly cache: IMemoryProvider) {
    super();
  }

  protected async onInitialize(): Promise<void> {}
  protected async onDispose(): Promise<void> {}

  public async getSymbolInfo(symbol: string): Promise<MarketSymbol> {
    this.ensureState(ProviderState.READY, "getSymbolInfo");
    
    return {
      id: `TSE:${symbol}`,
      ticker: symbol,
      name: `Mock ${symbol} Company`,
      market: 'TSE',
      currency: 'IRR',
      isActive: true,
      lastUpdated: Date.now(), // FIX: Added for v14 compatibility
    };
  }

  public async getCandles(options: ProviderFetchOptions): Promise<TseDailyCandle[]> {
    this.ensureState(ProviderState.READY, "getCandles");

    const cacheKey = `candles:${options.symbol}:${options.interval}`;
    const useCache = options.useCache !== false;

    if (useCache) {
      const cached = await this.cache.get(cacheKey);
      if (cached !== undefined) {
        return cached as TseDailyCandle[];
      }
    }

    this.fetchCount++;
    const candles = this.generateMockCandles(options);

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

  public getFetchCount(): number {
    return this.fetchCount;
  }

  private generateMockCandles(options: ProviderFetchOptions): TseDailyCandle[] {
    const candles: TseDailyCandle[] = [];
    const now = Date.now();
    const limit = options.limit || 10;
    
    for (let i = 0; i < limit; i++) {
      candles.push({
        timestamp: now - i * 60000,
        open: 100 + Math.random() * 10,
        high: 105 + Math.random() * 10,
        low: 95 + Math.random() * 10,
        close: 102 + Math.random() * 10,
        volume: 500000 + Math.random() * 100000,
        totalValue: 0,        // FIX: Added for v14 TseDailyCandle compatibility
        tradeCount: 0,        // FIX: Added for v14 TseDailyCandle compatibility
        isAdjusted: true,     // FIX: Added for v14 TseDailyCandle compatibility
      });
    }

    return candles;
  }
}
