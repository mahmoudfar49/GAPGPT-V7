import type { ITool, Context } from "./RuntimeTypes.js";

export type ToolCategory = "data" | "computation" | "io" | "ai" | "utility" | "market" | "analysis";

export type ErrorCategory =
  | "TRANSIENT"
  | "TIMEOUT"
  | "RATE_LIMIT"
  | "NETWORK"
  | "VALIDATION"
  | "AUTH"
  | "NOT_FOUND"
  | "CONFLICT"
  | "ABORT"
  | "UNKNOWN";

export type ExecutionState =
  | "QUEUED"
  | "STARTING"
  | "RUNNING"
  | "RETRYING"
  | "CANCELLING"
  | "CANCELLED"
  | "COMPLETED"
  | "FAILED";

export const VALID_STATE_TRANSITIONS: Readonly<Record<ExecutionState, readonly ExecutionState[]>> = Object.freeze({
  QUEUED: Object.freeze(["STARTING", "CANCELLED"] as const),
  STARTING: Object.freeze(["RUNNING", "CANCELLING", "FAILED"] as const),
  RUNNING: Object.freeze(["RETRYING", "COMPLETED", "FAILED", "CANCELLING"] as const),
  RETRYING: Object.freeze(["RUNNING", "CANCELLING", "FAILED"] as const),
  CANCELLING: Object.freeze(["CANCELLED"] as const),
  CANCELLED: Object.freeze([] as const),
  COMPLETED: Object.freeze([] as const),
  FAILED: Object.freeze([] as const),
});

export interface ExecutionStateWithReason {
  readonly state: ExecutionState;
  readonly reason?: ErrorCategory | "UserAbort" | "Success";
}

export type LogLevel = "debug" | "info" | "warn" | "error";
export type ErrorSeverity = "low" | "medium" | "high" | "critical";
export type RetryDecision = "retry" | "fail" | "abort";
export type ExecutionPhase = "initial" | "retry" | "final";

export interface ErrorDescriptor {
  readonly category: ErrorCategory;
  readonly retryable: boolean;
  readonly severity: ErrorSeverity;
  readonly logLevel: LogLevel;
  readonly retryAfterMs?: number;
  readonly code?: string;
}

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

export interface TimingMetrics {
  readonly queuedDuration: number;
  readonly runningDuration: number;
  readonly retryDelayDuration: number;
  readonly totalDuration: number;
}

export interface ExecutionMetrics {
  readonly timing: TimingMetrics;
}

export interface ExecutionSnapshot {
  readonly executionId: string;
  readonly taskId: string;
  readonly toolName: string;
  readonly state: ExecutionState;
  readonly stateReason?: ErrorCategory | "UserAbort" | "Success";
  readonly attempt: number;
  readonly startedAt: string;
  readonly finishedAt?: string;
  readonly metrics: ExecutionMetrics;
  readonly retryHistory: readonly RetryRecord[];
  readonly lastError?: ToolExecutionError;
}

