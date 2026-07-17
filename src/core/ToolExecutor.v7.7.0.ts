// ============================================================
// FILE: src/core/ToolExecutor.v7.7.0.ts
// VERSION: v7.7.0
// COMMIT: 7 (Tool Framework)
// STATUS: Draft 🟡
// CHANGELOG:
//   v7.7.0 - Initial release: Safe tool execution with timeout,
//            retry logic, and error normalization.
//            Converts all exceptions to ToolError for deterministic behavior.
// ============================================================

import { ITool, Context } from "../types/RuntimeTypes.js";
import {
  IToolExecutor,
  ToolResult,
  ToolError,
  ToolExecutorConfig,
} from "../types/ToolTypes.js";

export const DEFAULT_TOOL_EXECUTOR_CONFIG: ToolExecutorConfig = Object.freeze({
  defaultTimeoutMs: 30000,
  maxRetries: 3,
  retryDelayMs: 1000,
});

export class ToolExecutor implements IToolExecutor {
  private readonly config: ToolExecutorConfig;

  constructor(config: Partial<ToolExecutorConfig> = {}) {
    this.config = Object.freeze({
      ...DEFAULT_TOOL_EXECUTOR_CONFIG,
      ...config,
    });
  }

  public async execute<TInput = unknown, TOutput = unknown>(
    tool: ITool<TInput, TOutput>,
    input: TInput,
    context: Context,
  ): Promise<ToolResult<TOutput>> {
    const startTime = Date.now();

    try {
      const result = await tool.execute(input, context);
      const durationMs = Date.now() - startTime;

      return Object.freeze({
        success: true,
        data: result,
        durationMs,
        metadata: Object.freeze({
          toolName: tool.name,
          executedAt: new Date().toISOString(),
        }),
      });
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const toolError = this.normalizeError(error);

      return Object.freeze({
        success: false,
        error: toolError,
        durationMs,
        metadata: Object.freeze({
          toolName: tool.name,
          executedAt: new Date().toISOString(),
        }),
      });
    }
  }

  public async executeWithTimeout<TInput = unknown, TOutput = unknown>(
    tool: ITool<TInput, TOutput>,
    input: TInput,
    context: Context,
    timeoutMs: number = this.config.defaultTimeoutMs,
  ): Promise<ToolResult<TOutput>> {
    const startTime = Date.now();

    return Promise.race([
      this.execute(tool, input, context),
      new Promise<ToolResult<TOutput>>((resolve) => {
        setTimeout(() => {
          const durationMs = Date.now() - startTime;
          resolve(
            Object.freeze({
              success: false,
              error: Object.freeze({
                code: "TIMEOUT",
                message: `Tool "${tool.name}" execution timed out after ${timeoutMs}ms`,
                recoverable: true,
                timestamp: Date.now(),
              }),
              durationMs,
              metadata: Object.freeze({
                toolName: tool.name,
                timeoutMs,
                executedAt: new Date().toISOString(),
              }),
            })
          );
        }, timeoutMs);
      }),
    ]);
  }

  public async executeWithRetry<TInput = unknown, TOutput = unknown>(
    tool: ITool<TInput, TOutput>,
    input: TInput,
    context: Context,
    maxRetries: number = this.config.maxRetries,
  ): Promise<ToolResult<TOutput>> {
    let lastError: ToolError | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const result = await this.execute(tool, input, context);

      if (result.success) {
        return result;
      }

      lastError = result.error;

      if (lastError && !lastError.recoverable) {
        break;
      }

      if (attempt < maxRetries) {
        await this.delay(this.config.retryDelayMs * (attempt + 1));
      }
    }

    return Object.freeze({
      success: false,
      error: lastError,
      durationMs: 0,
      metadata: Object.freeze({
        toolName: tool.name,
        attempts: maxRetries + 1,
        executedAt: new Date().toISOString(),
      }),
    });
  }

  private normalizeError(error: unknown): ToolError {
    if (error instanceof Error) {
      return Object.freeze({
        code: error.name || "UNKNOWN_ERROR",
        message: error.message,
        recoverable: true,
        details: error.stack,
        timestamp: Date.now(),
      });
    }

    if (typeof error === "string") {
      return Object.freeze({
        code: "STRING_ERROR",
        message: error,
        recoverable: true,
        timestamp: Date.now(),
      });
    }

    return Object.freeze({
      code: "UNKNOWN_ERROR",
      message: "An unknown error occurred",
      recoverable: false,
      details: error,
      timestamp: Date.now(),
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
