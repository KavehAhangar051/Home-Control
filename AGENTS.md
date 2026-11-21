# ترجیحات کلی پروژه و قوانین کار با ابزارهای توسعه (`cbm`، `rtk` و `pio`)

## ۱. کشف ساختار با `codebase-memory-mcp` (`cbm`)
- ابزار **`codebase-memory-mcp` (`v0.12.1`)** برای گراف دانش کد (`app-applet`) پیکربندی شده است.
- **کشف مسیر و گراف کد (Hybrid):** هر وقت مسیر فایل/تابع را نمی‌دانی یا دنبال `search_graph`، `trace_path`، `query_graph`، `get_code_snippet`، `get_architecture` یا `detect_changes` هستی، از دستور زیر استفاده کن:
  - `bun run r -- bun run cbm <tool> --project app-applet ...` (یا `npm run r -- npm run cbm <tool> --project app-applet ...`)
- به‌محض شناخت مسیر فایل، بلافاصله سراغ `view_file` موازی یا `bun run r -- grep` برو.
- پس از تغییرات معنادار در کد (C++/TypeScript/اسکریپت‌ها)، گراف را بروزرسانی کن:
  - `bun run cbm:index` (یا `npm run cbm:index`) — این دستور گراف را در `.codebase-memory/graph.db.zst` ذخیره می‌کند تا در ایمپورت مجدد از گیت‌هاب نیز حفظ شود.

## ۲. بهینه‌سازی توکن (`rtk` - Rust Token Killer | Lite Mode)
- ابزار **`rtk` (`v1.2.1`)** روی حالت **Lite Mode** (تمدید `rtk:default` و `rtk:terse` در `.rtk/pipeline.toml`) در این مخزن پیکربندی و فعال است.
- **اجرای یکپارچه دستورات شل با `r`:** تمام دستورات ترمینال (`git`، `grep`، `rg`، `find`، `ls`، `diff`، `curl`، `npm`، `bun`، `tsc`، `test`، `build`، `cbm`، `pio` و...) را حتماً از طریق یکی از روش‌های زیر اجرا کن:
  - `bun run r -- <cmd>` (یا `npm run r -- <cmd>` یا `bash ./tools/r <cmd>`)
- این wrapper قبل از هر دستور:
  1. در صورت ریست شدن کانتینر AI Studio یا ایمپورت جدید از گیت‌هاب، به‌صورت خودکار باینری، venv، symlinkها و کش `rtk`، `codebase-memory-mcp` و `PlatformIO` و مجوز `+x` اسکریپت‌ها را بازیابی می‌کند.
  2. خروجی دستورات عمومی را با `rtk` در Lite Mode فشرده و در `history.db` ثبت می‌کند (`rtk recall <hash>` برای متن کامل و `rtk bypass <cmd>` برای اجرای بدون فیلتر).

## ۳. کامپایل و تست فریم‌ور با `PlatformIO` (`pio`)
- ابزار **`PlatformIO Core` (`v6.2.0`)** همراه با محیط مجازی پایتون (`penv`)، پلتفرم‌ها و پکیج‌ها به‌صورت دائمی در `<repo>/.agent-state/platformio/` (`PLATFORMIO_CORE_DIR`) نگهداری و به `~/.platformio` و `/usr/local/bin/pio` متصل شده است.
- **دستورات کاربردی PlatformIO:**
  - تست‌های بومی: `bun run r -- pio test -e native` (و `native_core3`)
  - بیلد ESP32 Core v2: `bun run r -- pio run -e esp32dev`
  - بیلد ESP32 Core v3: `bun run r -- pio run -e esp32dev_core3`
  - نصب/بروزرسانی کامل تمام پلتفرم‌ها و کتابخانه‌ها: `bun run pio:setup`

## ۴. حفظ دائمی داده‌ها و بررسی سلامت
- داده‌های `rtk` در `<repo>/.agent-state/rtk/`، گراف `cbm` در `<repo>/.codebase-memory/graph.db.zst` (و کش پشتیبان در `.agent-state/cbm/`) و کل محیط/پکیج‌های `PlatformIO` در `<repo>/.agent-state/platformio/` و `.pio/` ذخیره می‌شوند.
- بررسی سلامت کل ابزارها: `bun run tools:check` (یا `npm run tools:check`)
- مشاهده آمار صرفه‌جویی توکن: `bun run rtk:gain`

## ۵. نحوه پاسخ‌گویی و استاندارد کد
- خلاصه، دقیق و صادق باش؛ از اغراق، تکرار و توضیحات اضافه پرهیز کن.
- برای ویرایش‌های محدود، کل فایل را بازنویسی نکن. هرگز `.env`، `.agent-state/rtk/data/history.db` یا `.codebase-memory/graph.db.zst` را حذف نکن.
- کارهای مستقل (خواندن/ویرایش فایل‌ها) را موازی انجام بده.
- پیش از تحویل تغییرات کد، `lint` / `typecheck` / `build` را از طریق `r` اجرا و بررسی کن.
