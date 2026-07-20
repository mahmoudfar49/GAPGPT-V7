import { ITool, Context } from "../types/RuntimeTypes.js";
import {
  ToolResult,
  ToolError,
  ToolExecutionError,
  ExecutionContext,
  IErrorClassifier,
  IExecutionClock,
  IExecutionObserver,
  ExecutionState,
  ExecutionSnapshot,
  ExecutionMetrics,
  VALID_STATE_TRANSITIONS,
} from "../types/ToolTypes.js";
import { IRuntimeResolver } from "../types/ServiceTypes.js"; // NEW: DI Integration

// ============================================================
// Execution Attempt Config
// ============================================================

export interface ExecutionAttemptConfig {
  readonly timeoutMs?: number;
  readonly enforceTimeout: boolean;
}

// ============================================================
// Execution Attempt Result
// ============================================================

export interface ExecutionAttemptResult<TOutput> {
  readonly result: ToolResult<TOutput>;
  readonly executionError?: ToolExecutionError;
  readonly snapshot: ExecutionSnapshot;
}

// ============================================================
// Helper: Validate State Transition
// ============================================================

function isValidTransition(from: ExecutionState, to: ExecutionState): boolean {
  const validTargets = VALID_STATE_TRANSITIONS[from];
  return validTargets.includes(to);
}

// ============================================================
// Helper: Create Initial Metrics
// ============================================================

function createInitialMetrics(startedAt: number, clock: IExecutionClock): ExecutionMetrics {
  const now = clock.now();
  return Object.freeze({
    timing: Object.freeze({
      queuedDuration: 0,
      runningDuration: now - startedAt,
      retryDelayDuration: 0,
      totalDuration: now - startedAt,
    }),
  });
}

// ============================================================
// Execution Attempt v9.1.0
// Responsible for executing a single attempt with timeout and abort support
// ============================================================

export class ExecutionAttempt {
  private readonly clock: IExecutionClock;
  private readonly errorClassifier: IErrorClassifier;

  constructor(
    clock: IExecutionClock, 
    errorClassifier: IErrorClassifier,
    resolver?: IRuntimeResolver // NEW: DI Integration (optional, backward compatible)
  ) {
    this.clock = clock;
    this.errorClassifier = errorClassifier;
    
    // NOTE: 'resolver' is accepted for future DI wiring but not yet utilized 
    // to ensure zero behavior change in this commit (v9.1.0).
  }

