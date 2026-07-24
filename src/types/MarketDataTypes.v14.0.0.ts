// ============================================================
// FILE: src/types/MarketDataTypes.v14.0.0.ts
// VERSION: v14.0.0
// COMMIT: 14 (Market Data Foundation)
// STATUS: Draft 🟡
// ============================================================

export type MarketType = 'TSETMC' | 'TSE' | 'GOLD' | 'CURRENCY' | 'CRYPTO';
export type CurrencyUnit = 'IRR' | 'IRT' | 'USD';
export type CandleInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export const DEFAULT_CANDLE_TTL_MS: Record<CandleInterval, number> = {
  '1m': 60 * 1000, '5m': 5 * 60 * 1000, '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000, '4h': 4 * 60 * 60 * 1000, '1d': 24 * 60 * 60 * 1000
};

// --- 1. Market Symbol (اطلاعات جامع نماد) ---
export interface MarketSymbol {
  id: string; ticker: string; name: string;
  market: MarketType; currency: CurrencyUnit;
  baseVolume?: number; eps?: number | null; peRatio?: number | null;
  isActive: boolean; lastUpdated: number;
}

// --- 2. Market Snapshot (اسنپ‌شات روزانه/لحظه‌ای) ---
export interface MarketSnapshot {
  symbol: string; lastPrice: number; changePercent: number;
  totalVolume: number; totalValue: number; tradeCount: number;
  timestamp: number; // UTC Epoch ms
}

// --- 3 & 4. Candles (تعدیل‌شده روزانه و لحظه‌ای) ---
export interface TseDailyCandle {
  timestamp: number; open: number; high: number; low: number; close: number;
  volume: number; totalValue: number; tradeCount: number;
  isAdjusted: true;
}

export interface TseIntradayCandle {
  timestamp: number; open: number; high: number; low: number; close: number;
  volume: number; tradeCount: number;
  isAdjusted: false;
}

// --- 5. Transaction (ریز معاملات) ---
export interface MarketTransaction {
  timestamp: number; price: number; volume: number;
  isIndividualBuyer: boolean; isIndividualSeller: boolean;
  tradeType: 'NORMAL' | 'BLOCK' | 'BULK' | 'UNKNOWN';
}

// --- 6. Index (شاخص) ---
export interface MarketIndex {
  id: string; name: string; value: number;
  change: number; changePercent: number; timestamp: number;
}

// --- 7. Shareholder (سهامداران) ---
export interface MarketShareholder {
  shareholderName: string; shareCount: number; percentage: number;
  changeInShares: number; timestamp: number; isLegal: boolean;
}

// --- 8 & 9. Gold/Currency/Crypto (لحظه‌ای و تاریخچه) ---
export interface GoldCurrencyAsset {
  symbol: string; name: string; nameEn: string;
  price: number; changeValue: number; changePercent: number;
  unit: string; timestamp: number; iconUrl?: string;
}

export interface GoldCurrencyHistoryCandle {
  symbol: string; timestamp: number;
  open: number; high: number; low: number; close: number;
}

// ============================================================
// BACKWARD COMPATIBILITY ALIASES (For Commit 13 Code)
// ============================================================
export type OhlcvCandle = TseDailyCandle;

export interface ProviderFetchOptions {
  symbol: string;
  interval: CandleInterval;
  from?: number;
  to?: number;
  limit?: number;
  useCache?: boolean;
}

export interface ProviderHealthStatus {
  isHealthy: boolean;
  latencyMs: number;
  lastCheckedAt: number;
  errorMessage?: string;
}
