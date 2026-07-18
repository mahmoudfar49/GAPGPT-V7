# Versioning Policy - v1.0.0

## 🎯 هدف این سند

ثبت رسمی سیاست نسخه‌بندی پروژه GAPGPT بر اساس **Semantic Versioning (SemVer 2.0.0)** و تعیین معیارهای رسیدن به نسخه **v1.0.0**.

---

## 📊 تاریخچه نسخه‌ها

| Git Tag | Commit | توضیح |
|---------|--------|-------|
| v0.3.0 | Commit 3 | Infrastructure Foundation |
| v0.5.0 | Commit 5 | Enterprise Features |
| v0.6.0 | Commit 6 | Runtime Core |
| v0.7.0 | Commit 7 | Tool Framework |
| v0.8.1 | Commit 8 | Smart Retry Classification (Refactored) |
| **v0.9.0** | **Commit 9** | **Execution Runtime (Baseline)** |

---

## 🌿 شاخه‌های بلندمدت

### `release/v0.9` (Baseline Runtime)
- **نقطه بازگشت**: اگر در Commitهای بعدی بازطراحی بزرگ انجام شود
- **Long-Term Reference**: مبنای تمام توسعه‌های بعدی
- **Hotfix Target**: اگر نیاز به patch برای v0.9 باشد

### `main` (Development)
- توسعه فعال در این شاخه ادامه می‌یابد
- هر Commit جدید از این شاخه منشعب می‌شود

---

## 📐 سیاست Semantic Versioning

### فرمت: `MAJOR.MINOR.PATCH`

#### MAJOR (x.0.0)
تغییرات **backward-incompatible** در API عمومی.

**مثال:** حذف یک متد عمومی، تغییر signature یک interface.

#### MINOR (0.x.0)
اضافه شدن **features جدید** به صورت backward-compatible.

**مثال:** اضافه شدن یک Observer hook جدید، اضافه شدن یک ErrorCategory.

#### PATCH (0.0.x)
**Bug fixes** و اصلاحات بدون تغییر API.

**مثال:** رفع یک خطای runtime، بهبود performance.

---

## 🗺️ Roadmap تا v1.0.0

| Commit | Git Tag | عنوان | وضعیت |
|--------|---------|-------|--------|
| Commit 9 | v0.9.0 | Execution Runtime | ✅ **FROZEN** |
| Commit 10 | v0.10.0 | ExecutionStateMachine + Advanced Metrics | ⏳ Next |
| Commit 11 | v0.11.0 | Service Layer & Dependency Injection | ⏳ |
| Commit 12 | v0.12.0 | Market Data Engine (اولین ابزار واقعی) | ⏳ |
| Commit 13 | v0.13.0 | EventBus & Telemetry | ⏳ |
| Commit 14 | v0.14.0 | Memory & Provider Layer | ⏳ |
| Commit 15 | v0.15.0 | Planner اولیه | ⏳ |
| Commit 16 | v0.16.0 | Multi Tool Pipeline | ⏳ |
| **v1.0.0** | - | **Stable Runtime Release** | 🎯 Target |

---

## 🎯 معیارهای v1.0.0

پروژه زمانی به **v1.0.0** می‌رسد که این **پنج لایه** کامل شوند:

### 1. ✅ Execution Runtime (تکمیل‌شده در v0.9.0)
- [x] AbortSignal end-to-end
- [x] State Machine
- [x] Observer Pattern
- [x] ExecutionSnapshot
- [x] ExecutionMetrics
- [ ] ExecutionStateMachine (کلاس مستقل) - Commit 10

### 2. ⏳ Service Layer (Commit 11)
- [ ] Service Container
- [ ] Provider Registry
- [ ] Lifetime Management (Singleton/Scoped/Transient)
- [ ] Configuration Resolution

### 3. ✅ Tool Framework (تکمیل‌شده در v0.7.0)
- [x] Tool Registry
- [x] Tool Executor
- [x] Tool Pipeline
- [x] Smart Retry Classification

### 4. ⏳ Market Data Engine (Commit 12)
- [ ] SymbolLookupTool
- [ ] MarketDataProvider
- [ ] Cache Layer
- [ ] Rate Limiter
- [ ] Data Source Abstraction

### 5. ⏳ Memory & Provider Layer (Commit 14)
- [ ] Memory Provider Interface
- [ ] Vector Store Integration
- [ ] LLM Provider Abstraction
- [ ] Prompt Execution Pipeline

---

## 📏 قوانین نسخه‌بندی

### قانون 1: هر Commit یک نسخه
هر Commit که به مرحله Freeze می‌رسد، یک تگ نسخه می‌گیرد.

### قانون 2: MINOR برای features جدید
اکثر Commitهای فعلی MINOR هستند (features جدید با backward compatibility).

### قانون 3: PATCH فقط برای hotfix
اگر بعد از Freeze نیاز به اصلاح فوری باشد، PATCH استفاده می‌شود.

### قانون 4: MAJOR فقط در v1.0.0+
تا قبل از v1.0.0، MAJOR تغییر نمی‌کند (همه در 0.x.x هستند).

### قانون 5: Release Branch برای Baselines
نسخه‌های مهم (مثل v0.9.0) یک شاخه `release/vX.Y` دارند.

---

## 🔄 Migration از نسخه‌های قبلی

### از v0.8.1 به v0.9.0
- **Breaking Changes**: هیچ
- **Behavioral Changes**: 
  - AbortSignal support اضافه شد
  - Observer pattern معرفی شد
  - Decomposition به سه کلاس

### از v0.9.0 به v0.10.0 (پیش‌بینی)
- **Breaking Changes**: احتمالاً هیچ
- **Features جدید**:
  - ExecutionStateMachine
  - Attempt-level Metrics
  - ExecutionContext extensions

---

## 📚 منابع

- [Semantic Versioning 2.0.0](https://semver.org/)
- [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/)
- ADR Pattern: Architecture Decision Records

---

## 🎯 خلاصه

این سند سیاست رسمی نسخه‌بندی پروژه GAPGPT را ثبت می‌کند:

1. ✅ **SemVer 2.0.0** از این به بعد استفاده می‌شود
2. ✅ **v0.9.0** به عنوان **Baseline Runtime** تثبیت شده
3. ✅ شاخه **`release/v0.9`** برای Long-Term Reference ایجاد شده
4. ✅ **۵ معیار مشخص** برای رسیدن به **v1.0.0** تعریف شده
5. ✅ **Roadmap تا v1.0.0** مستند شده

---
*این سند به عنوان Architecture Decision Record (ADR) برای سیاست نسخه‌بندی پروژه ثبت شده است.*
