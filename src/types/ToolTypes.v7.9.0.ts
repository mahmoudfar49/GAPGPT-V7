// ============================================================
// FILE: src/types/ToolTypes.v7.9.0.ts
// VERSION: v7.9.0
// COMMIT: 8 (Smart Retry Classification - Refactored)
// STATUS: Draft 🟡
// CHANGELOG:
//   v7.9.0 - Contract refinements based on review findings:
//            - Added executionPhase to ExecutionContext (initial/retry/final)
//            - Added isLastAttempt to ExecutionContext
//            - Added ErrorClassifierConfig for classifier settings
//            - Added IExecutionClock parameter to IErrorClassifier
//            - All new fields are OPTIONAL for backward compatibility
//   v7.8.0 - Initial Smart Retry Classification contracts
// ============================================================

import type { ITool, Context } from "./RuntimeTypes.js";

// ============================================================
// Tool Categories
// ============================================================

export type ToolCategory = 
  | "data" 
  | "computation" 
  | "io" 
  | "ai" 
  | "utility"
  | "market"
  | "analysis";

// ============================================================
// Error Categories
// ============================================================

export type ErrorCategory =
  | "TRANSIENT"
  | "TIMEOUT"
  | "RATE_LIMIT"
  | "NETWORK"
  | "VALIDATION"
  | "AUTH"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNKNOWN";

// ============================================================
// Log Levels
// ============================================================

export type LogLevel = "debug" | "info" | "warn" | "error";

// ============================================================
// Error Severity
// ============================================================

export type ErrorSeverity = "low" | "medium" | "high" | "critical";

// ============================================================
// Retry Decision
// ============================================================

export type RetryDecision = "retry" | "fail" | "abort";

// ============================================================
// Execution Phase (NEW in v7.9.0)
// ============================================================

export type ExecutionPhase = "initial" | "retry" | "final";

// ============================================================
// Error Descriptor
// ============================================================

export interface ErrorDescriptor {
  readonly category: ErrorCategory;
  readonly retryable: boolean;
  readonly severity: ErrorSeverity;
  readonly logLevel: LogLevel;
  readonly retryAfterMs?: number;
  readonly code?: string;
}

// ============================================================
// Tool Execution Error
// ============================================================

export interface ToolExecutionError {
  readonly name: string;
  readonly message: string;
  readonly code?: string;
  readonly category: ErrorCategory;
  readonly descriptor: ErrorDescriptor;
  readonly recoverable: boolean;
  readonly retryAfterMs?: number;
  readonly cause?: unknown;
  readonly details?: unknown;
  readonly timestamp: number;
}

// ============================================================
// Execution Context (UPGRADED in v7.9.0)
// ============================================================

export interface ExecutionContext {
  readonly executionId: string;
  readonly taskId: string;
  readonly attempt: number;
  readonly elapsedTimeMs: number;
  readonly toolName: string;
  readonly timeoutMs?: number;
  readonly executionPhase?: ExecutionPhase;  // NEW in v7.9.0
  readonly isLastAttempt?: boolean;          // NEW in v7.9.0
  readonly metadata?: Readonly<Record<string, unknown>>;
}

// ============================================================
// Execution Clock
// ============================================================

export interface IExecutionClock {
  now(): number;
}

// ============================================================
// Error Classifier Config (NEW in v7.9.0)
// ============================================================

export interface ErrorClassifierConfig {
  readonly clock?: IExecutionClock;
  readonly strictValidation?: boolean;  // If true, validate ToolExecutionError shape strictly
}

// ============================================================
// Error Classifier Interface (UPGRADED in v7.9.0)
// ============================================================

export interface IErrorClassifier {
  classify(error: unknown, context: ExecutionContext): ToolExecutionError;
  getDescriptor(category: ErrorCategory): ErrorDescriptor;
}

// ============================================================
// Backoff Strategy Interface
// ============================================================

export interface IBackoffStrategy {
  getDelayMs(context: ExecutionContext, error: ToolExecutionError): number;
}

// ============================================================
// Retry Policy Config
// ============================================================

export interface RetryPolicyConfig {
  readonly maxRetries: number;
  readonly baseDelayMs: number;
  readonly backoffMultiplier: number;
  readonly maxDelayMs: number;
  readonly jitter: boolean;
  readonly retryableCategories: readonly ErrorCategory[];
  readonly respectRetryAfterMs?: boolean;  // NEW in v7.9.0: if true, don't cap retryAfterMs
}

