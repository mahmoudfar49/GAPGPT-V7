// ============================================================
// FILE: src/core/ContextManager.v7.6.0.ts
// VERSION: v7.6.0
// COMMIT: 6 (Runtime Core)
// STATUS: Draft 🟡
// CHANGELOG:
//   v7.6.0 - Initial release: Context and memory management
//            with immutable state transitions and storage helpers.
// ============================================================

import crypto from "node:crypto";
import {
  Context,
  Task,
  Message,
  MessageRole,
} from "../types/RuntimeTypes.js";

// ============================================================
// Factory: Create Initial Context
// ============================================================

export function createContext(
  task: Task,
  userId: string,
  options?: {
    sessionId?: string;
    conversationId?: string;
    initialMessages?: readonly Message[];
    initialMemory?: readonly Message[];
    auth?: {
      authenticated: boolean;
      role?: string;
      subjectId?: string;
    };
  },
): Context {
  return Object.freeze({
    task: Object.freeze({ ...task }),
    userId,
    sessionId: options?.sessionId,
    conversationId: options?.conversationId,
    messages: Object.freeze(options?.initialMessages ?? []),
    memory: Object.freeze(options?.initialMemory ?? []),
    temporary: Object.freeze({}),
    persistent: Object.freeze({}),
    auth: options?.auth ? Object.freeze({ ...options.auth }) : undefined,
  });
}

// ============================================================
// Message Management
// ============================================================

export function addMessage(
  context: Context,
  role: MessageRole,
  content: string,
  name?: string,
  metadata?: Record<string, unknown>,
): Context {
  const message: Message = Object.freeze({
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: Date.now(),
    name,
    metadata: metadata ? Object.freeze({ ...metadata }) : undefined,
  });

  return Object.freeze({
    ...context,
    messages: Object.freeze([...context.messages, message]),
  });
}

export function getRecentMessages(
  context: Context,
  limit: number = 10,
): readonly Message[] {
  return context.messages.slice(-limit);
}

export function getLastMessage(context: Context): Message | undefined {
  return context.messages[context.messages.length - 1];
}

// ============================================================
// Memory Management
// ============================================================

export function addToMemory(
  context: Context,
  role: MessageRole,
  content: string,
  name?: string,
  metadata?: Record<string, unknown>,
): Context {
  const message: Message = Object.freeze({
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: Date.now(),
    name,
    metadata: metadata ? Object.freeze({ ...metadata }) : undefined,
  });

  return Object.freeze({
    ...context,
    memory: Object.freeze([...context.memory, message]),
  });
}

export function getMemory(context: Context): readonly Message[] {
  return context.memory;
}

export function getRecentMemory(
  context: Context,
  limit: number = 5,
): readonly Message[] {
  return context.memory.slice(-limit);
}

// ============================================================
// Temporary Storage
// ============================================================

export function setTemporary<T>(
  context: Context,
  key: string,
  value: T,
): Context {
  return Object.freeze({
    ...context,
    temporary: Object.freeze({
      ...context.temporary,
      [key]: value,
    }),
  });
}

export function getTemporary<T>(context: Context, key: string): T | undefined {
  return context.temporary[key] as T | undefined;
}

export function removeTemporary(context: Context, key: string): Context {
  const { [key]: _, ...rest } = context.temporary;
  return Object.freeze({
    ...context,
    temporary: Object.freeze(rest),
  });
}

// ============================================================
// Persistent Storage
// ============================================================

export function setPersistent<T>(
  context: Context,
  key: string,
  value: T,
): Context {
  return Object.freeze({
    ...context,
    persistent: Object.freeze({
      ...context.persistent,
      [key]: value,
    }),
  });
}

export function getPersistent<T>(context: Context, key: string): T | undefined {
  return context.persistent[key] as T | undefined;
}

export function removePersistent(context: Context, key: string): Context {
  const { [key]: _, ...rest } = context.persistent;
  return Object.freeze({
    ...context,
    persistent: Object.freeze(rest),
  });
}

// ============================================================
// Context Updates
// ============================================================

export function updateAuth(
  context: Context,
  auth: {
    authenticated: boolean;
    role?: string;
    subjectId?: string;
  },
): Context {
  return Object.freeze({
    ...context,
    auth: Object.freeze({ ...auth }),
  });
}

export function setSessionId(context: Context, sessionId: string): Context {
  return Object.freeze({
    ...context,
    sessionId,
  });
}

export function setConversationId(
  context: Context,
  conversationId: string,
): Context {
  return Object.freeze({
    ...context,
    conversationId,
  });
}

// ============================================================
// Query Helpers
// ============================================================

export function getMessageCount(context: Context): number {
  return context.messages.length;
}

export function getMemoryCount(context: Context): number {
  return context.memory.length;
}

export function hasUserMessages(context: Context): boolean {
  return context.messages.some((msg) => msg.role === "user");
}

export function getSystemMessage(context: Context): Message | undefined {
  return context.messages.find((msg) => msg.role === "system");
}

export function getUserMessages(context: Context): readonly Message[] {
  return context.messages.filter((msg) => msg.role === "user");
}

export function getAssistantMessages(context: Context): readonly Message[] {
  return context.messages.filter((msg) => msg.role === "assistant");
}
