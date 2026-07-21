// ============================================================
// FILE: src/types/MarketDataTypes.v13.0.0.ts
// VERSION: v13.0.0
// COMMIT: 13 (Market Data Provider Foundation)
// STATUS: Draft 🟡
// ============================================================

export type CandleInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export const DEFAULT_CANDLE_TTL_MS: Record<CandleInterval, number> = {
  '1m': 60 * 1000,          // 1 minute
  '5m': 5 * 60 * 1000,      // 5 minutes
  '15m': 15 * 60 * 1000,    // 15 minutes
  '1h': 60 * 60 * 1000,     // 1 hour
  '4h': 4 * 60 * 60 * 1000, // 4 hours
  '1d': 24 * 60 * 60 * 1000 // 24 hours (baseline for daily)
};

export interface MarketSymbol {
  id: string;          // e.g., "TSE:IRO1FOOL0001"
  ticker: string;      // e.g., "فولاد"
  name: string;        // e.g., "فولاد مبارکه اصفهان"
  market: 'TSE' | 'CRYPTO' | 'FOREX';
  currency: 'IRR' | 'IRT' | 'USD';
  isActive: boolean;
}

export interface OhlcvCandle {
  timestamp: number;   // UTC Epoch in milliseconds (ALWAYS)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ProviderFetchOptions {
  symbol: string;
  interval: CandleInterval;
  from?: number;       // UTC Epoch ms
  to?: number;         // UTC Epoch ms
  limit?: number;
  useCache?: boolean;  // Default: true
}

export interface ProviderHealthStatus {
  isHealthy: boolean;
  latencyMs: number;
  lastCheckedAt: number; // UTC Epoch ms
  errorMessage?: string;
}