export interface ExecutionContext {
  readonly executionId: string;
  readonly taskId: string;
  readonly toolName: string;
  readonly attempt: number;
  readonly signal?: AbortSignal;
  readonly snapshot?: ExecutionSnapshot;
  readonly metrics?: ExecutionMetrics;
  readonly timeoutMs?: number;
  readonly elapsedTimeMs?: number;
  readonly executionPhase?: ExecutionPhase;
  readonly isLastAttempt?: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface IExecutionClock {
  now(): number;
}

export interface ErrorClassifierConfig {
  readonly clock?: IExecutionClock;
  readonly strictValidation?: boolean;
}

export interface IErrorClassifier {
  classify(error: unknown, context: ExecutionContext): ToolExecutionError;
  getDescriptor(category: ErrorCategory): ErrorDescriptor;
}

export interface IBackoffStrategy {
  getDelayMs(context: ExecutionContext, error: ToolExecutionError): number;
}

export interface IExecutionPolicy {
  readonly name: string;
  readonly type: "retry" | "timeout" | "cancellation" | "priority" | "concurrency";
}

export interface RetryPolicyConfig {
  readonly maxRetries: number;
  readonly baseDelayMs: number;
  readonly backoffMultiplier: number;
  readonly maxDelayMs: number;
  readonly jitter: boolean;
  readonly retryableCategories: readonly ErrorCategory[];
  readonly respectRetryAfterMs?: boolean;
}

export interface IRetryPolicy extends IExecutionPolicy {
  readonly type: "retry";
  resolvePolicy(defaultPolicy: RetryPolicyConfig, toolPolicy?: Partial<RetryPolicyConfig>): RetryPolicyConfig;
  shouldRetry(error: ToolExecutionError, context: ExecutionContext, policy: RetryPolicyConfig, metadata?: ToolMetadata): RetryDecision;
  getBackoffStrategy(): IBackoffStrategy;
  calculateDelay(error: ToolExecutionError, context: ExecutionContext, policy: RetryPolicyConfig): number;
}

export interface RetryRecord {
  readonly attempt: number;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly durationMs: number;
  readonly category: ErrorCategory;
  readonly decision: RetryDecision;
  readonly delayMs: number;
  readonly errorCode?: string;
  readonly errorMessage?: string;
}

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

export interface ToolCapability {
  readonly name: string;
  readonly description: string;
  readonly inputSchema?: unknown;
  readonly outputSchema?: unknown;
}

export interface ToolPermission {
  readonly toolName: string;
  readonly allowedRoles: readonly string[];
  readonly requiresAuth: boolean;
}

export interface ToolError {
  readonly code: string;
  readonly message: string;
  readonly recoverable: boolean;
  readonly details?: unknown;
  readonly timestamp: number;
}

export interface ToolResult<T = unknown> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: ToolError;
  readonly durationMs: number;
  readonly attempts?: number;
  readonly startedAt?: string;
  readonly finishedAt?: string;
  readonly retryHistory?: readonly RetryRecord[];
  readonly isAborted?: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface IExecutionObserver {
  readonly name: string;
  beforeExecute?(context: ExecutionContext, input: unknown): Promise<void>;
  afterExecute?(context: ExecutionContext, result: ToolResult): Promise<void>;
  beforeRetry?(context: ExecutionContext, error: ToolExecutionError): Promise<void>;
  afterRetry?(context: ExecutionContext, result: ToolResult): Promise<void>;
  onFailure?(context: ExecutionContext, error: ToolExecutionError): Promise<void>;
  onTimeout?(context: ExecutionContext, timeoutMs: number): Promise<void>;
  onCancel?(context: ExecutionContext): Promise<void>;
}

export type IToolExecutorHook = IExecutionObserver;

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

export interface ToolExecutorConfig {
  readonly defaultTimeoutMs: number;
  readonly maxRetries: number;
  readonly retryDelayMs: number;
  readonly retryPolicy?: RetryPolicyConfig;
}

export interface IToolExecutor {
  execute<TInput = unknown, TOutput = unknown>(tool: ITool<TInput, TOutput>, input: TInput, context: Context, signal?: AbortSignal): Promise<ToolResult<TOutput>>;
  executeWithTimeout<TInput = unknown, TOutput = unknown>(tool: ITool<TInput, TOutput>, input: TInput, context: Context, timeoutMs: number, signal?: AbortSignal): Promise<ToolResult<TOutput>>;
  executeWithRetry<TInput = unknown, TOutput = unknown>(tool: ITool<TInput, TOutput>, input: TInput, context: Context, maxRetries?: number, signal?: AbortSignal): Promise<ToolResult<TOutput>>;
}

export interface IToolPipeline {
  addTool(tool: ITool): IToolPipeline;
  execute(input: unknown, context: Context): Promise<ToolResult>;
  getTools(): readonly ITool[];
  clear(): void;
}

export type { ITool };
