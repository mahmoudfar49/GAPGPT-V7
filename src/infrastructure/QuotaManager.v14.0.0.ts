// ============================================================
// FILE: src/infrastructure/QuotaManager.v14.0.0.ts
// VERSION: v14.0.0
// COMMIT: 14 (Market Data Foundation)
// STATUS: Draft 🟡
// ============================================================

export type ApiEndpointType = 
  | 'ALL_SYMBOLS'       // Limit: 100 / day
  | 'SYMBOL_INFO'       // Limit: 10 / day
  | 'HISTORY'           // Limit: 10 / day
  | 'CANDLESTICK_DAILY' // Limit: 10 / day
  | 'CANDLESTICK_INTRADAY' // Limit: 10 / day
  | 'TRANSACTION'       // Limit: 10 / day (Strictly On-Demand)
  | 'SHAREHOLDER'       // Limit: 10 / day (Strictly On-Demand)
  | 'INDEX'             // Limit: 100 / day
  | 'GOLD_CURRENCY';    // Limit: 1500 / day

export interface QuotaLimit {
  maxRequestsPerDay: number;
  currentRequests: number;
  lastResetDate: string; // YYYY-MM-DD
}

export class QuotaManager {
  private limits: Map<ApiEndpointType, QuotaLimit> = new Map();

  constructor() {
    this.initializeLimits();
  }

  private initializeLimits(): void {
    // FIX: Use substring(0, 10) to guarantee a strict string type and avoid undefined
    const today = new Date().toISOString().substring(0, 10);
    
    const defaultLimits: Record<ApiEndpointType, number> = {
      'ALL_SYMBOLS': 100,
      'SYMBOL_INFO': 10,
      'HISTORY': 10,
      'CANDLESTICK_DAILY': 10,
      'CANDLESTICK_INTRADAY': 10,
      'TRANSACTION': 10,
      'SHAREHOLDER': 10,
      'INDEX': 100,
      'GOLD_CURRENCY': 1500
    };

    for (const [type, max] of Object.entries(defaultLimits) as [ApiEndpointType, number][]) {
      this.limits.set(type, {
        maxRequestsPerDay: max,
        currentRequests: 0,
        lastResetDate: today
      });
    }
  }

  private checkAndResetDaily(type: ApiEndpointType): void {
    const limit = this.limits.get(type);
    if (!limit) return;

    const today = new Date().toISOString().substring(0, 10);
    if (limit.lastResetDate !== today) {
      limit.currentRequests = 0;
      limit.lastResetDate = today;
    }
  }

  public canMakeRequest(type: ApiEndpointType): boolean {
    this.checkAndResetDaily(type);
    const limit = this.limits.get(type);
    if (!limit) return false;

    // Hard block at 100% capacity (or 90% for warning)
    if (limit.currentRequests >= limit.maxRequestsPerDay) {
      console.error(`[QUOTA BLOCKED] ${type} limit reached (${limit.currentRequests}/${limit.maxRequestsPerDay}).`);
      return false;
    }
    
    if (limit.currentRequests >= limit.maxRequestsPerDay * 0.9) {
      console.warn(`[QUOTA WARNING] ${type} is at 90% capacity (${limit.currentRequests}/${limit.maxRequestsPerDay}).`);
    }

    return true;
  }

  public recordRequest(type: ApiEndpointType): void {
    if (this.canMakeRequest(type)) {
      const limit = this.limits.get(type);
      if (limit) {
        limit.currentRequests++;
      }
    } else {
      throw new Error(`Quota exceeded for ${type}. Request blocked to protect IP.`);
    }
  }

  public getRemainingRequests(type: ApiEndpointType): number {
    this.checkAndResetDaily(type);
    const limit = this.limits.get(type);
    return limit ? limit.maxRequestsPerDay - limit.currentRequests : 0;
  }
}
