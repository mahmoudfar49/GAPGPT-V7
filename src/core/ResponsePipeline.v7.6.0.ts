// ============================================================
// FILE: src/core/ResponsePipeline.v7.6.0.ts
// VERSION: v7.6.0
// COMMIT: 6 (Runtime Core)
// STATUS: Draft 🟡
// CHANGELOG:
//   v7.6.0 - Initial release: Response processing pipeline
//            for parsing, validating, and formatting LLM outputs.
//            Includes tool call extraction and multi-format support.
// ============================================================

import {
  ExecutionState,
  ToolCall,
  ToolCallStatus,
} from "../types/RuntimeTypes.js";
import {
  markCompleted,
  markFailed,
  setFormattedResponse,
  setRawResponse,
  addToolCall,
} from "./ExecutionState.js";
import crypto from "node:crypto";

// ============================================================
// Types
// ============================================================

export type ResponseFormat = "text" | "json" | "markdown";

export interface ParsedResponse {
  readonly content: string;
  readonly toolCalls: readonly ParsedToolCall[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ParsedToolCall {
  readonly toolName: string;
  readonly input: unknown;
  readonly confidence?: number;
}

export interface ResponsePipelineConfig {
  readonly defaultFormat: ResponseFormat;
  readonly maxResponseLength: number;
  readonly enableToolCallExtraction: boolean;
}

export const DEFAULT_RESPONSE_PIPELINE_CONFIG: ResponsePipelineConfig = Object.freeze({
  defaultFormat: "text",
  maxResponseLength: 10000,
  enableToolCallExtraction: true,
});

// ============================================================
// Core Pipeline
// ============================================================

export async function processResponsePipeline(
  state: ExecutionState,
  rawResponse: string,
  config: ResponsePipelineConfig = DEFAULT_RESPONSE_PIPELINE_CONFIG,
): Promise<ExecutionState> {
  try {
    // Step 1: Store raw response
    let currentState = setRawResponse(state, rawResponse);

    // Step 2: Parse response
    const parsed = parseRawResponse(rawResponse, config);

    // Step 3: Extract and register tool calls
    if (config.enableToolCallExtraction && parsed.toolCalls.length > 0) {
      for (const toolCall of parsed.toolCalls) {
        const newToolCall: ToolCall = {
          id: crypto.randomUUID(),
          toolName: toolCall.toolName,
          status: "pending" as ToolCallStatus,
          input: toolCall.input,
        };
        currentState = addToolCall(currentState, newToolCall);
      }
    }

    // Step 4: Format response
    const formatted = formatResponse(parsed, config.defaultFormat);
    currentState = setFormattedResponse(currentState, formatted);

    // Step 5: Mark as completed (if no tool calls pending)
    if (parsed.toolCalls.length === 0) {
      currentState = markCompleted(currentState);
    }

    return currentState;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return markFailed(state, `Response processing failed: ${errorMessage}`);
  }
}

// ============================================================
// Parsing
// ============================================================

export function parseRawResponse(
  rawResponse: string,
  config: ResponsePipelineConfig = DEFAULT_RESPONSE_PIPELINE_CONFIG,
): ParsedResponse {
  if (!rawResponse || rawResponse.trim().length === 0) {
    return Object.freeze({
      content: "",
      toolCalls: Object.freeze([]),
    });
  }

  // Truncate if exceeds max length
  const truncated =
    rawResponse.length > config.maxResponseLength
      ? rawResponse.substring(0, config.maxResponseLength) + "\n... [truncated]"
      : rawResponse;

  // Extract tool calls (if enabled)
  const toolCalls = config.enableToolCallExtraction
    ? extractToolCalls(truncated)
    : [];

  // Extract main content (remove tool call markers)
  const content = extractContent(truncated);

  return Object.freeze({
    content,
    toolCalls: Object.freeze(toolCalls),
  });
}

// ============================================================
// Tool Call Extraction
// ============================================================

function extractToolCalls(response: string): readonly ParsedToolCall[] {
  const toolCalls: ParsedToolCall[] = [];

  // Pattern 1: [TOOL: toolName] { ... }
  const toolPattern = /\[TOOL:\s*([^\]]+)\]\s*(\{[^}]*\})?/g;
  let match;

