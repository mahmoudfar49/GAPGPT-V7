# DI Integration & Wiring - v11.0.0

## 🎯 Goals
- Wire the existing Execution Runtime (v9.x/v7.x) with the Service Layer Foundation (v10.x).
- Establish strict boundaries: Runtime classes consume services via `IRuntimeResolver` ONLY.
- Provide helper functions for standardized Provider registration.
- Maintain 100% backward compatibility with existing runtime behavior.

## 🚫 Non-Goals (Out of Scope for Commit 11)
- **Concrete Provider Implementations**: No actual Market, Memory, LLM, or Cache providers are implemented here.
- **Runtime Behavior Changes**: No modification to execution logic, retry policies, or state management.
- **Complex Lifecycle Management**: Full disposal graphs, scoped disposal, or ownership rules are deferred.
- **Advanced DI Features**: No auto-wiring, reflection, async factories, or auto-discovery.
- **Business Logic Modifications**: Tool contracts and execution semantics remain untouched.

## 🏗️ Architecture & Wiring Boundaries

### The Golden Rule of Wiring
Runtime classes (`AgentRuntime`, `ExecutionEngine`, `ExecutionAttempt`, `ToolExecutor`) **MUST ONLY** accept and use `IRuntimeResolver`. 
They **MUST NEVER**:
- Call `register()`, `createScope()`, or `dispose()`.
- Call `has()` (enforcing the "fail fast" principle: resolve directly or let it throw).

```text
                 AgentRuntime
                       │
              IRuntimeResolver (resolve / tryResolve ONLY)
                       │
        ┌──────────────┴──────────────┐
        │                             │
 ExecutionEngine             ExecutionAttempt
        │                             │
        └──────────────┬──────────────┘
                       │
               ServiceContainer (Composition Root)
                       │
              ProviderRegistration (Helper Functions)
                       │
               ProviderRegistry
                       │
             DependencyResolver
                       │
      Market / Memory / LLM / Cache
           (Contracts Only)