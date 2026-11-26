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
- ابزارهای C/C++ در `.agent-state/cpp-tools/` و تنظیمات آن‌ها در فایل‌های `.clang-format`، `.clang-tidy` و `.clangd` قرار دارند (راهنمای کامل: `docs/CLANG_TOOLING_GUIDE.md`).
- تولید `compile_commands.json` با تزریق خودکار `--target=xtensa-esp32-elf` و فیلتر فلگ‌های اختصاصی GCC: `bun run r -- bash ./tools/cpp.sh compiledb esp32dev` (یا `esp32dev_core3` برای Core v3).
- بررسی فرمت: `bun run r -- bash ./tools/cpp.sh format:check` (یا `format`؛ پوشه‌های `test/mocks/` و بکاپ‌های `*/original/` به‌صورت خودکار مستثنی هستند).
- تحلیل استاتیک (`cppcheck`): `bun run r -- bash ./tools/cpp.sh lint`
- تحلیل عمیق (`clang-tidy`): `bun run r -- bash ./tools/cpp.sh tidy <file.cpp>` (توجه: فایل‌های پل Core v3 شامل `NetworkClientSecure_impl.cpp`، `NetworkCore_impl.cpp` و `WiFi_impl.cpp` فقط با `compiledb esp32dev_core3` قابل بررسی هستند).
- تایپ‌چک معنایی و بررسی هدرهای اضافه (`clangd` با `UnusedIncludes: Strict`): `bun run r -- bash ./tools/cpp.sh typecheck <file.cpp>`
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
