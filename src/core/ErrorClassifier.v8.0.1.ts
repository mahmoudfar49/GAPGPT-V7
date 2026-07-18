// ============================================================
// FILE: src/core/ErrorClassifier.v8.0.1.ts
// VERSION: v8.0.1
// COMMIT: 8 (Smart Retry Classification - Refactored)
// STATUS: Draft 🟡
// CHANGELOG:
//   v8.0.1 - Refinements based on review findings:
//            - Strengthened isToolExecutionError guard (validates category & descriptor consistency)
//            - Fixed order: isRateLimit checked BEFORE isTimeout (prevents misclassification)
//            - Narrowed isNetwork heuristics (removed broad substrings like "connection"/"socket")
//            - Added string support in extractRetryAfterMs (parses "1200", "5", etc.)
//            - Injected IExecutionClock (no more direct Date.now() usage)
//            - Added strictValidation option for extra safety
//   v8.0.0 - Initial release
// ============================================================

import {
  IErrorClassifier,
  ErrorCategory,
  ErrorDescriptor,
  ToolExecutionError,
  ExecutionContext,
  IExecutionClock,
  ErrorClassifierConfig,
} from "../types/ToolTypes.js";

// ============================================================
// Default Error Descriptors
// ============================================================

const DEFAULT_DESCRIPTORS: Readonly<Record<ErrorCategory, ErrorDescriptor>> = Object.freeze({
  TRANSIENT: Object.freeze({ category: "TRANSIENT", retryable: true, severity: "low", logLevel: "warn" }),
  TIMEOUT: Object.freeze({ category: "TIMEOUT", retryable: true, severity: "medium", logLevel: "warn" }),
  RATE_LIMIT: Object.freeze({ category: "RATE_LIMIT", retryable: true, severity: "medium", logLevel: "warn" }),
  NETWORK: Object.freeze({ category: "NETWORK", retryable: true, severity: "high", logLevel: "error" }),
  VALIDATION: Object.freeze({ category: "VALIDATION", retryable: false, severity: "low", logLevel: "warn" }),
  AUTH: Object.freeze({ category: "AUTH", retryable: false, severity: "high", logLevel: "error" }),
  NOT_FOUND: Object.freeze({ category: "NOT_FOUND", retryable: false, severity: "low", logLevel: "info" }),
  CONFLICT: Object.freeze({ category: "CONFLICT", retryable: false, severity: "medium", logLevel: "warn" }),
  UNKNOWN: Object.freeze({ category: "UNKNOWN", retryable: false, severity: "critical", logLevel: "error" }),
});

// ============================================================
// Valid Error Categories Set (for validation)
// ============================================================

const VALID_CATEGORIES: ReadonlySet<ErrorCategory> = new Set<ErrorCategory>([
  "TRANSIENT", "TIMEOUT", "RATE_LIMIT", "NETWORK",
  "VALIDATION", "AUTH", "NOT_FOUND", "CONFLICT", "UNKNOWN",
]);

// ============================================================
// Network Error Codes (specific, not broad substrings)
// ============================================================

const NETWORK_ERROR_CODES = new Set([
  "ECONNRESET",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "EPIPE",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EAI_FAMILY",
  "EAI_NODATA",
  "EAI_NONAME",
]);

// ============================================================
// System Clock (default implementation)
// ============================================================

class SystemClock implements IExecutionClock {
  public now(): number {
    return Date.now();
  }
}

// ============================================================
// Error Classifier Implementation
// ============================================================

export class ErrorClassifier implements IErrorClassifier {
  private readonly clock: IExecutionClock;
  private readonly strictValidation: boolean;

  constructor(config: ErrorClassifierConfig = {}) {
    this.clock = config.clock ?? new SystemClock();
    this.strictValidation = config.strictValidation ?? false;
  }

  // ========================================================
  // Public Methods
  // ========================================================

  public classify(error: unknown, context: ExecutionContext): ToolExecutionError {
    // If error is already a valid ToolExecutionError, return as-is (with validation)
    if (this.isValidToolExecutionError(error)) {
      return error as ToolExecutionError;
    }

    const category = this.detectCategory(error);
    const descriptor = this.getDescriptor(category);

    return Object.freeze({
      name: this.extractName(error),
      message: this.extractMessage(error),
      code: this.extractCode(error),
      category,
      descriptor,
      recoverable: descriptor.retryable,
      retryAfterMs: this.extractRetryAfterMs(error),
      cause: error,
      details: this.extractDetails(error),
      timestamp: this.clock.now(),
    });
  }

  public getDescriptor(category: ErrorCategory): ErrorDescriptor {
    return DEFAULT_DESCRIPTORS[category];
  }

  // ========================================================
  // Private: Validation (STRENGTHENED in v8.0.1)
  // ========================================================

  private isValidToolExecutionError(error: unknown): boolean {
    if (typeof error !== "object" || error === null) {
      return false;
    }

    const obj = error as Record<string, unknown>;

    // Check required fields exist
    if (!("category" in obj) || !("descriptor" in obj) || !("recoverable" in obj)) {
      return false;
    }

    // Validate category is a valid ErrorCategory
    const category = obj.category;
    if (typeof category !== "string" || !VALID_CATEGORIES.has(category as ErrorCategory)) {
      return false;
    }

    // Validate descriptor is an object with required fields
    const descriptor = obj.descriptor;
    if (typeof descriptor !== "object" || descriptor === null) {
      return false;
    }

    const desc = descriptor as Record<string, unknown>;
    if (
      desc.category !== category ||  // descriptor.category must match error.category
      typeof desc.retryable !== "boolean" ||
      typeof desc.severity !== "string" ||
      typeof desc.logLevel !== "string"
    ) {
      return false;
    }

    // In strict mode, also validate name/message/timestamp
    if (this.strictValidation) {
      if (typeof obj.name !== "string" || typeof obj.message !== "string") {
        return false;
      }
      if (typeof obj.timestamp !== "number") {
        return false;
      }
    }

    return true;
  }

