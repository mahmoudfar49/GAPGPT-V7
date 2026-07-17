// ============================================================
// FILE: src/core/ExecutionState.v7.6.0.ts
// VERSION: v7.6.0
// COMMIT: 6 (Runtime Core)
// STATUS: Draft 🟡
// CHANGELOG:
//   v7.6.0 - Initial release: Immutable execution state manager
//            with factory methods for state transitions, tool calls,
//            and response management using Object.freeze pattern.
// ============================================================

import crypto from "node:crypto";
import {
  ExecutionState,
  ExecutionStatus,
  PipelineStage,
  Task,
  Context,
  ToolCall,
  ToolCallStatus,
} from "../types/RuntimeTypes.js";

// ============================================================
// Factory: Create Initial State
// ============================================================

export function createInitialExecutionState(
  task: Task,
  context: Context,
): ExecutionState {
  const now = Date.now();
  return Object.freeze({
    executionId: crypto.randomUUID(),
    status: "idle" as ExecutionStatus,
    currentStage: "ingest" as PipelineStage,
    startedAt: now,
    updatedAt: now,
    task: Object.freeze({ ...task }),
    context: Object.freeze({ ...context }),
    toolCalls: Object.freeze([]),
  });
}

// ============================================================
// State Transitions
// ============================================================

export function transitionTo(
  state: ExecutionState,
  stage: PipelineStage,
  status?: ExecutionStatus,
): ExecutionState {
  return Object.freeze({
    ...state,
    currentStage: stage,
    status: status ?? state.status,
    updatedAt: Date.now(),
  });
}

export function markRunning(state: ExecutionState): ExecutionState {
  return Object.freeze({
    ...state,
    status: "running" as ExecutionStatus,
    updatedAt: Date.now(),
  });
}

export function markCompleted(state: ExecutionState): ExecutionState {
  return Object.freeze({
    ...state,
    status: "completed" as ExecutionStatus,
    updatedAt: Date.now(),
  });
}

export function markFailed(state: ExecutionState, error: string): ExecutionState {
  return Object.freeze({
    ...state,
    status: "failed" as ExecutionStatus,
    error,
    updatedAt: Date.now(),
  });
}

export function markWaitingForTools(state: ExecutionState): ExecutionState {
  return Object.freeze({
    ...state,
    status: "waiting_for_tools" as ExecutionStatus,
    updatedAt: Date.now(),
  });
}

// ============================================================
// Tool Call Management
// ============================================================

export function addToolCall(
  state: ExecutionState,
  toolCall: ToolCall,
): ExecutionState {
  return Object.freeze({
    ...state,
    toolCalls: Object.freeze([...state.toolCalls, Object.freeze({ ...toolCall })]),
    updatedAt: Date.now(),
  });
}

export function updateToolCall(
  state: ExecutionState,
  toolCallId: string,
  updates: Partial<Omit<ToolCall, "id" | "toolName">>,
): ExecutionState {
  const updatedToolCalls = state.toolCalls.map((tc) => {
    if (tc.id !== toolCallId) return tc;
    return Object.freeze({ ...tc, ...updates });
  });

  return Object.freeze({
    ...state,
    toolCalls: Object.freeze(updatedToolCalls),
    updatedAt: Date.now(),
  });
}

export function setToolCallStatus(
  state: ExecutionState,
  toolCallId: string,
  status: ToolCallStatus,
): ExecutionState {
  const now = Date.now();
  let updates: Partial<Omit<ToolCall, "id" | "toolName">>;

  switch (status) {
    case "running":
      updates = { status, startedAt: now };
      break;
    case "succeeded":
    case "failed":
    case "skipped":
      updates = { status, finishedAt: now };
      break;
    default:
      updates = { status };
  }

  return updateToolCall(state, toolCallId, updates);
}

// ============================================================
// Response Management
// ============================================================

export function setReasoning(
  state: ExecutionState,
  reasoning: string,
): ExecutionState {
  return Object.freeze({
    ...state,
    reasoning,
    updatedAt: Date.now(),
  });
}

export function setFinalPrompt(
  state: ExecutionState,
  finalPrompt: string,
): ExecutionState {
  return Object.freeze({
    ...state,
    finalPrompt,
    updatedAt: Date.now(),
  });
}

export function setRawResponse(
  state: ExecutionState,
  rawResponse: string,
): ExecutionState {
  return Object.freeze({
    ...state,
    rawResponse,
    updatedAt: Date.now(),
  });
}

export function setFormattedResponse(
  state: ExecutionState,
  formattedResponse: string,
): ExecutionState {
  return Object.freeze({
    ...state,
    formattedResponse,
    updatedAt: Date.now(),
  });
}

// ============================================================
// Query Helpers
// ============================================================

export function getToolCall(
  state: ExecutionState,
  toolCallId: string,
): ToolCall | undefined {
  return state.toolCalls.find((tc) => tc.id === toolCallId);
}

export function getPendingToolCalls(state: ExecutionState): readonly ToolCall[] {
  return state.toolCalls.filter(
    (tc) => tc.status === "pending" || tc.status === "running",
  );
}

export function getCompletedToolCalls(state: ExecutionState): readonly ToolCall[] {
  return state.toolCalls.filter(
    (tc) => tc.status === "succeeded" || tc.status === "failed" || tc.status === "skipped",
  );
}

export function isExecutionComplete(state: ExecutionState): boolean {
  return state.status === "completed" || state.status === "failed";
}

export function getExecutionDuration(state: ExecutionState): number {
  return Date.now() - state.startedAt;
}
