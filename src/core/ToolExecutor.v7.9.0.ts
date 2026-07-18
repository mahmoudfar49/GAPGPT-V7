// ============================================================
// FILE: src/core/ToolExecutor.v7.9.0.ts
// VERSION: v7.9.0
// COMMIT: 8 (Smart Retry Classification - Refactored)
// STATUS: Draft 🟡
// CHANGELOG:
//   v7.9.0 - Major refactor based on review findings:
//            - ADDED: executeAttempt() as unified core method
//            - FIXED: executeWithRetry() now enforces timeout per attempt
//            - FIXED: clearTimeout in finally block (prevents timer leak)
//            - FIXED: ExecutionContext now consistent across hooks/retry
//            - FIXED: effectiveMaxRetries derived from resolved policy
//            - FIXED: classifyErrorFromResult preserves error details
//            - FIXED: Hook isolation with try/catch
//            - FIXED: Deep freeze for metadata
//            - ADDED: Backward compatibility for finalDecision (deprecated)
//            - ADDED: executionPhase (initial/retry/final) in ExecutionContext
//   v7.8.0 - Initial Smart Retry orchestrator
//   v7.7.0 - Initial safe tool execution
// ============================================================

import { ITool, Context } from "../types/RuntimeTypes.js";
import {
  IToolExecutor,
  ToolResult,
  ToolError,
  ToolExecutorConfig,
  ToolExecutionError,
  ExecutionContext,
  IErrorClassifier,
  IRetryPolicy,
  IExecutionClock,
  IToolExecutorHook,
  ToolMetadata,
  RetryRecord,
  ExecutionPhase,
  RetryDecision,
} from "../types/ToolTypes.js";
import { ErrorClassifier } from "./ErrorClassifier.js";
import { DefaultRetryPolicy, DEFAULT_RETRY_POLICY_CONFIG } from "./RetryPolicy.js";

class SystemClock implements IExecutionClock {
  public now(): number {
    return Date.now();
  }
}

export const DEFAULT_TOOL_EXECUTOR_CONFIG: ToolExecutorConfig = Object.freeze({
  defaultTimeoutMs: 30000,
  maxRetries: 3,
  retryDelayMs: 1000,
  retryPolicy: DEFAULT_RETRY_POLICY_CONFIG,
});

export class ToolExecutor implements IToolExecutor {
  private readonly config: ToolExecutorConfig;
  private readonly errorClassifier: IErrorClassifier;
  private readonly retryPolicy: IRetryPolicy;
  private readonly clock: IExecutionClock;
  private readonly hooks: readonly IToolExecutorHook[];
  private readonly toolMetadata: Map<string, ToolMetadata>;
  private executionCounter: number;

  constructor(
    config: Partial<ToolExecutorConfig> = {},
    errorClassifier?: IErrorClassifier,
    retryPolicy?: IRetryPolicy,
    clock?: IExecutionClock,
    hooks: readonly IToolExecutorHook[] = []
  ) {
    this.config = Object.freeze({
      ...DEFAULT_TOOL_EXECUTOR_CONFIG,
      ...config,
      retryPolicy: config.retryPolicy
        ? Object.freeze({ ...DEFAULT_RETRY_POLICY_CONFIG, ...config.retryPolicy })
        : DEFAULT_RETRY_POLICY_CONFIG,
    });
    this.errorClassifier = errorClassifier ?? new ErrorClassifier();
    this.retryPolicy = retryPolicy ?? new DefaultRetryPolicy();
    this.clock = clock ?? new SystemClock();
    this.hooks = Object.freeze([...hooks]);
    this.toolMetadata = new Map();
    this.executionCounter = 0;
  }

  public registerToolMetadata(toolName: string, metadata: ToolMetadata): void {
    const frozenMetadata = this.deepFreezeMetadata(metadata);
    this.toolMetadata.set(toolName, frozenMetadata);
  }

  private deepFreezeMetadata(metadata: ToolMetadata): ToolMetadata {
    const copy = { ...metadata };
    if (metadata.retryPolicy) {
      (copy as any).retryPolicy = Object.freeze({ ...metadata.retryPolicy });
    }
    return Object.freeze(copy);
  }