// ============================================================
// Retry Policy Interface
// ============================================================

export interface IRetryPolicy {
  resolvePolicy(
    defaultPolicy: RetryPolicyConfig,
    toolPolicy?: Partial<RetryPolicyConfig>
  ): RetryPolicyConfig;
  
  shouldRetry(
    error: ToolExecutionError,
    context: ExecutionContext,
    policy: RetryPolicyConfig,
    metadata?: ToolMetadata
  ): RetryDecision;
  
  getBackoffStrategy(): IBackoffStrategy;
  
  calculateDelay(
    error: ToolExecutionError,
    context: ExecutionContext,
    policy: RetryPolicyConfig
  ): number;
}

// ============================================================
// Retry Record
// ============================================================

export interface RetryRecord {
  readonly attempt: number;
  readonly delayMs: number;
  readonly reason: string;
  readonly timestamp: string;
}

// ============================================================
// Tool Metadata
// ============================================================

export interface ToolMetadata {
  readonly version: string;
  readonly author?: string;
  readonly tags?: readonly string[];
  readonly category?: ToolCategory;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly idempotent?: boolean;
  readonly retryPolicy?: Partial<RetryPolicyConfig>;
}

// ============================================================
// Tool Capability
// ============================================================

export interface ToolCapability {
  readonly name: string;
  readonly description: string;
  readonly inputSchema?: unknown;
  readonly outputSchema?: unknown;
}

// ============================================================
// Tool Permission
// ============================================================

export interface ToolPermission {
  readonly toolName: string;
  readonly allowedRoles: readonly string[];
  readonly requiresAuth: boolean;
}

// ============================================================
// Tool Error (Legacy)
// ============================================================

export interface ToolError {
  readonly code: string;
  readonly message: string;
  readonly recoverable: boolean;
  readonly details?: unknown;
  readonly timestamp: number;
}

// ============================================================
// Tool Result
// ============================================================

export interface ToolResult<T = unknown> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: ToolError;
  readonly durationMs: number;
  readonly attempts?: number;
  readonly startedAt?: string;
  readonly finishedAt?: string;
  readonly retryHistory?: readonly RetryRecord[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

// ============================================================
// Tool Executor Hook
// ============================================================

export interface IToolExecutorHook {
  readonly name: string;
  beforeExecute?(context: ExecutionContext, input: unknown): Promise<void>;
  afterExecute?(context: ExecutionContext, result: ToolResult): Promise<void>;
}

// ============================================================
// Tool Registry Interface
// ============================================================

export interface IToolRegistry {
  register(tool: ITool): void;
  unregister(toolName: string): boolean;
  find(toolName: string): ITool | undefined;
  has(toolName: string): boolean;
  list(): readonly ITool[];
  resolve(taskKind: string): readonly ITool[];
  getByCategory(category: ToolCategory): readonly ITool[];
  getMetadata(toolName: string): ToolMetadata | undefined;
  setMetadata(toolName: string, metadata: ToolMetadata): void;
}

// ============================================================
// Tool Executor Config
// ============================================================

export interface ToolExecutorConfig {
  readonly defaultTimeoutMs: number;
  readonly maxRetries: number;
  readonly retryDelayMs: number;
  readonly retryPolicy?: RetryPolicyConfig;
}

// ============================================================
// Tool Executor Interface
// ============================================================

export interface IToolExecutor {
  execute<TInput = unknown, TOutput = unknown>(
    tool: ITool<TInput, TOutput>,
    input: TInput,
    context: Context,
  ): Promise<ToolResult<TOutput>>;

  executeWithTimeout<TInput = unknown, TOutput = unknown>(
    tool: ITool<TInput, TOutput>,
    input: TInput,
    context: Context,
    timeoutMs: number,
  ): Promise<ToolResult<TOutput>>;

  executeWithRetry<TInput = unknown, TOutput = unknown>(
    tool: ITool<TInput, TOutput>,
    input: TInput,
    context: Context,
    maxRetries?: number,
  ): Promise<ToolResult<TOutput>>;
}

// ============================================================
// Tool Pipeline Interface
// ============================================================

export interface IToolPipeline {
  addTool(tool: ITool): IToolPipeline;
  execute(input: unknown, context: Context): Promise<ToolResult>;
  getTools(): readonly ITool[];
  clear(): void;
}

// ============================================================
// Re-export ITool
// ============================================================

export type { ITool };
