// ============================================================
// FILE: src/types/ProviderErrors.v13.0.0.ts
// VERSION: v13.0.0
// COMMIT: 13 (Market Data Provider Foundation)
// STATUS: Draft 🟡
// ============================================================

export class ProviderNetworkError extends Error {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = 'ProviderNetworkError';
  }
}

export class ProviderRateLimitError extends Error {
  constructor(message: string, public readonly retryAfterMs?: number) {
    super(message);
    this.name = 'ProviderRateLimitError';
  }
}

export class DataParsingError extends Error {
  constructor(message: string, public readonly rawData?: unknown) {
    super(message);
    this.name = 'DataParsingError';
  }
}
