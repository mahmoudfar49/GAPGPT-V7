// ============================================================
// FILE: src/types/ProviderTypes.v12.0.0.ts
// VERSION: v12.0.0
// COMMIT: 12 (Provider Foundation + MemoryProvider)
// STATUS: FROZEN 🟢
// ============================================================
export enum ProviderState {
  CREATED = 'CREATED',
  INITIALIZING = 'INITIALIZING',
  READY = 'READY',
  DISPOSED = 'DISPOSED',
}

export enum ProviderKind {
  MEMORY = 'memory',
  MARKET = 'market',
  CACHE = 'cache',
  LLM = 'llm',
}

export interface ProviderMetadata {
  readonly name: string;
  readonly version: string;
  readonly kind: ProviderKind;
  readonly capabilities: readonly string[];
}
