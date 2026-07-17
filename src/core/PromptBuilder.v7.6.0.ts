// ============================================================
// FILE: src/core/PromptBuilder.v7.6.0.ts
// VERSION: v7.6.0
// COMMIT: 6 (Runtime Core)
// STATUS: Draft 🟡
// CHANGELOG:
//   v7.6.0 - Initial release: Dynamic and modular prompt builder
//            that constructs LLM prompts from ExecutionState and Context.
//            Supports system, memory, user, and tools sections.
// ============================================================

import {
  ExecutionState,
  Context,
  Message,
  ITool,
  PromptParts,
  PromptBuildResult,
} from "../types/RuntimeTypes.js";

// ============================================================
// Configuration
// ============================================================

export interface PromptBuilderConfig {
  readonly maxMemoryMessages: number;
  readonly maxUserMessages: number;
  readonly includeTools: boolean;
  readonly systemPromptTemplate?: string;
}

export const DEFAULT_PROMPT_BUILDER_CONFIG: PromptBuilderConfig = Object.freeze({
  maxMemoryMessages: 5,
  maxUserMessages: 10,
  includeTools: true,
});

// ============================================================
// Core Prompt Building
// ============================================================

export function buildPrompt(
  state: ExecutionState,
  availableTools?: readonly ITool[],
  config: PromptBuilderConfig = DEFAULT_PROMPT_BUILDER_CONFIG,
): PromptBuildResult {
  const context = state.context;

  const parts: PromptParts = Object.freeze({
    system: buildSystemPrompt(context, config),
    memory: buildMemorySection(context, config),
    user: buildUserSection(context, config),
    tools: config.includeTools && availableTools
      ? buildToolsSection(availableTools)
      : [],
  });

  const prompt = combinePromptParts(parts);

  return Object.freeze({
    prompt,
    parts,
  });
}

// ============================================================
// Section Builders
// ============================================================

function buildSystemPrompt(
  context: Context,
  config: PromptBuilderConfig,
): string {
  const template = config.systemPromptTemplate ?? getDefaultSystemPrompt();
  
  let systemPrompt = template
    .replace("{{taskKind}}", context.task.kind)
    .replace("{{userId}}", context.userId);

  if (context.auth?.authenticated) {
    systemPrompt += `\n\nUser is authenticated with role: ${context.auth.role ?? "user"}`;
  }

  return systemPrompt;
}

function buildMemorySection(
  context: Context,
  config: PromptBuilderConfig,
): readonly string[] {
  const recentMemory = context.memory.slice(-config.maxMemoryMessages);
  
  return Object.freeze(
    recentMemory.map((msg) => formatMessage(msg, "Memory"))
  );
}

function buildUserSection(
  context: Context,
  config: PromptBuilderConfig,
): string {
  const recentMessages = context.messages.slice(-config.maxUserMessages);
  
  const conversation = recentMessages
    .map((msg) => formatMessage(msg))
    .join("\n");

  return conversation || context.task.input;
}

function buildToolsSection(tools: readonly ITool[]): readonly string[] {
  return Object.freeze(
    tools.map((tool) => {
      return `[Tool: ${tool.name}]\nDescription: ${tool.description}\nKind: ${tool.kind}`;
    })
  );
}

// ============================================================
// Prompt Combination
// ============================================================

function combinePromptParts(parts: PromptParts): string {
  const sections: string[] = [];

  if (parts.system) {
    sections.push(`[SYSTEM]\n${parts.system}`);
  }

  if (parts.memory.length > 0) {
    sections.push(`[MEMORY]\n${parts.memory.join("\n")}`);
  }

  if (parts.tools.length > 0) {
    sections.push(`[AVAILABLE TOOLS]\n${parts.tools.join("\n\n")}`);
  }

  if (parts.user) {
    sections.push(`[CONVERSATION]\n${parts.user}`);
  }

  return sections.join("\n\n---\n\n");
}

// ============================================================
// Helpers
// ============================================================

function formatMessage(msg: Message, prefix?: string): string {
  const roleLabel = prefix ?? msg.role.toUpperCase();
  const namePart = msg.name ? ` (${msg.name})` : "";
  return `${roleLabel}${namePart}: ${msg.content}`;
}

function getDefaultSystemPrompt(): string {
  return `You are GAPGPT V7, an advanced AI assistant specialized in {{taskKind}} tasks.
You are assisting user {{userId}}.
Be helpful, accurate, and concise.
If you need to use tools, describe what you need clearly.`;
}

// ============================================================
// Utility Functions
// ============================================================

export function getPromptLength(prompt: string): number {
  return prompt.length;
}

export function estimateTokenCount(prompt: string): number {
  // Rough estimation: 1 token ≈ 4 characters
  return Math.ceil(prompt.length / 4);
}

export function truncatePrompt(prompt: string, maxLength: number): string {
  if (prompt.length <= maxLength) return prompt;
  return prompt.substring(0, maxLength - 3) + "...";
}
