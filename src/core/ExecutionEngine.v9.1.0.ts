import { ITool, Context } from "../types/RuntimeTypes.js";
import {
  ToolResult,
  ToolExecutionError,
  ExecutionContext,
  IErrorClassifier,
  IRetryPolicy,
  IExecutionClock,
  IExecutionObserver,
  ExecutionState,
  ExecutionSnapshot,
  ExecutionMetrics,
  RetryRecord,
  RetryDecision,
  RetryPolicyConfig,
  ToolMetadata,
} from "../types/ToolTypes.js";
import { IRuntimeResolver } from "../types/ServiceTypes.js"; // NEW: DI Integration
import { ExecutionAttempt, ExecutionAttemptConfig } from "./ExecutionAttempt.js";
import { DEFAULT_RETRY_POLICY_CONFIG } from "./RetryPolicy.js";

export interface ExecutionEngineConfig {
  readonly defaultTimeoutMs: number;
  readonly retryPolicy: RetryPolicyConfig;
}

export interface ExecutionEngineResult<TOutput> {
  readonly result: ToolResult<TOutput>;
  readonly finalSnapshot: ExecutionSnapshot;
}

export class ExecutionEngine {
  private readonly config: ExecutionEngineConfig;
  private readonly errorClassifier: IErrorClassifier;
  private readonly retryPolicy: IRetryPolicy;
  private readonly clock: IExecutionClock;
  private readonly observers: readonly IExecutionObserver[];
  private readonly attemptRunner: ExecutionAttempt;

  constructor(
    config: ExecutionEngineConfig,
    errorClassifier: IErrorClassifier,
    retryPolicy: IRetryPolicy,
    clock: IExecutionClock,
    observers: readonly IExecutionObserver[] = [],
    resolver?: IRuntimeResolver // NEW: DI Integration (optional, backward compatible)
  ) {
    this.config = Object.freeze({
      defaultTimeoutMs: config.defaultTimeoutMs,
      retryPolicy: Object.freeze({ ...DEFAULT_RETRY_POLICY_CONFIG, ...config.retryPolicy }),
    });
    this.errorClassifier = errorClassifier;
    this.retryPolicy = retryPolicy;
    this.clock = clock;
    this.observers = Object.freeze([...observers]);
    this.attemptRunner = new ExecutionAttempt(clock, errorClassifier);
    
    // NOTE: 'resolver' is accepted for future DI wiring but not yet utilized 
    // to ensure zero behavior change in this commit (v9.1.0).
  }

