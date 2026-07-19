// ============================================================
// FILE: src/types/ProviderContracts.v10.0.0.ts
// VERSION: v10.0.0
// COMMIT: 10 (Service Layer Foundation)
// STATUS: Draft 🟡
// CHANGELOG:
//   v10.0.0 - Initial provider contracts (Interfaces only, no implementations)
// ============================================================

export interface IMarketProvider {
  lookupSymbol(symbol: string): Promise<any>;
  getQuote(symbol: string): Promise<any>;
  getCandles(symbol: string, timeframe: string): Promise<any>;
}

export interface IMemoryProvider {
  get(key: string): Promise<any>;
  put(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface ILLMProvider {
  generate(prompt: string): Promise<string>;
  embed(text: string): Promise<number[]>;
}

export interface ICacheProvider {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
}
