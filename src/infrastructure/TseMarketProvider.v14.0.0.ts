// ============================================================
// FILE: src/infrastructure/TseMarketProvider.v14.0.0.ts
// VERSION: v14.0.0
// COMMIT: 14 (Market Data Foundation)
// STATUS: Draft 🟡
// CHANGELOG: Full IMarketDataProvider implementation, QuotaManager integrated
// ============================================================

import { BaseProvider } from "../core/BaseProvider.js";
import { IMarketDataProvider, IMemoryProvider } from "../types/ProviderContracts.js";
import { 
  MarketSymbol, 
  TseDailyCandle, 
  CandleInterval,
  ProviderFetchOptions,
  ProviderHealthStatus
} from "../types/MarketDataTypes.js";
import { ProviderKind, ProviderState, ProviderMetadata } from "../types/ProviderTypes.js";
import { QuotaManager, ApiEndpointType } from "./QuotaManager.js";

export class TseMarketProvider extends BaseProvider implements IMarketDataProvider {
  public readonly metadata: ProviderMetadata = Object.freeze({
    name: "TseMarketProvider",
    version: "14.0.0",
    kind: ProviderKind.MARKET,
    capabilities: Object.freeze(["getSymbolInfo", "getCandles", "getHealthStatus"]),
  });

  private fetchCount = 0;

  constructor(
    private readonly cache: IMemoryProvider,
    private readonly quotaManager: QuotaManager
  ) {
    super();
  }

  protected async onInitialize(): Promise<void> {}
  protected async onDispose(): Promise<void> {}

  public async getSymbolInfo(symbol: string): Promise<MarketSymbol> {
    this.ensureState(ProviderState.READY, "getSymbolInfo");
    const cacheKey = `symbol_info:${symbol}`;
    
    const cached = await this.cache.get(cacheKey);
    if (cached !== undefined) return cached as MarketSymbol;

    const endpoint: ApiEndpointType = 'SYMBOL_INFO';
    if (!this.quotaManager.canMakeRequest(endpoint)) {
      throw new Error(`Quota exceeded for ${endpoint}.`);
    }

    const mockSymbol: MarketSymbol = {
      id: `TSETMC:${symbol}`,
      ticker: symbol,
      name: `شرکت ${symbol}`,
      market: 'TSETMC',
      currency: 'IRR',
      baseVolume: 1000000,
      eps: 500,
      peRatio: 5.5,
      isActive: true,
      lastUpdated: Date.now(),
    };

    await this.cache.put(cacheKey, mockSymbol);
    this.quotaManager.recordRequest(endpoint);
    return mockSymbol;
  }

  public async getCandles(options: ProviderFetchOptions): Promise<TseDailyCandle[]> {
    return this.getDailyCandles(options.symbol, options.interval, options.limit || 100);
  }

  public async getDailyCandles(symbol: string, interval: CandleInterval, limit: number = 100): Promise<TseDailyCandle[]> {
    this.ensureState(ProviderState.READY, "getDailyCandles");
    const cacheKey = `candles_daily:${symbol}:${interval}:${limit}`;
    
    const cached = await this.cache.get(cacheKey);
    if (cached !== undefined) return cached as TseDailyCandle[];

    const endpoint: ApiEndpointType = 'CANDLESTICK_DAILY';
    if (!this.quotaManager.canMakeRequest(endpoint)) {
      throw new Error(`Quota exceeded for ${endpoint}.`);
    }

    this.fetchCount++;
    const candles: TseDailyCandle[] = [];
    const now = Date.now();
    for (let i = 0; i < limit; i++) {
      candles.push({
        timestamp: now - i * 86400000,
        open: 30000 + i * 100,
        high: 31000 + i * 100,
        low: 29500 + i * 100,
        close: 30500 + i * 100,
        volume: 10000000,
        totalValue: 305000000000,
        tradeCount: 2000,
        isAdjusted: true,
      });
    }

    await this.cache.put(cacheKey, candles);
    this.quotaManager.recordRequest(endpoint);
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
}
