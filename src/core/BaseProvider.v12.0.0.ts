// ============================================================
// FILE: src/core/BaseProvider.v12.0.0.ts
// VERSION: v12.0.0
// COMMIT: 12 (Provider Foundation + MemoryProvider)
// STATUS: FROZEN 🟢
// ============================================================
import { ProviderState, ProviderMetadata } from "../types/ProviderTypes.js";

export abstract class BaseProvider {
  private state: ProviderState = ProviderState.CREATED;
  public abstract readonly metadata: ProviderMetadata;

  public getState(): ProviderState {
    return this.state;
  }

  public isReady(): boolean {
    return this.state === ProviderState.READY;
  }

  public async initialize(): Promise<void> {
    this.ensureState(ProviderState.CREATED, "initialize");
    this.transition(ProviderState.INITIALIZING, "starting initialization");
    try {
      await this.onInitialize();
      this.transition(ProviderState.READY, "initialization complete");
    } catch (error) {
      this.transition(ProviderState.CREATED, "initialization failed");
      throw error;
    }
  }

  public async dispose(): Promise<void> {
    if (this.state === ProviderState.DISPOSED) return;
    await this.onDispose();
    this.transition(ProviderState.DISPOSED, "provider disposed");
  }

  protected transition(next: ProviderState, reason?: string): void {
    this.state = next;
  }

  protected ensureState(expected: ProviderState, operation?: string): void {
    if (this.state !== expected) {
      const opMsg = operation ? ` for operation "${operation}"` : "";
      throw new Error(`Provider "${this.metadata.name}" is in state ${this.state}${opMsg}. Expected: ${expected}.`);
    }
  }

  protected abstract onInitialize(): Promise<void>;
  protected abstract onDispose(): Promise<void>;
}
