# دستورالعمل‌های توسعه بخش سخت‌افزار

## ۱. اجرای دستورات
- برای اجرای دستورات ترمینال از `bun run r -- <cmd>` (یا `npm run r -- <cmd>`) استفاده کن.
- این wrapper در صورت پشتیبانی، دستورات را از طریق RTK در حالت Lite اجرا می‌کند؛ دستورات دیگر را مستقیم اجرا می‌کند.
- برای اجرای مستقیم و بدون بازنویسی RTK از `bun run r -- --raw <cmd>` استفاده کن.

## ۲. کامپایل و تست فریم‌ور با PlatformIO
- داده‌ها، محیط مجازی پایتون، پلتفرم‌ها و پکیج‌های PlatformIO در `.agent-state/platformio/` نگهداری می‌شوند.
- تست‌های بومی: `bun run r -- pio test -e native` (و `native_core3`)
- بیلد ESP32 Core v2: `bun run r -- pio run -e esp32dev`
- بیلد ESP32 Core v3: `bun run r -- pio run -e esp32dev_core3`
- نصب/بروزرسانی محیط‌ها و کتابخانه‌ها: `bun run pio:setup`

## ۳. ابزارهای Format، Lint، تایپ‌چک و تحلیل استاتیک C/C++
- ابزارهای C/C++ در `.agent-state/cpp-tools/` و تنظیمات آن‌ها در فایل‌های `.clang-format`، `.clang-tidy` و `.clangd` قرار دارند.
- تولید `compile_commands.json`: `bun run cpp:compiledb`
- بررسی فرمت: `bun run cpp:format:check` (یا `bun run cpp:format`)
- تحلیل استاتیک: `bun run cpp:lint`
- تحلیل عمیق: `bun run cpp:tidy`
- تایپ‌چک معنایی: `bun run cpp:typecheck`
- نصب/تعمیر ابزارها: `bun run cpp:setup`

## ۴. نگهداری داده‌ها
- پیکربندی و تاریخچه RTK در `.agent-state/rtk/` نگهداری می‌شوند.
- محیط PlatformIO در `.agent-state/platformio/` و ابزارهای C/C++ در `.agent-state/cpp-tools/` نگهداری می‌شوند.
- فایل‌های محلی و محیطی مانند `.env` را حذف یا بازنویسی نکن.

## ۵. استاندارد کار
- خلاصه، دقیق و صادق باش؛ از تکرار و توضیحات اضافه پرهیز کن.
- برای ویرایش‌های محدود، کل فایل را بی‌دلیل بازنویسی نکن.
- کارهای مستقل خواندن و ویرایش را موازی انجام بده.
- پیش از تحویل تغییرات کد، lint، typecheck و build مرتبط را اجرا و نتیجه را بررسی کن.