  // ========================================================
  // Private: Category Detection
  // ORDER MATTERS: Rate limit checked BEFORE timeout
  // because rate limit messages may contain "timed out"
  // ========================================================

  private detectCategory(error: unknown): ErrorCategory {
    // 1. Rate limit FIRST (before timeout)
    if (this.isRateLimitError(error)) return "RATE_LIMIT";

    // 2. Timeout
    if (this.isTimeoutError(error)) return "TIMEOUT";

    // 3. Network (specific codes only, no broad substrings)
    if (this.isNetworkError(error)) return "NETWORK";

    // 4. Validation
    if (this.isValidationError(error)) return "VALIDATION";

    // 5. Auth
    if (this.isAuthError(error)) return "AUTH";

    // 6. Not Found
    if (this.isNotFoundError(error)) return "NOT_FOUND";

    // 7. Conflict
    if (this.isConflictError(error)) return "CONFLICT";

    // 8. Default
    return "UNKNOWN";
  }

  private isRateLimitError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const message = error.message.toLowerCase();
    const code = (error as any).code;
    const status = (error as any).status || (error as any).statusCode;
    return (
      message.includes("rate limit") ||
      message.includes("too many requests") ||
      message.includes("throttl") ||
      code === 429 ||
      code === "RATE_LIMIT" ||
      status === 429
    );
  }

  private isTimeoutError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const name = error.name.toLowerCase();
    const message = error.message.toLowerCase();
    const code = (error as any).code;
    return (
      name === "aborterror" ||
      name === "timeouterror" ||
      message.includes("timeout") ||
      message.includes("timed out") ||
      code === "ETIMEDOUT" ||
      code === "TIMEOUT"
    );
  }

  private isNetworkError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    // Only match specific network error codes (NOT broad substrings)
    const code = (error as any).code;
    if (typeof code === "string" && NETWORK_ERROR_CODES.has(code)) {
      return true;
    }
    // Also match specific network-related messages (but not broad ones)
    const message = error.message.toLowerCase();
    return (
      message.includes("network error") ||
      message.includes("fetch failed") ||
      message.includes("socket hang up") ||
      message.includes("dns lookup failed")
    );
  }

  private isValidationError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const name = error.name.toLowerCase();
    const message = error.message.toLowerCase();
    return (
      name.includes("validation") ||
      name === "typeerror" ||
      name === "rangeerror" ||
      message.includes("validation failed") ||
      message.includes("invalid input") ||
      message.includes("invalid parameter") ||
      message.includes("required field") ||
      message.includes("schema violation")
    );
  }

  private isAuthError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const name = error.name.toLowerCase();
    const message = error.message.toLowerCase();
    const code = (error as any).code;
    const status = (error as any).status || (error as any).statusCode;
    return (
      name.includes("auth") ||
      name.includes("permission") ||
      message.includes("unauthorized") ||
      message.includes("forbidden") ||
      message.includes("permission denied") ||
      message.includes("access denied") ||
      code === 401 ||
      code === 403 ||
      status === 401 ||
      status === 403
    );
  }

  private isNotFoundError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const name = error.name.toLowerCase();
    const message = error.message.toLowerCase();
    const code = (error as any).code;
    const status = (error as any).status || (error as any).statusCode;
    return (
      name === "notfounderror" ||
      message.includes("not found") ||
      message.includes("does not exist") ||
      message.includes("no such") ||
      code === 404 ||
      status === 404
    );
  }

  private isConflictError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const name = error.name.toLowerCase();
    const message = error.message.toLowerCase();
    const code = (error as any).code;
    const status = (error as any).status || (error as any).statusCode;
    return (
      name.includes("conflict") ||
      message.includes("conflict") ||
      message.includes("already exists") ||
      message.includes("duplicate") ||
      code === 409 ||
      status === 409
    );
  }

  // ========================================================
  // Private: Field Extraction
  // ========================================================

  private extractName(error: unknown): string {
    if (error instanceof Error) return error.name;
    return "UnknownError";
  }

  private extractMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return String(error);
  }

  private extractCode(error: unknown): string | undefined {
    if (error instanceof Error) {
      const code = (error as any).code;
      if (typeof code === "string" || typeof code === "number") {
        return String(code);
      }
    }
    return undefined;
  }

  // ========================================================
  // extractRetryAfterMs - ENHANCED in v8.0.1
  // Now supports string values like "1200", "5", etc.
  // ========================================================

  private extractRetryAfterMs(error: unknown): number | undefined {
    if (!(error instanceof Error)) return undefined;

    const err = error as any;
    const candidates = [
      err.retryAfterMs,
      err.retryAfter,
      err.retry_after,
      err.retryAfterSeconds,
    ];

    for (const value of candidates) {
      if (value === undefined || value === null) continue;

      // If number, use directly
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        // Heuristic: if value < 1000, assume seconds; otherwise ms
        // But we prefer explicit naming
        return value;
      }

      // If string, try to parse
      if (typeof value === "string") {
        const parsed = Number(value);
        if (!Number.isNaN(parsed) && Number.isFinite(parsed) && parsed >= 0) {
          return parsed;
        }
      }
    }

    return undefined;
  }

  private extractDetails(error: unknown): unknown {
    if (error instanceof Error) return error.stack;
    return error;
  }
}
