// ============================================================
// FILE: src/core/ToolRegistry.v7.7.1.ts
// VERSION: v7.7.1
// COMMIT: 7 (Tool Framework)
// STATUS: Frozen 🟢
// CHANGELOG:
//   v7.7.1 - Updated to match IToolRegistry v7.7.1 interface
//            (setMetadata() now part of contract).
//   v7.7.0 - Initial release: Centralized tool management.
// ============================================================

import { ITool } from "../types/RuntimeTypes.js";
import { IToolRegistry, ToolCategory, ToolMetadata } from "../types/ToolTypes.js";

export class ToolRegistry implements IToolRegistry {
  private readonly tools: Map<string, ITool>;
  private readonly metadata: Map<string, ToolMetadata>;

  constructor() {
    this.tools = new Map();
    this.metadata = new Map();
  }

  public register(tool: ITool): void {
    if (this.tools.has(tool.name)) {
      console.warn(`[ToolRegistry] Tool "${tool.name}" is already registered. Overwriting.`);
    }
    this.tools.set(tool.name, tool);
  }

  public unregister(toolName: string): boolean {
    const deleted = this.tools.delete(toolName);
    if (deleted) {
      this.metadata.delete(toolName);
    }
    return deleted;
  }

  public find(toolName: string): ITool | undefined {
    return this.tools.get(toolName);
  }

  public has(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  public list(): readonly ITool[] {
    return Object.freeze(Array.from(this.tools.values()));
  }

  public resolve(taskKind: string): readonly ITool[] {
    return Object.freeze(
      Array.from(this.tools.values()).filter((tool) => {
        return tool.kind === taskKind || tool.kind === "general";
      })
    );
  }

  public getByCategory(category: ToolCategory): readonly ITool[] {
    return Object.freeze(
      Array.from(this.tools.values()).filter((tool) => {
        const meta = this.metadata.get(tool.name);
        return meta?.category === category;
      })
    );
  }

  public getMetadata(toolName: string): ToolMetadata | undefined {
    return this.metadata.get(toolName);
  }

  public setMetadata(toolName: string, metadata: ToolMetadata): void {
    if (this.tools.has(toolName)) {
      this.metadata.set(toolName, Object.freeze({ ...metadata }));
    }
  }

  public getToolCount(): number {
    return this.tools.size;
  }

  public getToolNames(): readonly string[] {
    return Object.freeze(Array.from(this.tools.keys()));
  }

  public clear(): void {
    this.tools.clear();
    this.metadata.clear();
  }
}
