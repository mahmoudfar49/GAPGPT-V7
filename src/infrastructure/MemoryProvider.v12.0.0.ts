// ============================================================
// FILE: src/infrastructure/MemoryProvider.v12.0.0.ts
// VERSION: v12.0.0
// COMMIT: 12 (Provider Foundation + MemoryProvider)
// STATUS: FROZEN 🟢
// ============================================================
import { BaseProvider } from "../core/BaseProvider.js";
import { IMemoryProvider } from "../types/ProviderContracts.js";
import { ProviderKind, ProviderState, ProviderMetadata } from "../types/ProviderTypes.js";

export class MemoryProvider extends BaseProvider implements IMemoryProvider {
  public readonly metadata: ProviderMetadata = Object.freeze({
    name: "MemoryProvider",
    version: "12.0.0",
    kind: ProviderKind.MEMORY,
    capabilities: Object.freeze(["get", "put", "delete", "clear"]),
  });

  private storage = new Map<string, unknown>();

  protected async onInitialize(): Promise<void> {
    // Canonical: no-op for in-memory
  }

  protected async onDispose(): Promise<void> {
    this.storage.clear();
  }

  public async get(key: string): Promise<unknown | undefined> {
    this.ensureState(ProviderState.READY, "get");
    return this.storage.get(key);
  }

  public async put(key: string, value: unknown): Promise<void> {
    this.ensureState(ProviderState.READY, "put");
    this.storage.set(key, value);
  }

  public async delete(key: string): Promise<void> {
    this.ensureState(ProviderState.READY, "delete");
    this.storage.delete(key);
  }

  public async clear(): Promise<void> {
    this.ensureState(ProviderState.READY, "clear");
    this.storage.clear();
  }
}
