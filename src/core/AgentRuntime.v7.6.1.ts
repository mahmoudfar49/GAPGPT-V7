// ============================================================
// FILE: src/core/AgentRuntime.v7.6.1.ts
// VERSION: v7.6.1
// COMMIT: 6 (Runtime Core)
// STATUS: Frozen 🟢
// CHANGELOG:
//   v7.6.1 - Architecture improvements:
//            - Replaced direct state mutation with ExecutionState API
//            - Replaced direct context.temporary mutation with ContextManager API
//            - Added Object.freeze to runtime config
//            - Maintained ToolRegistry inside Runtime (to be extracted in Commit 7)
//   v7.6.0 - Initial release: Main orchestrator
// ============================================================

import crypto from "node:crypto";
import {
  IAgent,
  ITool,
  ExecutionState,
  Context,
  Task,
  ToolCall,
  ToolCallStatus,
} from "../types/RuntimeTypes.js";
import {
  createInitialExecutionState,
  markRunning,
  markCompleted,
  markFailed,
  transitionTo,
  markWaitingForTools,
  setToolCallStatus,
  addToolCall,
} from "./ExecutionState.js";
import {
  createContext,
  addMessage,
  setTemporary,
} from "./ContextManager.js";
import {
  dispatch,
  selectApplicableTools,
} from "./TaskDispatcher.js";
import {
  buildPrompt,
  PromptBuilderConfig,
  DEFAULT_PROMPT_BUILDER_CONFIG,
} from "./PromptBuilder.js";
import {
  processResponsePipeline,
  ResponsePipelineConfig,
  DEFAULT_RESPONSE_PIPELINE_CONFIG,
} from "./ResponsePipeline.js";

// ============================================================
// Configuration (Frozen by Rule)
// ============================================================

export interface AgentRuntimeConfig {
  readonly name: string;
  readonly maxIterations: number;
  readonly promptBuilderConfig: PromptBuilderConfig;
  readonly responsePipelineConfig: ResponsePipelineConfig;
}

export const DEFAULT_AGENT_RUNTIME_CONFIG: AgentRuntimeConfig = Object.freeze({
  name: "GAPGPT-V7-Agent",
  maxIterations: 10,
  promptBuilderConfig: DEFAULT_PROMPT_BUILDER_CONFIG,
  responsePipelineConfig: DEFAULT_RESPONSE_PIPELINE_CONFIG,
});

// ============================================================
// LLM Provider Interface (Placeholder for Commit 8+)
// ============================================================

export interface LLMProvider {
  generate(prompt: string): Promise<string>;
}

// ============================================================
// Main Agent Runtime
// ============================================================

export class AgentRuntime implements IAgent {
  public readonly name: string;
  private readonly config: AgentRuntimeConfig;
  private readonly tools: Map<string, ITool>;
  private readonly llmProvider: LLMProvider | null;

  constructor(
    config: Partial<AgentRuntimeConfig> = {},
    llmProvider?: LLMProvider,
  ) {
    // ✅ Fix 3: Config is frozen
    this.config = Object.freeze({
      ...DEFAULT_AGENT_RUNTIME_CONFIG,
      ...config,
    });
    this.name = this.config.name;
    this.tools = new Map();
    this.llmProvider = llmProvider ?? null;
  }

  // ============================================================
  // Tool Registration (Temporary - will be extracted to ToolRegistry in Commit 7)
  // ============================================================

  public registerTool(tool: ITool): void {
    this.tools.set(tool.name, tool);
  }

  public unregisterTool(toolName: string): boolean {
    return this.tools.delete(toolName);
  }

  public getRegisteredTools(): readonly ITool[] {
    return Array.from(this.tools.values());
  }

  // ============================================================
  // Main Execution Entry Point
  // ============================================================

