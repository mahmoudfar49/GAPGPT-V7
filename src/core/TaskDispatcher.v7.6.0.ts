// ============================================================
// FILE: src/core/TaskDispatcher.v7.6.0.ts
// VERSION: v7.6.0
// COMMIT: 6 (Runtime Core)
// STATUS: Draft 🟡
// CHANGELOG:
//   v7.6.0 - Initial release: Task routing and tool selection logic.
//            Provides deterministic heuristics for task classification
//            and safe filtering of applicable tools.
// ============================================================

import {
  Task,
  Context,
  RouteDecision,
  TaskKind,
  ITool,
} from "../types/RuntimeTypes.js";

// ============================================================
// Helper: Determine if a task kind inherently requires external tools
// ============================================================
function isToolDependentKind(kind: TaskKind): boolean {
  return (
    kind === "search" ||
    kind === "file" ||
    kind === "market_data" || // آماده‌سازی برای Commit 8
    kind === "coding"
  );
}

// ============================================================
// Core Dispatch Logic
// ============================================================

/**
 * Analyzes the task and context to determine the optimal execution route.
 * In advanced setups, this could be delegated to an LLM router.
 * Here, we use a robust deterministic heuristic.
 */
export function dispatch(task: Task, context: Context): RouteDecision {
  const requiresTools =
    isToolDependentKind(task.kind) ||
    /search|فایل|جستجو|بازار|کد/i.test(task.input);

  let route = "general_chat";
  let confidence = 0.85;

  switch (task.kind) {
    case "math":
      route = "math_solver";
      confidence = 0.95;
      break;
    case "coding":
      route = "code_generator";
      confidence = 0.90;
      break;
    case "search":
      route = "web_search";
      confidence = 0.95;
      break;
    case "file":
      route = "file_operations";
      confidence = 0.95;
      break;
    case "market_data":
      route = "market_data_engine"; // Hook for Commit 8
      confidence = 0.95;
      break;
    case "conversation":
    default:
      route = "general_chat";
      confidence = 0.85;
      break;
  }

  return Object.freeze({
    taskKind: task.kind,
    route,
    confidence,
    requiresTools,
  });
}

// ============================================================
// Tool Selection Logic
// ============================================================

/**
 * Filters the available tools to find those capable of handling the current task.
 * Includes a fail-safe to prevent a single misbehaving tool from crashing the pipeline.
 */
export function selectApplicableTools(
  task: Task,
  context: Context,
  availableTools: readonly ITool[]
): readonly ITool[] {
  return Object.freeze(
    availableTools.filter((tool) => {
      try {
        return tool.canHandle(task, context);
      } catch (error) {
        // Fail-safe: exclude the tool but keep the pipeline running
        console.warn(
          `[TaskDispatcher] Tool "${tool.name}" threw an error in canHandle:`,
          error
        );
        return false;
      }
    })
  );
}

/**
 * Quick check to see if the task inherently requires tool execution.
 */
export function requiresTools(task: Task): boolean {
  return isToolDependentKind(task.kind);
}
