# Service Layer Foundation - v10.0.0

## 🎯 Goals
- Introduce a lightweight, type-safe Dependency Injection (DI) foundation.
- Decouple service consumption (`IServiceResolver`) from service management (`IServiceContainer`).
- Establish clear contracts (`IProvider`, `ProviderContracts`) for future external integrations (Market, Memory, LLM, Cache).
- Maintain strict backward compatibility with the Execution Runtime (Commit 9).

## 🚫 Non-Goals (Out of Scope for Commit 10)
- **Concrete Providers**: No actual implementations of Market, Memory, LLM, or Cache providers.
- **Auto-Wiring / Reflection**: Dependencies must be explicitly declared or resolved.
- **Constructor Injection Graph**: The container does not automatically inspect constructor parameters.
- **Circular Dependency Detection (Advanced)**: Basic detection via resolution stack is implemented, but no complex graph analysis.
- **Async Factories**: Factories are currently synchronous.
- **Scoped Context**: `Scoped` lifetime is a placeholder and behaves identically to `Transient` until a true request/session context is established.

## 🏗️ Architecture

### Dependency Rule
```text
types
  ↓
core
  ↓
providers (contracts only)
  ↓
ToolExecutor (Integration Point)