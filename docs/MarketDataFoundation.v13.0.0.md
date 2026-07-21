# ADR-013: Market Data Provider Foundation

- **Status:** Draft 🟡
- **Commit:** 13
- **Date:** 2026-07-21

## Context

پس از تکمیل Provider Foundation (Commit 12)، نیاز به ساخت اولین Provider واقعی برای داده‌های بازار وجود داشت. اما رفتن مستقیم به سمت MarketScanner بدون داشتن یک لایه داده استاندارد و تست‌شده، می‌توانست منجر به Refactorهای سنگین در آینده شود (به دلیل تغییر فرمت داده، Rate Limit، نرمال‌سازی و غیره).

## Decision

### ۱. تعریف قراردادهای مستقل (Standalone Contracts)
- `IMarketDataProvider` به صورت مستقل تعریف شد (بدون ارث از `IProvider`)
- دلیل: حفظ خلوص Layered Architecture و جلوگیری از وابستگی لایه `types` به `core`
- نتیجه: جداسازی کامل مسئولیت‌ها و رعایت اصل Interface Segregation

### ۲. استانداردسازی زمان (Timestamp Normalization)
- تمام Timestampها به **UTC Epoch milliseconds** تبدیل می‌شوند
- دلیل: اسکنر و لایه‌های بالاتر کاملاً Timezone-Agnostic عمل می‌کنند
- نتیجه: یکپارچگی داده‌ها از منابع مختلف (TSE, Crypto, Forex)

### ۳. استراتژی TTL پویا (Dynamic TTL)
- نگاشت `DEFAULT_CANDLE_TTL_MS` بر اساس `CandleInterval` تعریف شد
- مثال: کش روزانه (1d) = 24 ساعت، کش دقیقه‌ای (1m) = 1 دقیقه
- دلیل: بهینه‌سازی مصرف حافظه و افزایش سرعت پاسخ‌دهی
- نتیجه: کاهش بار روی Providerهای خارجی

### ۴. Cache-Aside Pattern
- `TseMarketProvider` از `MemoryProvider` به عنوان کش استفاده می‌کند
- الگو: Check Cache → Fetch (if miss) → Normalize → Store in Cache → Return
- دلیل: جداسازی منطق کش از منطق Provider
- نتیجه: قابلیت جایگزینی آسان MemoryProvider با Redis/SQLite در آینده

### ۵. یکسان‌سازی خطاها (Unified Errors)
- خطاهای خام HTTP/Parsing به خطاهای Domain-Specific نگاشت می‌شوند:
  - `ProviderNetworkError`
  - `ProviderRateLimitError`
  - `DataParsingError`
- دلیل: لایه اسکنر نیازی به هندل کردن خطاهای خام ندارد
- نتیجه: کد تمیزتر و قابل نگهداری‌تر

### ۶. Mock Implementation برای تست
- `TseMarketProvider` در این فاز داده‌های Mock برمی‌گرداند
- دلیل: تست سریع چرخه کامل بدون وابستگی به API واقعی
- نتیجه: امکان تست Cache-Aside و Normalize بدون نیاز به اینترنت

## Consequences

### مثبت:
- ✅ لایه داده کاملاً تست‌شده و قابل اتکا
- ✅ اسکنر می‌تواند فقط با تایپ‌های داخلی کار کند
- ✅ اضافه کردن Providerهای جدید (Crypto, Forex) بسیار ساده شد
- ✅ کش و Rate Limiting به صورت متمرکز مدیریت می‌شوند

### منفی:
- ⚠️ فعلاً داده‌های Mock هستند (نیاز به پیاده‌سازی HTTP در آینده)
- ⚠️ `MemoryProvider` از TTL native پشتیبانی نمی‌کند (نیاز به بهبود در آینده)

## Non-Goals (خارج از Scope این کامیت)

- ❌ منطق کامل MarketScanner
- ❌ فیلترهای تکنیکال (Gann/Fibo)
- ❌ Multi-provider aggregation
- ❌ Persistence database (SQLite/Redis)
- ❌ WebSocket/Live stream

## Future Work (کامیت‌های آینده)

- **Commit 14:** پیاده‌سازی HTTP Client واقعی برای TseMarketProvider
- **Commit 15:** اضافه کردن SQLiteProvider برای کش پایدار
- **Commit 16:** اضافه کردن RedisProvider برای کش توزیع‌شده
- **Commit 17:** پیاده‌سازی MarketScanner با استفاده از IMarketDataProvider

## Testing

تمام ۲۱ سناریوی تست با موفقیت پاس شدند:
- State Machine (۱ تست)
- getSymbolInfo (۵ تست)
- getCandles (۵ تست)
- Cache-Aside (۳ تست)
- getHealthStatus (۳ تست)
- DI Integration (۱ تست)
- Dispose (۱ تست)
- **مجموع: ۲۱/۲۱ ✅**
