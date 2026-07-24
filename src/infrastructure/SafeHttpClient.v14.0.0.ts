// ============================================================
// FILE: src/infrastructure/SafeHttpClient.v14.0.0.ts
// VERSION: v14.0.0
// COMMIT: 14 (Market Data Foundation)
// STATUS: Draft 🟡
// ============================================================

import { QuotaManager, ApiEndpointType } from './QuotaManager.js';

export interface HttpClientConfig {
  userAgent: string;
  timeoutMs: number;
  maxRetries: number;
  dryRun: boolean; // CRITICAL: Default must be true
}

export const SAFE_HTTP_CLIENT_CONFIG: HttpClientConfig = {
  // Safe, standard Chrome User-Agent to bypass BrsApi firewall
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  timeoutMs: 15000, // 15 seconds
  maxRetries: 2,    // Max 2 retries to avoid spamming
  dryRun: true      // DEFAULT: TRUE. Prevents real API calls until explicitly disabled.
};

export class SafeHttpClient {
  constructor(
    private readonly quotaManager: QuotaManager,
    private readonly config: HttpClientConfig = SAFE_HTTP_CLIENT_CONFIG
  ) {}

  public async get<T>(url: string, endpointType: ApiEndpointType): Promise<T> {
    // 1. Check Quota
    if (!this.quotaManager.canMakeRequest(endpointType)) {
      throw new Error(`Request blocked: Quota exceeded for ${endpointType}`);
    }

    // 2. Dry Run Mode (Safety First)
    if (this.config.dryRun) {
      console.log(`[DRY RUN] SafeHttpClient blocked real request to: ${url}`);
      console.log(`[DRY RUN] To enable real requests, set config.dryRun = false explicitly.`);
      // Return a mock empty object casted to T for type safety in dry run
      return {} as T; 
    }

    // 3. Execute with Retry
    return this.executeWithRetry<T>(url, endpointType);
  }

  private async executeWithRetry<T>(url: string, endpointType: ApiEndpointType): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': this.config.userAgent,
            'Accept': 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }

        // Record success only on successful response
        this.quotaManager.recordRequest(endpointType);
        return await response.json() as T;

      } catch (error) {
        lastError = error as Error;
        console.warn(`[SafeHttpClient] Attempt ${attempt + 1} failed for ${url}:`, lastError.message);
        
        if (attempt < this.config.maxRetries) {
          // Exponential backoff: 1s, 2s
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`SafeHttpClient failed after ${this.config.maxRetries + 1} attempts. Last error: ${lastError?.message}`);
  }

  public setDryRun(enabled: boolean): void {
    this.config.dryRun = enabled;
    console.log(`[SafeHttpClient] Dry Run mode is now: ${enabled ? 'ENABLED (Safe)' : 'DISABLED (Live)'}`);
  }
}
