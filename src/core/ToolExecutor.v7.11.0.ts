// ============================================================
// NOTE ON VERSIONING:
//
// This file intentionally remains v7.11.0 rather than v10.x.x.
// Commit 10 introduces the Service Layer Foundation, but this
// change is only a minor backward-compatible extension to the
// existing v7.x Runtime API.
//
// The optional DI resolver parameter is accepted as an
// integration point only. It does not alter execution behavior,
// runtime semantics, tool invocation flow, or existing public
// contracts.
//
// Therefore, this file preserves v7.x versioning while remaining
// compatible with the v10.0.0 service-layer foundation.
// ============================================================

import { ITool, Context } from "../types/RuntimeTypes.js";
import {
  IToolExecutor,
  ToolResult,
  ToolExecutorConfig,
  IErrorClassifier,
  IRetryPolicy,
  IExecutionClock,
  IExecutionObserver,
  RetryPolicyConfig,
  ToolMetadata,
} from "../types/ToolTypes.js";
import { IRuntimeResolver } from "../types/ServiceTypes.js"; // UPDATED: IRuntimeResolver
import { ErrorClassifier } from "./ErrorClassifier.js";
import { DefaultRetryPolicy, DEFAULT_RETRY_POLICY_CONFIG } from "./RetryPolicy.js";
import { ExecutionEngine } from "./ExecutionEngine.js";

class SystemClock implements IExecutionClock {
  public now(): number { return Date.now(); }
}

export const DEFAULT_TOOL_EXECUTOR_CONFIG: ToolExecutorConfig = Object.freeze({
  defaultTimeoutMs: 30000,
  maxRetries: 3,
  retryDelayMs: 1000,
  retryPolicy: DEFAULT_RETRY_POLICY_CONFIG,
});

export class ToolExecutor implements IToolExecutor {
  private readonly config: ToolExecutorConfig;
  private readonly resolvedRetryPolicy: RetryPolicyConfig;
  private readonly engine: ExecutionEngine;
  private readonly toolMetadata: Map<string, ToolMetadata>;
  private executionCounter: number;
  private readonly instanceId: string;

  constructor(
    config: Partial<ToolExecutorConfig> = {},
    errorClassifier?: IErrorClassifier,
    retryPolicy?: IRetryPolicy,
    clock?: IExecutionClock,
    observers: readonly IExecutionObserver[] = [],
    resolver?: IRuntimeResolver // UPDATED: IRuntimeResolver
  ) {
    this.resolvedRetryPolicy = config.retryPolicy
      ? Object.freeze({ ...DEFAULT_RETRY_POLICY_CONFIG, ...config.retryPolicy })
      : DEFAULT_RETRY_POLICY_CONFIG;

    this.config = Object.freeze({
      ...DEFAULT_TOOL_EXECUTOR_CONFIG,
      ...config,
      retryPolicy: this.resolvedRetryPolicy,
    });

    this.engine = new ExecutionEngine(
      { defaultTimeoutMs: this.config.defaultTimeoutMs, retryPolicy: this.resolvedRetryPolicy },
      errorClassifier ?? new ErrorClassifier(),
      retryPolicy ?? new DefaultRetryPolicy(),
      clock ?? new SystemClock(),
      observers,
      resolver // Pass through to engine for consistent DI chain
    );

    this.toolMetadata = new Map();
    this.executionCounter = 0;
    this.instanceId = this.generateInstanceId();
  }

  public registerToolMetadata(toolName: string, metadata: ToolMetadata): void {
    const frozenMetadata = this.deepFreezeMetadata(metadata);
    (this.toolMetadata as Map<string, Readonly<ToolMetadata>>).set(toolName, frozenMetadata);
  }

  private deepFreezeMetadata(metadata: ToolMetadata): ToolMetadata {
    const copy = { ...metadata };
    if (metadata.retryPolicy) {
      (copy as any).retryPolicy = Object.freeze({ ...metadata.retryPolicy });
    }
    if (metadata.tags) {
      (copy as any).tags = Object.freeze([...metadata.tags]);
    }
    return Object.freeze(copy);
  }

  public async execute<TInput = unknown, TOutput = unknown>(
    tool: ITool<TInput, TOutput>, input: TInput, context: Context, signal?: AbortSignal
  ): Promise<ToolResult<TOutput>> {
    const executionId = this.generateExecutionId();
    const metadata = this.toolMetadata.get(tool.name);
    const result = await this.engine.execute(tool, input, context, executionId, 0, signal, metadata);
    return result.result;
  }

  public async executeWithTimeout<TInput = unknown, TOutput = unknown>(
    tool: ITool<TInput, TOutput>, input: TInput, context: Context, timeoutMs: number = this.config.defaultTimeoutMs, signal?: AbortSignal
  ): Promise<ToolResult<TOutput>> {
    const executionId = this.generateExecutionId();
    const metadata = this.toolMetadata.get(tool.name);
    const result = await this.engine.execute(tool, input, context, executionId, 0, signal, metadata, timeoutMs);
    return result.result;
  }

  public async executeWithRetry<TInput = unknown, TOutput = unknown>(
    tool: ITool<TInput, TOutput>, input: TInput, context: Context, maxRetries?: number, signal?: AbortSignal
  ): Promise<ToolResult<TOutput>> {
    const executionId = this.generateExecutionId();
    const metadata = this.toolMetadata.get(tool.name);
    const result = await this.engine.execute(tool, input, context, executionId, maxRetries, signal, metadata);
    return result.result;
  }

  private generateInstanceId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
  }

  private generateExecutionId(): string {
    this.executionCounter++;
    return `${this.instanceId}-${this.executionCounter}`;
  }
}
