# Execution Lifecycle - v9.0.0

## 🎯 هدف این Commit
ارتقای `ToolExecutor` از یک Executor ساده به یک **Execution Runtime** کامل با:
- ✅ AbortSignal end-to-end
- ✅ State Machine با transition validation
- ✅ Decomposition به سه کلاس (ToolExecutor, ExecutionEngine, ExecutionAttempt)
- ✅ Observer pattern برای extensibility
- ✅ ExecutionSnapshot به عنوان single source of truth
- ✅ ExecutionMetrics برای observability

---

## 🏗️ معماری جدید

### Decomposition: سه لایه مجزا
1. **ToolExecutor (Facade)**: API عمومی، مدیریت metadata، Delegate به Engine
2. **ExecutionEngine (Orchestrator)**: Retry loop, State transitions, Policy application, Metrics aggregation, Observer hooks, Abort-aware delay
3. **ExecutionAttempt (Single Attempt)**: اجرای یک attempt واحد، Timeout enforcement، AbortSignal checking، Snapshot creation، Hook isolation

---

## 🔄 ExecutionState Machine

### States & Transitions:
- `QUEUED` → `STARTING` → `RUNNING` → `COMPLETED` / `FAILED` / `CANCELLING`
- `RUNNING` → `RETRYING` → `RUNNING` (retry loop)
- `RUNNING` → `CANCELLING` → `CANCELLED` (abort)
- Terminal states: `COMPLETED`, `FAILED`, `CANCELLED` (بدون خروجی)

---

## 🚫 AbortSignal Semantics

### تفکیک Timeout از Abort:
- **Timeout**: سیستم execution را قطع کرده (internal) → `TIMEOUT` category
- **Abort**: caller/upstream لغو کرده (external) → `ABORT` category

### Abort در نقاط مختلف:
1. **Before start**: Execution وارد `CANCELLED` می‌شود، هیچ attemptی اجرا نمی‌شود، `onCancel` صدا زده می‌شود.
2. **During running**: State از `RUNNING` به `CANCELLING` و بعد `CANCELLED`، Retry متوقف می‌شود.
3. **During backoff**: Sleep/backoff abortable است (`delayWithAbort`)، Attempt بعدی شروع نمی‌شود.

> **نکته:** `ABORT` همیشه `non-retryable` است.

---

## 👁️ Observer Pattern

### Hookهای موجود:
- `beforeExecute`, `afterExecute`
- `beforeRetry`, `afterRetry`
- `onFailure`, `onTimeout`, `onCancel`

### Hook Isolation:
خطای hookها باعث failure execution اصلی نمی‌شود. خطاها لاگ می‌شوند ولی execution ادامه می‌یابد.

---

## 📊 ExecutionSnapshot & Metrics

### Single Source of Truth:
هر state transition یک `ExecutionSnapshot` جدید و **Immutable** می‌سازد که شامل:
- `state` و `stateReason`
- `attempt` و `startedAt`/`finishedAt`
- `metrics` (queuedDuration, runningDuration, retryDelayDuration, totalDuration)
- `retryHistory` و `lastError`

---

## 🔄 Migration Notes

### Breaking Changes: **هیچ**
- تمام APIهای عمومی backward-compatible هستند.
- `IToolExecutorHook` به `IExecutionObserver` تغییر نام داده (اما alias قدیمی برای backward compatibility حفظ شده).

### Behavioral Changes:
1. متدها حالا `signal?: AbortSignal` می‌پذیرند.
2. خطاهای abort به عنوان `ABORT` دسته‌بندی می‌شوند (نه `UNKNOWN`).

---

## 🎯 خلاصه
Commit 9 یک **refactor معماری** است که یک **Execution Runtime** در سطح production-ready ایجاد کرد، تمام اصول SOLID را رعایت کرد و پایه‌ای مستحکم برای Commitهای بعدی (Service Layer, Market Data Engine) فراهم نمود.