// ============================================================
// FILE: src/types/ToolTypes.v7.7.1.ts
// VERSION: v7.7.1
// COMMIT: 7 (Tool Framework)
// STATUS: Frozen 🟢
// CHANGELOG:
//   v7.7.1 - Added setMetadata() to IToolRegistry interface
//            to align with ToolRegistry implementation (Rule 1 & 2).
//   v7.7.0 - Initial release: Tool Framework contracts.
// ============================================================

import type { ITool, Context } from "./RuntimeTypes.js";

export type ToolCategory = 
  | "data" 
  | "computation" 
  | "io" 
  | "ai" 
  | "utility"
  | "market"
  | "analysis";

export interface ToolMetadata {
  readonly version: string;
  readonly author?: string;
  readonly tags?: readonly string[];
  readonly category?: ToolCategory;
  readonly createdAt?: string;
  readonly updatedAt?: string;
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
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface IToolRegistry {
  register(tool: ITool): void;
  unregister(toolName: string): boolean;
  find(toolName: string): ITool | undefined;
  has(toolName: string): boolean;
  list(): readonly ITool[];
  resolve(taskKind: string): readonly ITool[];
  getByCategory(category: ToolCategory): readonly ITool[];
  getMetadata(toolName: string): ToolMetadata | undefined;
  setMetadata(toolName: string, metadata: ToolMetadata): void; // ✅ Added in v7.7.1
}

export interface ToolExecutorConfig {
  readonly defaultTimeoutMs: number;
  readonly maxRetries: number;
  readonly retryDelayMs: number;
}

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
    maxRetries: number,
  ): Promise<ToolResult<TOutput>>;
}

export interface IToolPipeline {
  addTool(tool: ITool): IToolPipeline;
  execute(input: unknown, context: Context): Promise<ToolResult>;
  getTools(): readonly ITool[];
  clear(): void;
}

export type { ITool };