  private async executeAttempt<TInput, TOutput>(
    tool: ITool<TInput, TOutput>,
    input: TInput,
    context: Context,
    executionContext: ExecutionContext,
    enforceTimeout: boolean
  ): Promise<ToolResult<TOutput>> {
    const startedAt = this.clock.now();

    await this.runBeforeHooksSafely(executionContext, input);

    let result: ToolResult<TOutput>;
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;

    try {
      const executePromise = tool.execute(input, context);

      let rawResult: TOutput;
      if (enforceTimeout && executionContext.timeoutMs !== undefined) {
        rawResult = await Promise.race([
          executePromise,
          new Promise<never>((_, reject) => {
            timeoutTimer = setTimeout(() => {
              const timeoutError = new Error(
                `Tool "${tool.name}" execution timed out after ${executionContext.timeoutMs}ms`
              );
              timeoutError.name = "TimeoutError";
              (timeoutError as any).code = "TIMEOUT";
              reject(timeoutError);
            }, executionContext.timeoutMs);
          }),
        ]);
      } else {
        rawResult = await executePromise;
      }

      const finishedAt = this.clock.now();
      const durationMs = finishedAt - startedAt;

      result = Object.freeze({
        success: true,
        data: rawResult,
        durationMs,
        attempts: 1,
        startedAt: new Date(startedAt).toISOString(),
        finishedAt: new Date(finishedAt).toISOString(),
        metadata: Object.freeze({
          toolName: tool.name,
          executionId: executionContext.executionId,
          attempt: executionContext.attempt,
          executionPhase: executionContext.executionPhase,
          executedAt: new Date(finishedAt).toISOString(),
        }),
      });
    } catch (error) {
      const finishedAt = this.clock.now();
      const durationMs = finishedAt - startedAt;
      const executionError = this.errorClassifier.classify(error, executionContext);
      const toolError = this.toToolError(executionError);

      result = Object.freeze({
        success: false,
        error: toolError,
        durationMs,
        attempts: 1,
        startedAt: new Date(startedAt).toISOString(),
        finishedAt: new Date(finishedAt).toISOString(),
        metadata: Object.freeze({
          toolName: tool.name,
          executionId: executionContext.executionId,
          attempt: executionContext.attempt,
          executionPhase: executionContext.executionPhase,
          executedAt: new Date(finishedAt).toISOString(),
        }),
      });
    } finally {
      if (timeoutTimer !== undefined) {
        clearTimeout(timeoutTimer);
      }
    }

    await this.runAfterHooksSafely(executionContext, result);

    return result;
  }

  public async execute<TInput = unknown, TOutput = unknown>(
    tool: ITool<TInput, TOutput>,
    input: TInput,
    context: Context
  ): Promise<ToolResult<TOutput>> {
    const executionContext: ExecutionContext = {
      executionId: this.generateExecutionId(),
      taskId: context.task.id,
      attempt: 0,
      elapsedTimeMs: 0,
      toolName: tool.name,
      timeoutMs: undefined,
      executionPhase: "initial",
      isLastAttempt: true,
    };

    return this.executeAttempt(tool, input, context, executionContext, false);
  }

  public async executeWithTimeout<TInput = unknown, TOutput = unknown>(
    tool: ITool<TInput, TOutput>,
    input: TInput,
    context: Context,
    timeoutMs: number = this.config.defaultTimeoutMs
  ): Promise<ToolResult<TOutput>> {
    const executionContext: ExecutionContext = {
      executionId: this.generateExecutionId(),
      taskId: context.task.id,
      attempt: 0,
      elapsedTimeMs: 0,
      toolName: tool.name,
      timeoutMs,
      executionPhase: "initial",
      isLastAttempt: true,
    };

    return this.executeAttempt(tool, input, context, executionContext, true);
  }

