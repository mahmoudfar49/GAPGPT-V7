// ============================================================
// FILE: src/types/RuntimeTypes.v7.6.0.ts
// VERSION: v7.6.0
// COMMIT: 6 (Runtime Core)
// STATUS: Draft 🟡
// CHANGELOG:
//   v7.6.0 - Initial release: Centralized runtime types, task definitions,
//            context management, execution state, and interface contracts
//            (IAgent, ITool, IPipeline) for the GAPGPT V7 engine.
// ============================================================

export type TaskKind =
  | "math"
  | "coding"
  | "search"
  | "file"
  | "image"
  | "conversation"
  | "market_data";

export type MessageRole = "system" | "user" | "assistant" | "tool";

export type PipelineStage =
  | "ingest"
  | "planning"
  | "tool_calls"
  | "reasoning"
  | "formatting"
  | "output";

export type ExecutionStatus =
  | "idle"
  | "running"
  | "waiting_for_tools"
  | "completed"
  | "failed";

export type ToolCallStatus = "pending" | "running" | "succeeded" | "failed" | "skipped";

// ============================================================
// Core Data Structures
// ============================================================

export interface Message {
  readonly id: string;
  readonly role: MessageRole;
  readonly content: string;
  readonly timestamp: number;
  readonly name?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface Task {
  readonly id: string;
  readonly kind: TaskKind;
  readonly input: string;
  readonly priority?: number;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface Context {
  readonly task: Task;
  readonly userId: string;
  readonly sessionId?: string;
  readonly conversationId?: string;
  readonly messages: readonly Message[];
  readonly memory: readonly Message[];
  readonly temporary: Readonly<Record<string, unknown>>;
  readonly persistent: Readonly<Record<string, unknown>>;
  readonly auth?: Readonly<{
    readonly authenticated: boolean;
    readonly role?: string;
    readonly subjectId?: string;
  }>;
}

export interface ToolCall {
  readonly id: string;
  readonly toolName: string;
  readonly status: ToolCallStatus;
  readonly input: unknown;
  readonly output?: unknown;
  readonly error?: string;
  readonly startedAt?: number;
  readonly finishedAt?: number;
}

export interface ExecutionState {
  readonly executionId: string;
  readonly status: ExecutionStatus;
  readonly currentStage: PipelineStage;
  readonly startedAt: number;
  readonly updatedAt: number;
  readonly task: Task;
  readonly context: Context;
  readonly toolCalls: readonly ToolCall[];
  readonly reasoning?: string;
  readonly finalPrompt?: string;
  readonly rawResponse?: string;
  readonly formattedResponse?: string;
  readonly error?: string;
}

// ============================================================
// Prompt & Routing
// ============================================================

export interface PromptParts {
  readonly system: string;
  readonly memory: readonly string[];
  readonly user: string;
  readonly tools: readonly string[];
}

export interface PromptBuildResult {
  readonly prompt: string;
  readonly parts: PromptParts;
}

export interface RouteDecision {
  readonly taskKind: TaskKind;
  readonly route: string;
  readonly confidence: number;
  readonly requiresTools: boolean;
}

// ============================================================
// Interface-Based Architecture (Rule 1, 2 & 9)
// ============================================================

export interface PipelineStep<TState = ExecutionState> {
  readonly name: string;
  execute(state: TState): Promise<TState>;
}

export interface IPipeline<TState = ExecutionState> {
  readonly name: string;
  readonly stages: readonly PipelineStage[];
  execute(state: TState): Promise<TState>;
}

export interface ITool<TInput = unknown, TOutput = unknown> {
  readonly name: string;
  readonly description: string;
  readonly kind: TaskKind | "general";
  canHandle(task: Task, context: Context): boolean;
  execute(input: TInput, context: Context): Promise<TOutput>;
}

export interface IAgent {
  readonly name: string;
  run(input: string, context?: Partial<Context>): Promise<ExecutionState>;
}
