// ============================================================
// GAPGPT V7
// Security Configuration - Production Stable & Fixed
// Commit 4.1 Stable
// ============================================================

export type BackoffStrategy = "exponential" | "linear" | "fixed";
export type BackupMode = "manual" | "scheduled" | "triggered";

export interface BackupDestination {
  readonly id: string;
  readonly path: string;
  readonly enabled: boolean;
}

export interface BackupConfig {
  readonly enabled: boolean;
  readonly rootDirectory: string;
  readonly compressionFormat: "zip";
  readonly destinations: readonly BackupDestination[];
  readonly retention: {
    readonly maxBackups: number;
  };
}

export interface SecurityConfigSchema {
  readonly rateLimit: {
    readonly maxRequests: number;
    readonly intervalMs: number;
    readonly parallelism: number;
    readonly waitIntervalMs: number;
    readonly timeoutMs: number;
  };
  readonly retry: {
    readonly maxAttempts: number;
    readonly baseDelayMs: number;
    readonly maxDelayMs: number;
    readonly strategy: BackoffStrategy;
  };
  readonly backup: BackupConfig;
}

export const SecurityConfig: SecurityConfigSchema = Object.freeze({
  rateLimit: {
    maxRequests: 100,
    intervalMs: 60000,
    parallelism: 5,
    waitIntervalMs: 1000,
    timeoutMs: 30000,
  },
  retry: {
    maxAttempts: 5,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    strategy: "exponential" as BackoffStrategy, // ✅ Fix: Explicit type casting
  },
  backup: {
    enabled: true,
    rootDirectory: "./backups",
    compressionFormat: "zip" as "zip", // ✅ Fix: Cast to literal "zip" to prevent generic string assignment error
    destinations: [
      { id: "local-main", path: "./backups/main", enabled: true },
      { id: "local-remote", path: "./backups/remote", enabled: false }
    ],
    retention: {
      maxBackups: 10,
    },
  },
});

// ✅ Fix: Exporting legacy type alias for compatibility with old components/tests
export type RetryConfig = SecurityConfigSchema["retry"];