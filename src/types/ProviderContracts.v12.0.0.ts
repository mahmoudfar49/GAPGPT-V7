// ============================================================
// FILE: src/types/ProviderContracts.v12.0.0.ts
// VERSION: v12.0.0
// COMMIT: 12 (Provider Foundation + MemoryProvider)
// STATUS: FROZEN 🟢
// CHANGELOG: Evolution from v10.0.0: Replaced 'any' with 'unknown' for strict type safety.
// ============================================================

export interface IMarketProvider {
  lookupSymbol(symbol: string): Promise<unknown>;
  getQuote(symbol: string): Promise<unknown>;
  getCandles(symbol: string, timeframe: string): Promise<unknown>;
}

export interface IMemoryProvider {
  get(key: string): Promise<unknown | undefined>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface ILLMProvider {
  generate(prompt: string): Promise<string>;
  embed(text: string): Promise<number[]>;
}

export interface ICacheProvider {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, value: unknown, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
}