  public async execute<TInput, TOutput>(
    tool: ITool<TInput, TOutput>,
    input: TInput,
    context: Context,
    executionId: string,
    maxRetries?: number,
    signal?: AbortSignal,
    metadata?: ToolMetadata,
    timeoutMs?: number
  ): Promise<ExecutionEngineResult<TOutput>> {
    const effectiveTimeout = timeoutMs ?? this.config.defaultTimeoutMs;
    const startedAt = this.clock.now();
    const taskId = context.task.id;
    const toolName = tool.name;

    const policy = this.retryPolicy.resolvePolicy(
      this.config.retryPolicy,
      metadata?.retryPolicy
    );

    const effectiveMaxRetries = maxRetries ?? policy.maxRetries;

    const retryHistory: RetryRecord[] = [];
    let lastSnapshot: ExecutionSnapshot | undefined;
    let lastExecutionError: ToolExecutionError | undefined;
    let lastDecision: RetryDecision | undefined;
    let totalRetryDelayDuration = 0;

    if (signal?.aborted) {
      const finishedAt = this.clock.now();
      const abortError = this.createAbortError(toolName);
      const classifiedError = this.errorClassifier.classify(abortError, {
        executionId, taskId, toolName, attempt: 0, signal,
      });

      const result = this.buildAbortedResult<TOutput>(toolName, startedAt, finishedAt, executionId);
      const snapshot = this.buildSnapshot(
        executionId, taskId, toolName, "CANCELLED", "UserAbort",
        0, startedAt, finishedAt, this.buildMetrics(startedAt, finishedAt, 0, 0),
        [], classifiedError
      );

      await this.runObserversSafely("onCancel", { executionId, taskId, toolName, attempt: 0, signal });
      return { result, finalSnapshot: snapshot };
    }

    for (let attempt = 0; attempt <= effectiveMaxRetries; attempt++) {
      if (signal?.aborted) {
        const finishedAt = this.clock.now();
        const abortError = this.createAbortError(toolName);
        lastExecutionError = this.errorClassifier.classify(abortError, {
          executionId, taskId, toolName, attempt, signal,
        });

        const result = this.buildAbortedResult<TOutput>(toolName, startedAt, finishedAt, executionId);
        const snapshot = this.buildSnapshot(
          executionId, taskId, toolName, "CANCELLED", "UserAbort",
          attempt, startedAt, finishedAt,
          this.buildMetrics(startedAt, finishedAt, totalRetryDelayDuration, attempt),
          retryHistory, lastExecutionError
        );

        await this.runObserversSafely("onCancel", { executionId, taskId, toolName, attempt, signal });
        return { result, finalSnapshot: snapshot };
      }

      const attemptStartedAt = this.clock.now();
      const isLastAttempt = attempt === effectiveMaxRetries;

      const executionContext: ExecutionContext = {
        executionId,
        taskId,
        toolName,
        attempt,
        signal,
        timeoutMs: effectiveTimeout,
        elapsedTimeMs: attemptStartedAt - startedAt,
        isLastAttempt,
      };

      const attemptConfig: ExecutionAttemptConfig = {
        timeoutMs: effectiveTimeout,
        enforceTimeout: true,
      };

      const attemptResult = await this.attemptRunner.execute(
        tool, input, context, executionContext, attemptConfig,
        this.observers, lastSnapshot
      );

      lastSnapshot = attemptResult.snapshot;

      if (attemptResult.result.success) {
        const finishedAt = this.clock.now();
        const finalResult: ToolResult<TOutput> = Object.freeze({
          ...attemptResult.result,
          attempts: attempt + 1,
          startedAt: new Date(startedAt).toISOString(),
          finishedAt: new Date(finishedAt).toISOString(),
          retryHistory: Object.freeze(retryHistory),
          metadata: Object.freeze({
            ...attemptResult.result.metadata,
            totalAttempts: attempt + 1,
            totalDurationMs: finishedAt - startedAt,
            finalDecision: "success",
          }),
        });

        const finalSnapshot = this.buildSnapshot(
          executionId, taskId, toolName, "COMPLETED", "Success",
          attempt, startedAt, finishedAt,
          this.buildMetrics(startedAt, finishedAt, totalRetryDelayDuration, attempt + 1),
          retryHistory, undefined
        );

        return { result: finalResult, finalSnapshot };
      }

      lastExecutionError = attemptResult.executionError;

      if (!lastExecutionError) {
        break;
      }

      const decision = this.retryPolicy.shouldRetry(
        lastExecutionError, executionContext, policy, metadata
      );
      lastDecision = decision;

      if (decision === "fail" || decision === "abort") {
        break;
      }

      const delay = this.retryPolicy.calculateDelay(
        lastExecutionError, executionContext, policy
      );

      retryHistory.push({
        attempt: attempt + 1,
        startedAt: new Date(attemptStartedAt).toISOString(),
        finishedAt: new Date(this.clock.now()).toISOString(),
        durationMs: this.clock.now() - attemptStartedAt,
        category: lastExecutionError.category,
        decision: decision,
        delayMs: delay,
        errorCode: lastExecutionError.code,
        errorMessage: lastExecutionError.message,
      });

      totalRetryDelayDuration += delay;

      await this.runObserversSafely("beforeRetry", executionContext, lastExecutionError);
      await this.delayWithAbort(delay, signal);

      if (signal?.aborted) {
        const finishedAt = this.clock.now();
        const abortError = this.createAbortError(toolName);
        lastExecutionError = this.errorClassifier.classify(abortError, {
          executionId, taskId, toolName, attempt: attempt + 1, signal,
        });

        const result = this.buildAbortedResult<TOutput>(toolName, startedAt, finishedAt, executionId);
        const snapshot = this.buildSnapshot(
          executionId, taskId, toolName, "CANCELLED", "UserAbort",
          attempt + 1, startedAt, finishedAt,
          this.buildMetrics(startedAt, finishedAt, totalRetryDelayDuration, attempt + 1),
          retryHistory, lastExecutionError
        );

        await this.runObserversSafely("onCancel", { executionId, taskId, toolName, attempt: attempt + 1, signal });
        return { result, finalSnapshot: snapshot };
      }

      await this.runObserversSafely("afterRetry", executionContext, attemptResult.result);
    }

    const finishedAt = this.clock.now();
    const totalAttempts = retryHistory.length + 1;
    const finalErrorCategory = lastExecutionError?.category ?? "UNKNOWN";
    const finalRetryDecision = lastDecision ?? "fail";

    const finalResult: ToolResult<TOutput> = Object.freeze({
      success: false,
      error: lastExecutionError ? {
        code: finalErrorCategory,
        message: lastExecutionError.message,
        recoverable: lastExecutionError.recoverable,
        details: lastExecutionError.details,
        timestamp: lastExecutionError.timestamp,
      } : {
        code: finalErrorCategory,
        message: "Execution failed",
        recoverable: false,
        timestamp: finishedAt,
      },
      durationMs: finishedAt - startedAt,
      attempts: totalAttempts,
      startedAt: new Date(startedAt).toISOString(),
      finishedAt: new Date(finishedAt).toISOString(),
      retryHistory: Object.freeze(retryHistory),
      metadata: Object.freeze({
        totalAttempts,
        totalDurationMs: finishedAt - startedAt,
        finalDecision: finalErrorCategory,
        finalErrorCategory,
        finalRetryDecision,
      }),
    });

    const finalSnapshot = this.buildSnapshot(
      executionId, taskId, toolName, "FAILED", finalErrorCategory,
      totalAttempts - 1, startedAt, finishedAt,
      this.buildMetrics(startedAt, finishedAt, totalRetryDelayDuration, totalAttempts),
      retryHistory, lastExecutionError
    );

    return { result: finalResult, finalSnapshot };
  }

