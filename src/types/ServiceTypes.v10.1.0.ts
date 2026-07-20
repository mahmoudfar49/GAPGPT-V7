// ============================================================
// FILE: src/types/ServiceTypes.v10.1.0.ts
// VERSION: v10.1.0
// COMMIT: 11 (DI Integration)
// STATUS: Draft 🟡
// CHANGELOG:
//   v10.1.0 - Incremental evolution from v10.0.0:
//            - Added IRuntimeResolver (minimal interface for Runtime)
//            - IServiceResolver now extends IRuntimeResolver
//            - Added IDisposable interface (minimal disposal contract)
//            - Added IServiceLifecycleHooks (interface only, no implementation)
//            - Added Provider Tokens for Market, Memory, LLM, Cache
//            - NOTE: This is an extension, not a redesign
//            - NOTE: Full disposal graph implementation deferred to future commits
//            - NOTE: RuntimeToken<T> separation deferred to v1.2/v2.0
// ============================================================

// Import ServiceToken (as value, not just type) for use in new interfaces and token instances
import { ServiceToken } from './ServiceTypes.v10.0.0.js';

// Re-export all from v10.0.0 (backward compatible)
export * from './ServiceTypes.v10.0.0.js';

// ============================================================
// Runtime Resolver (Minimal Interface for Runtime Classes)
// ============================================================

/**
 * Minimal resolver interface for Runtime classes.
 * Runtime classes should ONLY use this interface, not IServiceResolver.
 * This enforces the "fail fast" principle: Runtime should not ask "does this exist?"
 * but instead resolve directly and handle errors if missing.
 * 
 * GOLDEN RULE: Runtime classes must NEVER call has(), register(), createScope(), or dispose().
 */
export interface IRuntimeResolver {
  resolve<T>(token: ServiceToken<T>): T;
  tryResolve<T>(token: ServiceToken<T>): T | undefined;
}

// ============================================================
// Refactor: IServiceResolver now extends IRuntimeResolver
// ============================================================

/**
 * Full resolver interface for Service Layer.
 * Extends IRuntimeResolver with has() for administrative operations.
 * ServiceContainer implements this interface.
 * 
 * NOTE: Runtime classes should use IRuntimeResolver, not this interface.
 */
export interface IServiceResolver extends IRuntimeResolver {
  has(token: ServiceToken<unknown>): boolean;
}

// ============================================================
// Minimal Disposal Contract (Optional)
// ============================================================

/**
 * Optional interface for services that require cleanup.
 * In v11.0.0, this is a minimal contract only.
 * Full disposal graph implementation is deferred to future commits.
 * 
 * Future implementations: ICacheProvider, Database, HttpClient, ConnectionPool
 */
export interface IDisposable {
  dispose(): Promise<void>;
}

// ============================================================
// Lifecycle Hooks (For Future Use - No Implementation in v11)
// ============================================================

/**
 * Optional lifecycle hooks for services.
 * In v11.0.0, these are no-op placeholders (interface only).
 * Reserved for future logging, metrics, and telemetry.
 * 
 * NOTE: No implementation in Commit 11. Only interface definition.
 */
export interface IServiceLifecycleHooks {
  onRegister?(token: ServiceToken<unknown>): void;
  onResolved?(token: ServiceToken<unknown>, instance: unknown): void;
  onDisposed?(token: ServiceToken<unknown>, instance: unknown): void;
}

// ============================================================
// Provider Tokens (For Future Provider Registration)
// ============================================================

/**
 * Type-safe tokens for Provider registration.
 * These tokens are used with ServiceContainer to register and resolve providers.
 * 
 * NOTE: Actual provider implementations will be added in Commit 12+.
 */
export const MarketProviderToken = new ServiceToken<any>('MarketProvider');
export const MemoryProviderToken = new ServiceToken<any>('MemoryProvider');
export const LLMProviderToken = new ServiceToken<any>('LLMProvider');
export const CacheProviderToken = new ServiceToken<any>('CacheProvider');