  while ((match = toolPattern.exec(response)) !== null) {
    const toolName = match[1]?.trim();
    const inputStr = match[2];

    if (toolName) {
      let input: unknown = {};
      if (inputStr) {
        try {
          input = JSON.parse(inputStr);
        } catch {
          input = { raw: inputStr };
        }
      }

      toolCalls.push({
        toolName,
        input,
        confidence: 0.9,
      });
    }
  }

  // Pattern 2: @toolName(args)
  const atPattern = /@(\w+)\(([^)]*)\)/g;
  while ((match = atPattern.exec(response)) !== null) {
    const toolName = match[1];
    const argsStr = match[2];

    if (toolName) {
      let input: unknown = {};
      if (argsStr && argsStr.trim().length > 0) {
        try {
          input = JSON.parse(`{${argsStr}}`);
        } catch {
          input = { args: argsStr };
        }
      }

      toolCalls.push({
        toolName,
        input,
        confidence: 0.85,
      });
    }
  }

  return toolCalls;
}

function extractContent(response: string): string {
  // Remove tool call markers from content
  let content = response
    .replace(/\[TOOL:\s*[^\]]+\]\s*\{[^}]*\}/g, "")
    .replace(/@\w+\([^)]*\)/g, "")
    .trim();

  return content;
}

// ============================================================
// Formatting
// ============================================================

export function formatResponse(
  parsed: ParsedResponse,
  format: ResponseFormat = "text",
): string {
  switch (format) {
    case "json":
      return formatAsJson(parsed);
    case "markdown":
      return formatAsMarkdown(parsed);
    case "text":
    default:
      return formatAsText(parsed);
  }
}

function formatAsText(parsed: ParsedResponse): string {
  return parsed.content;
}

function formatAsJson(parsed: ParsedResponse): string {
  const obj = {
    content: parsed.content,
    toolCalls: parsed.toolCalls.map((tc) => ({
      toolName: tc.toolName,
      input: tc.input,
      confidence: tc.confidence,
    })),
  };
  return JSON.stringify(obj, null, 2);
}

function formatAsMarkdown(parsed: ParsedResponse): string {
  let md = parsed.content;

  if (parsed.toolCalls.length > 0) {
    md += "\n\n---\n\n**Tool Calls:**\n";
    for (const tc of parsed.toolCalls) {
      md += `- \`${tc.toolName}\`: ${JSON.stringify(tc.input)}\n`;
    }
  }

  return md;
}

// ============================================================
// Validation
// ============================================================

export function validateResponse(
  response: string,
  config: ResponsePipelineConfig = DEFAULT_RESPONSE_PIPELINE_CONFIG,
): { valid: boolean; error?: string } {
  if (!response || response.trim().length === 0) {
    return { valid: false, error: "Response is empty" };
  }

  if (response.length > config.maxResponseLength) {
    return {
      valid: false,
      error: `Response exceeds max length (${response.length} > ${config.maxResponseLength})`,
    };
  }

  return { valid: true };
}

// ============================================================
// Utility Functions
// ============================================================

export function hasToolCalls(parsed: ParsedResponse): boolean {
  return parsed.toolCalls.length > 0;
}

export function getToolCallCount(parsed: ParsedResponse): number {
  return parsed.toolCalls.length;
}

export function getToolCallByName(
  parsed: ParsedResponse,
  toolName: string,
): ParsedToolCall | undefined {
  return parsed.toolCalls.find((tc) => tc.toolName === toolName);
}

export function getResponseLength(parsed: ParsedResponse): number {
  return parsed.content.length;
}
