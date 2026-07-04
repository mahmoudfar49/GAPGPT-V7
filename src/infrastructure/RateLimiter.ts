import { SecurityConfig } from '../config/SecurityConfig.js';

export class RateLimiter {
    private tokens: number;
    private lastRefill: number;
    private readonly capacity: number;
    private readonly refillRate: number;

    constructor() {
        this.capacity = SecurityConfig.rateLimit.parallelism;
        this.tokens = this.capacity;
        this.lastRefill = this.now();
        this.refillRate = SecurityConfig.rateLimit.maxRequests / SecurityConfig.rateLimit.intervalMs;
    }

    private now(): number {
        return Date.now();
    }

    private refill(): void {
        const now = this.now();
        const elapsed = now - this.lastRefill;
        const tokensToAdd = elapsed * this.refillRate;

        if (tokensToAdd > 0) {
            this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
            this.lastRefill = now;
        }
    }

    public consume(): boolean {
        this.refill();

        if (this.tokens >= 1) {
            this.tokens -= 1;
            return true;
        }

        return false;
    }

    public async waitForToken(): Promise<void> {
        const startTime = this.now();

        while (!this.consume()) {
            if (this.now() - startTime > SecurityConfig.rateLimit.timeoutMs) {
                throw new Error('RateLimiter: Token acquisition timeout exceeded.');
            }

            await new Promise(resolve =>
                setTimeout(resolve, SecurityConfig.rateLimit.waitIntervalMs)
            );
        }
    }

    public getAvailableTokens(): number {
        this.refill();
        return Math.floor(this.tokens);
    }
}
