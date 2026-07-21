# ADR-012: Provider Foundation & MemoryProvider

- **Status:** FROZEN 🟢
- **Commit:** 12
- **Date:** 2026-07-21

## Context
پس از تکمیل DI (Commit 10/11)، نیاز به یک الگوی استاندارد برای Providerها وجود داشت تا از نشت لایه‌ها جلوگیری شود و چرخه حیات (Lifecycle) به صورت متمرکز مدیریت گردد.

## Decision
1. **BaseProvider:** کلاس پایه‌ای با State Machine داخلی (`CREATED` → `INITIALIZING` → `READY` → `DISPOSED`) و الگوی Guard (`ensureState`).
2. **Type Safety:** ارتقای قراردادها از `any` به `unknown` در `ProviderContracts.v12.0.0` و استفاده از `ServiceToken<T>` به جای `ServiceToken<any>`.
3. **Immutability:** استفاده از `Object.freeze` برای `metadata` و `capabilities`.
4. **Separation:** پیاده‌سازی‌های واقعی (مانند `MemoryProvider`) در لایه `infrastructure` قرار می‌گیرند.

## Consequences
- کد به شدت Type-Safe و قابل اطمینان شد.
- افزودن Providerهای جدید (Market, LLM) اکنون از یک الگوی ثابت پیروی می‌کند.

## Non-Goals (خارج از Scope این کامیت)
- Health Check, Circuit Breaker, Retry Logic, Metrics (موکول به کامیت‌های آینده).