  // ========================================================
  // Execute a single attempt
  // Returns: result, executionError (if failed), and final snapshot
  // ========================================================
  public async execute<TInput, TOutput>(
    tool: ITool<TInput, TOutput>,
    input: TInput,
    context: Context,
    executionContext: ExecutionContext,
    config: ExecutionAttemptConfig,
    observers: readonly IExecutionObserver[] = [],
    previousSnapshot?: ExecutionSnapshot
  ): Promise<ExecutionAttemptResult<TOutput>> {
    const startedAt = this.clock.now();
    const executionId = executionContext.executionId;
    const taskId = executionContext.taskId;
    const toolName = executionContext.toolName;
    const attempt = executionContext.attempt;

    // Build initial snapshot (STARTING state)
    let currentSnapshot = this.buildSnapshot(
      executionId,
      taskId,
      toolName,
      "STARTING",
      undefined,
      attempt,
      new Date(startedAt).toISOString(),
      undefined,
      createInitialMetrics(startedAt, this.clock),
      [],
      undefined
    );

    // Run beforeExecute hooks with isolation
    await this.runObserversSafely("beforeExecute", observers, executionContext, input);

    // Check abort before starting
    if (this.isAborted(executionContext.signal)) {
      const finishedAt = this.clock.now();
      const abortError = this.createAbortError(toolName);
      const classifiedError = this.errorClassifier.classify(abortError, executionContext);
      
      currentSnapshot = this.buildSnapshot(
        executionId,
        taskId,
        toolName,
        "CANCELLED",
        "UserAbort",
        attempt,
        new Date(startedAt).toISOString(),
        new Date(finishedAt).toISOString(),
        this.buildFinalMetrics(startedAt, finishedAt),
        [],
        classifiedError
      );

      const result = this.buildAbortedResult<TOutput>(toolName, startedAt, finishedAt, executionContext);
      await this.runObserversSafely("onCancel", observers, executionContext);
      await this.runObserversSafely("afterExecute", observers, executionContext, result);

      return { result, executionError: classifiedError, snapshot: currentSnapshot };
    }

    // Transition to RUNNING
    if (!isValidTransition("STARTING", "RUNNING")) {
      throw new Error("Invalid state transition: STARTING -> RUNNING");
    }

    let result: ToolResult<TOutput>;
    let executionError: ToolExecutionError | undefined;
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;

    try {
      const executePromise = tool.execute(input, context);

      let rawResult: TOutput;
      if (config.enforceTimeout && config.timeoutMs !== undefined) {
        rawResult = await Promise.race([
          executePromise,
          new Promise<never>((_, reject) => {
            timeoutTimer = setTimeout(() => {
              const timeoutError = new Error(
                `Tool "${toolName}" execution timed out after ${config.timeoutMs}ms`
              );
              timeoutError.name = "TimeoutError";
              (timeoutError as any).code = "TIMEOUT";
              reject(timeoutError);
            }, config.timeoutMs);
          }),
        ]);
      } else {
        rawResult = await executePromise;
      }

      // Check abort after execution
      if (this.isAborted(executionContext.signal)) {
        const finishedAt = this.clock.now();
        const abortError = this.createAbortError(toolName);
        executionError = this.errorClassifier.classify(abortError, executionContext);
        
        result = this.buildAbortedResult<TOutput>(toolName, startedAt, finishedAt, executionContext);
        
        currentSnapshot = this.buildSnapshot(
          executionId,
          taskId,
          toolName,
          "CANCELLED",
          "UserAbort",
          attempt,
          new Date(startedAt).toISOString(),
          new Date(finishedAt).toISOString(),
          this.buildFinalMetrics(startedAt, finishedAt),
          [],
          executionError
        );

        await this.runObserversSafely("onCancel", observers, executionContext);
      } else {
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
            toolName,
            executionId,
            attempt,
            executedAt: new Date(finishedAt).toISOString(),
          }),
        });

        currentSnapshot = this.buildSnapshot(
          executionId,
          taskId,
          toolName,
          "COMPLETED",
          "Success",
          attempt,
          new Date(startedAt).toISOString(),
          new Date(finishedAt).toISOString(),
          this.buildFinalMetrics(startedAt, finishedAt),
          [],
          undefined
        );
      }
    } catch (error) {
      const finishedAt = this.clock.now();
      const durationMs = finishedAt - startedAt;
      
      // Check if it's an abort
      if (this.isAborted(executionContext.signal) || this.isAbortError(error)) {
        executionError = this.errorClassifier.classify(
          this.createAbortError(toolName),
          executionContext
        );
        result = this.buildAbortedResult<TOutput>(toolName, startedAt, finishedAt, executionContext);
        
        currentSnapshot = this.buildSnapshot(
          executionId,
          taskId,
          toolName,
          "CANCELLED",
          "UserAbort",
          attempt,
          new Date(startedAt).toISOString(),
          new Date(finishedAt).toISOString(),
          this.buildFinalMetrics(startedAt, finishedAt),
          [],
          executionError
        );

        await this.runObserversSafely("onCancel", observers, executionContext);
      } else {
        executionError = this.errorClassifier.classify(error, executionContext);
        const toolError = this.toToolError(executionError);

        result = Object.freeze({
          success: false,
          error: toolError,
          durationMs,
          attempts: 1,
          startedAt: new Date(startedAt).toISOString(),
          finishedAt: new Date(finishedAt).toISOString(),
          metadata: Object.freeze({
            toolName,
            executionId,
            attempt,
            executedAt: new Date(finishedAt).toISOString(),
          }),
        });

        // Determine final state based on error category
        const finalState: ExecutionState = "FAILED";
        const stateReason = executionError.category;

        currentSnapshot = this.buildSnapshot(
          executionId,
          taskId,
          toolName,
          finalState,
          stateReason,
          attempt,
          new Date(startedAt).toISOString(),
          new Date(finishedAt).toISOString(),
          this.buildFinalMetrics(startedAt, finishedAt),
          [],
          executionError
        );

        // Fire onFailure observer
        await this.runObserversSafely("onFailure", observers, executionContext, executionError);
      }
    } finally {
      if (timeoutTimer !== undefined) {
        clearTimeout(timeoutTimer);
      }
    }

    // Run afterExecute hooks with isolation
    await this.runObserversSafely("afterExecute", observers, executionContext, result);

    return { result, executionError, snapshot: currentSnapshot };
  }

  // ========================================================
  // Private Helpers
  // ========================================================

  private isAborted(signal?: AbortSignal): boolean {
    return signal !== undefined && signal.aborted;
  }

  private isAbortError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const name = error.name.toLowerCase();
    const message = error.message.toLowerCase();
    return (
      name === "aborterror" ||
      message.includes("aborted") ||
      message.includes("cancelled") ||
      message.includes("canceled")
    );
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
    executionContext: ExecutionContext
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
        executionId: executionContext.executionId,
        attempt: executionContext.attempt,
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
    startedAt: string,
    finishedAt: string | undefined,
    metrics: ExecutionMetrics,
    retryHistory: readonly any[],
    lastError: ToolExecutionError | undefined
  ): ExecutionSnapshot {
    return Object.freeze({
      executionId,
      taskId,
      toolName,
      state,
      stateReason,
      attempt,
      startedAt,
      finishedAt,
      metrics,
      retryHistory,
      lastError,
    });
  }

  private buildFinalMetrics(startedAt: number, finishedAt: number): ExecutionMetrics {
    const totalDuration = finishedAt - startedAt;
    return Object.freeze({
      timing: Object.freeze({
        queuedDuration: 0,
        runningDuration: totalDuration,
        retryDelayDuration: 0,
        totalDuration,
      }),
    });
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

  private async runObserversSafely(
    event: "beforeExecute" | "afterExecute" | "onFailure" | "onCancel",
    observers: readonly IExecutionObserver[],
    context: ExecutionContext,
    ...args: any[]
  ): Promise<void> {
    for (const observer of observers) {
      const handler = observer[event];
      if (handler) {
        try {
          await (handler as any).call(observer, context, ...args);
        } catch (observerError) {
          console.error(
            `[ExecutionAttempt] Observer "${observer.name}" ${event} failed:`,
            observerError instanceof Error ? observerError.message : observerError
          );
        }
      }
    }
  }
}