  public async run(
    input: string,
    context?: Partial<Context>,
  ): Promise<ExecutionState> {
    try {
      const task: Task = Object.freeze({
        id: crypto.randomUUID(),
        kind: this.inferTaskKind(input),
        input,
        priority: 1,
      });

      const ctx: Context = context
        ? Object.freeze({
            task,
            userId: context.userId ?? "anonymous",
            sessionId: context.sessionId,
            conversationId: context.conversationId,
            messages: context.messages ?? [],
            memory: context.memory ?? [],
            temporary: context.temporary ?? {},
            persistent: context.persistent ?? {},
            auth: context.auth,
          })
        : createContext(task, "anonymous");

      const contextWithMessage = addMessage(ctx, "user", input);
      let state = createInitialExecutionState(task, contextWithMessage);
      state = await this.executePipeline(state);

      return state;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[AgentRuntime] Fatal error: ${errorMessage}`);

      const fallbackTask: Task = Object.freeze({
        id: crypto.randomUUID(),
        kind: "conversation",
        input,
      });
      const fallbackContext = createContext(fallbackTask, "anonymous");
      const fallbackState = createInitialExecutionState(fallbackTask, fallbackContext);
      return markFailed(fallbackState, errorMessage);
    }
  }

  // ============================================================
  // Pipeline Execution
  // ============================================================

  private async executePipeline(
    state: ExecutionState,
  ): Promise<ExecutionState> {
    let currentState = markRunning(state);
    let iterations = 0;

    while (iterations < this.config.maxIterations) {
      iterations++;

      // Stage 1: Ingest
      currentState = transitionTo(currentState, "ingest");

      // Stage 2: Planning (Task Dispatch)
      currentState = transitionTo(currentState, "planning");
      const decision = dispatch(currentState.task, currentState.context);

      // Stage 3: Tool Calls (if needed)
      if (decision.requiresTools) {
        currentState = transitionTo(currentState, "tool_calls");
        currentState = markWaitingForTools(currentState);

        const applicableTools = selectApplicableTools(
          currentState.task,
          currentState.context,
          Array.from(this.tools.values()),
        );

        if (applicableTools.length > 0) {
          for (const tool of applicableTools) {
            // ✅ Fix 1: Use ExecutionState API (addToolCall)
            const newToolCall: ToolCall = Object.freeze({
              id: crypto.randomUUID(),
              toolName: tool.name,
              status: "pending" as ToolCallStatus,
              input: currentState.task.input,
            });
            currentState = addToolCall(currentState, newToolCall);

            try {
              currentState = setToolCallStatus(currentState, newToolCall.id, "running");
              const result = await tool.execute(currentState.task.input, currentState.context);
              currentState = setToolCallStatus(currentState, newToolCall.id, "succeeded");

              // ✅ Fix 2: Use ContextManager API (setTemporary)
              const updatedContext = setTemporary(
                currentState.context,
                `${tool.name}_result`,
                result,
              );
              currentState = Object.freeze({
                ...currentState,
                context: updatedContext,
              });
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error);
              currentState = setToolCallStatus(currentState, newToolCall.id, "failed");
              console.warn(`[AgentRuntime] Tool ${tool.name} failed: ${errorMsg}`);
            }
          }
        }
      }

      // Stage 4: Reasoning (LLM Call)
      currentState = transitionTo(currentState, "reasoning");
      if (this.llmProvider) {
        const promptResult = buildPrompt(
          currentState,
          Array.from(this.tools.values()),
          this.config.promptBuilderConfig,
        );
        const rawResponse = await this.llmProvider.generate(promptResult.prompt);

        currentState = await processResponsePipeline(
          currentState,
          rawResponse,
          this.config.responsePipelineConfig,
        );
      } else {
        currentState = markCompleted(currentState);
      }

      if (currentState.status === "completed" || currentState.status === "failed") {
        break;
      }
    }

    if (iterations >= this.config.maxIterations && currentState.status !== "completed") {
      return markFailed(currentState, "Max iterations reached");
    }

    return currentState;
  }

  // ============================================================
  // Helpers
  // ============================================================

  private inferTaskKind(input: string): Task["kind"] {
    const lowerInput = input.toLowerCase();

    if (/math|calculate|compute|محاسبه/.test(lowerInput)) return "math";
    if (/code|program|script|کد|برنامه/.test(lowerInput)) return "coding";
    if (/search|find|lookup|جستجو|پیدا/.test(lowerInput)) return "search";
    if (/file|read|write|فایل/.test(lowerInput)) return "file";
    if (/market|stock|price|بازار|سهام|قیمت/.test(lowerInput)) return "market_data";

    return "conversation";
  }
}