  private createAbortError(toolName: string): Error {
    const error = new Error(`Tool "${toolName}" execution was aborted`);
    error.name = "AbortError";
    (error as any).code = "ABORT";
    return error;
  }

  private buildAbortedResult<TOutput>(
    toolName: string,
    startedAt: number,
    finishedAt: number,
    executionId: string
  ): ToolResult<TOutput> {
    return Object.freeze({
      success: false,
      error: {
        code: "ABORT",
        message: `Tool "${toolName}" execution was aborted`,
        recoverable: false,
        timestamp: finishedAt,
      },
      durationMs: finishedAt - startedAt,
      attempts: 1,
      startedAt: new Date(startedAt).toISOString(),
      finishedAt: new Date(finishedAt).toISOString(),
      isAborted: true,
      metadata: Object.freeze({
        toolName,
        executionId,
        executedAt: new Date(finishedAt).toISOString(),
      }),
    });
  }

  private buildSnapshot(
    executionId: string,
    taskId: string,
    toolName: string,
    state: ExecutionState,
    stateReason: ExecutionSnapshot["stateReason"],
    attempt: number,
    startedAt: number,
    finishedAt: number,
    metrics: ExecutionMetrics,
    retryHistory: readonly RetryRecord[],
    lastError: ToolExecutionError | undefined
  ): ExecutionSnapshot {
    return Object.freeze({
      executionId,
      taskId,
      toolName,
      state,
      stateReason,
      attempt,
      startedAt: new Date(startedAt).toISOString(),
      finishedAt: new Date(finishedAt).toISOString(),
      metrics,
      retryHistory,
      lastError,
    });
  }

  private buildMetrics(
    startedAt: number,
    finishedAt: number,
    retryDelayDuration: number,
    attempts: number
  ): ExecutionMetrics {
    const totalDuration = finishedAt - startedAt;
    const runningDuration = totalDuration - retryDelayDuration;
    return Object.freeze({
      timing: Object.freeze({
        queuedDuration: 0,
        runningDuration,
        retryDelayDuration,
        totalDuration,
      }),
    });
  }

  private async delayWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return;

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve();
      }, ms);

      if (signal) {
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          resolve();
        }, { once: true });
      }
    });
  }

  private async runObserversSafely(
    event: "beforeRetry" | "afterRetry" | "onCancel",
    context: ExecutionContext,
    ...args: any[]
  ): Promise<void> {
    for (const observer of this.observers) {
      const handler = observer[event];
      if (handler) {
        try {
          await (handler as any).call(observer, context, ...args);
        } catch (observerError) {
          console.error(
            `[ExecutionEngine] Observer "${observer.name}" ${event} failed:`,
            observerError instanceof Error ? observerError.message : observerError
          );
        }
      }
    }
  }
}
