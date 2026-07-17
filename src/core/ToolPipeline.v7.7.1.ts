// ============================================================
// FILE: src/core/ToolPipeline.v7.7.1.ts
// VERSION: v7.7.1
// COMMIT: 7 (Tool Framework)
// STATUS: Frozen 🟢
// CHANGELOG:
//   v7.7.1 - Architecture optimizations:
//            - Removed unnecessary results array, now only tracks lastResult
//            - Changed tools array to immutable (readonly + Object.freeze)
//            - Reduced memory footprint from O(n) to O(1) for result tracking
//   v7.7.0 - Initial release: Chain multiple tools in sequence.
// ============================================================

import { ITool, Context } from "../types/RuntimeTypes.js";
import { IToolPipeline, ToolResult } from "../types/ToolTypes.js";
import { ToolExecutor } from "./ToolExecutor.js";

export class ToolPipeline implements IToolPipeline {
  private tools: readonly ITool[];
  private readonly executor: ToolExecutor;

  constructor(executor?: ToolExecutor) {
    this.tools = Object.freeze([]);
    this.executor = executor ?? new ToolExecutor();
  }

  public addTool(tool: ITool): IToolPipeline {
    this.tools = Object.freeze([...this.tools, tool]);
    return this;
  }

  public async execute(input: unknown, context: Context): Promise<ToolResult> {
    const startTime = Date.now();
    let currentInput = input;
    let lastResult: ToolResult | undefined;

    if (this.tools.length === 0) {
      return Object.freeze({
        success: false,
        error: Object.freeze({
          code: "EMPTY_PIPELINE",
          message: "Pipeline has no tools to execute",
          recoverable: false,
          timestamp: Date.now(),
        }),
        durationMs: 0,
        metadata: Object.freeze({
          pipelineLength: 0,
          executedAt: new Date().toISOString(),
        }),
      });
    }

    let index = 0;
    for (const tool of this.tools) {
      const result = await this.executor.execute(tool, currentInput, context);
      lastResult = result;

      if (!result.success) {
        const durationMs = Date.now() - startTime;
        return Object.freeze({
          success: false,
          error: result.error,
          durationMs,
          metadata: Object.freeze({
            failedAtTool: tool.name,
            failedAtIndex: index,
            completedTools: index,
            totalTools: this.tools.length,
            executedAt: new Date().toISOString(),
          }),
        });
      }

      currentInput = result.data;
      index++;
    }

    const durationMs = Date.now() - startTime;

    return Object.freeze({
      success: true,
      data: lastResult?.data,
      durationMs,
      metadata: Object.freeze({
        pipelineLength: this.tools.length,
        allToolsExecuted: true,
        totalDurationMs: durationMs,
        executedAt: new Date().toISOString(),
      }),
    });
  }

  public getTools(): readonly ITool[] {
    return this.tools;
  }

  public clear(): void {
    this.tools = Object.freeze([]);
  }

  public getToolCount(): number {
    return this.tools.length;
  }
}