  public async executeWithRetry<TInput = unknown, TOutput = unknown>(
    tool: ITool<TInput, TOutput>,
    input: TInput,
    context: Context,
    maxRetries?: number
  ): Promise<ToolResult<TOutput>> {
    const startedAt = this.clock.now();
    const metadata = this.toolMetadata.get(tool.name);

    const policy = this.retryPolicy.resolvePolicy(
      this.config.retryPolicy ?? DEFAULT_RETRY_POLICY_CONFIG,
      metadata?.retryPolicy
    );

    const effectiveMaxRetries = maxRetries ?? policy.maxRetries;

    const retryHistory: RetryRecord[] = [];
    let lastToolResult: ToolResult<TOutput> | undefined;
    let lastExecutionError: ToolExecutionError | undefined;
    let lastDecision: RetryDecision | undefined;

    for (let attempt = 0; attempt <= effectiveMaxRetries; attempt++) {
      const elapsedTimeMs = this.clock.now() - startedAt;
      const isLastAttempt = attempt === effectiveMaxRetries;

      const executionPhase: ExecutionPhase =
        attempt === 0 ? "initial" :
        isLastAttempt ? "final" :
        "retry";

      const executionContext: ExecutionContext = {
        executionId: this.generateExecutionId(),
        taskId: context.task.id,
        attempt,
        elapsedTimeMs,
        toolName: tool.name,
        timeoutMs: this.config.defaultTimeoutMs,
        executionPhase,
        isLastAttempt,
      };

      const result = await this.executeAttempt(tool, input, context, executionContext, true);
      lastToolResult = result;

      if (result.success) {
        const finishedAt = this.clock.now();
        return Object.freeze({
          ...result,
          attempts: attempt + 1,
          startedAt: new Date(startedAt).toISOString(),
          finishedAt: new Date(finishedAt).toISOString(),
          retryHistory: Object.freeze(retryHistory),
          metadata: Object.freeze({
            ...result.metadata,
            totalAttempts: attempt + 1,
            totalDurationMs: finishedAt - startedAt,
            finalDecision: "success",  // DEPRECATED: use finalErrorCategory/finalRetryDecision
          }),
        });
      }

      const executionError = this.classifyErrorFromResult(result, executionContext);
      lastExecutionError = executionError;

      const decision = this.retryPolicy.shouldRetry(
        executionError,
        executionContext,
        policy,
        metadata
      );
      lastDecision = decision;

      if (decision === "fail" || decision === "abort") {
        break;
      }

      const delay = this.retryPolicy.calculateDelay(executionError, executionContext, policy);

      retryHistory.push({
        attempt: attempt + 1,
        delayMs: delay,
        reason: executionError.category,
        timestamp: new Date(this.clock.now()).toISOString(),
      });

      await this.delay(delay);
    }

    const finishedAt = this.clock.now();
    const totalDurationMs = finishedAt - startedAt;
    const totalAttempts = retryHistory.length + 1;

    // BACKWARD COMPATIBILITY: finalDecision is deprecated but kept for compatibility
    // New code should use finalErrorCategory and finalRetryDecision
    const finalErrorCategory = lastExecutionError?.category ?? "UNKNOWN";
    const finalRetryDecision = lastDecision ?? "fail";
    
    return Object.freeze({
      ...lastToolResult!,
      attempts: totalAttempts,
      startedAt: new Date(startedAt).toISOString(),
      finishedAt: new Date(finishedAt).toISOString(),
      retryHistory: Object.freeze(retryHistory),
      metadata: Object.freeze({
        ...lastToolResult!.metadata,
        totalAttempts,
        totalDurationMs,
        finalDecision: finalErrorCategory,  // DEPRECATED: kept for backward compatibility
        finalErrorCategory,                 // NEW: use this instead
        finalRetryDecision,                 // NEW: use this instead
      }),
    });
  }

  private classifyErrorFromResult<T>(
    result: ToolResult<T>,
    context: ExecutionContext
  ): ToolExecutionError {
    if (!result.error) {
      return {
        name: "UnknownError",
        message: "Tool failed but no error was provided",
        category: "UNKNOWN",
        descriptor: this.errorClassifier.getDescriptor("UNKNOWN"),
        recoverable: false,
        timestamp: this.clock.now(),
      };
    }

    const syntheticError = new Error(result.error.message);
    syntheticError.name = result.error.code || "Error";

    if (result.error.code) {
      (syntheticError as any).code = result.error.code;
    }

    if (result.error.details) {
      if (typeof result.error.details === "string") {
        syntheticError.stack = result.error.details;
      } else {
        (syntheticError as any).details = result.error.details;
      }
    }

    (syntheticError as any).recoverable = result.error.recoverable;

    return this.errorClassifier.classify(syntheticError, context);
  }

  private toToolError(error: ToolExecutionError): ToolError {
    return {
      code: error.code ?? error.category,
      message: error.message,
      recoverable: error.recoverable,
      details: error.details,
      timestamp: error.timestamp,
    };
  }

  private generateExecutionId(): string {
    this.executionCounter++;
    return `exec-${this.clock.now()}-${this.executionCounter}`;
  }

  private async runBeforeHooksSafely(context: ExecutionContext, input: unknown): Promise<void> {
    for (const hook of this.hooks) {
      if (hook.beforeExecute) {
        try {
          await hook.beforeExecute(context, input);
        } catch (hookError) {
          console.error(
            `[ToolExecutor] Hook "${hook.name}" beforeExecute failed:`,
            hookError instanceof Error ? hookError.message : hookError
          );
        }
      }
    }
  }

  private async runAfterHooksSafely(context: ExecutionContext, result: ToolResult): Promise<void> {
    for (const hook of this.hooks) {
      if (hook.afterExecute) {
        try {
          await hook.afterExecute(context, result);
        } catch (hookError) {
          console.error(
            `[ToolExecutor] Hook "${hook.name}" afterExecute failed:`,
            hookError instanceof Error ? hookError.message : hookError
          );
        }
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
