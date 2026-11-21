# ترجیحات کلی پروژه و قوانین کار با ابزارهای توسعه (`cbm`، `rtk`، `te` و `pio`)

## ۱. کشف ساختار با `codebase-memory-mcp` (`cbm`)
- ابزار **`codebase-memory-mcp` (`v0.12.1`)** برای گراف دانش کد (`app-applet`) پیکربندی شده است.
- **کشف مسیر و گراف کد (Hybrid):** هر وقت مسیر فایل/تابع را نمی‌دانی یا دنبال `search_graph`، `trace_path`، `query_graph`، `get_code_snippet`، `get_architecture` یا `detect_changes` هستی، از دستور زیر استفاده کن:
  - `bun run r -- bun run cbm <tool> --project app-applet ...` (یا `npm run r -- npm run cbm <tool> --project app-applet ...`)
- به‌محض شناخت مسیر فایل، بلافاصله سراغ `view_file` موازی یا `bun run r -- grep` برو.
- پس از تغییرات معنادار در کد (C++/TypeScript/اسکریپت‌ها)، گراف را بروزرسانی کن:
  - `bun run cbm:index` (یا `npm run cbm:index`) — این دستور گراف را در `.codebase-memory/graph.db.zst` ذخیره می‌کند تا در ایمپورت مجدد از گیت‌هاب نیز حفظ شود.

## ۲. بهینه‌سازی توکن (`rtk` Lite Mode و `TokenEconomizer`)
- **اجرای یکپارچه دستورات شل با `bun run r -- <cmd>`:** تمام دستورات ترمینال (`git`، `grep`، `rg`، `find`، `ls`، `diff`، `curl`، `npm`، `bun`، `tsc`، `test`، `build`، `cbm`، `pio` و...) را حتماً از طریق **`bun run r -- <cmd>`** (یا `npm run r -- <cmd>` یا `bash ./tools/r <cmd>`) اجرا کن تا هم مجوز `+x` حفظ شود، هم خروجی‌های حجیم با **`rtk` (`mode Lite`, `v1.2.1`)** فشرده و در `history.db` ثبت شوند، و هم رویدادهای واقعی `PostToolUse` و `TurnGuard` به **`microsoft/TokenEconomizer`** ارسال گردند.
  - بازیابی خروجی بریده‌شده: `rtk recall <hash>` · اجرای بدون فیلتر: `rtk bypass <cmd>` · آمار صرفه‌جویی: `bun run rtk:gain`
- **چرخه `TokenEconomizer` (`te` و `te-hook`):**
  - شروع کار/نشست: `bun run agent:start` (تزریق خودکار `envfacts` و `microskills` یادگرفته‌شده)
  - پایان کار و ثبت یادگیری: `bun run agent:end` (جمع‌بندی نشست و ذخیره دائمی `microskills`، `toolprune` و `loopguard`)
  - وضعیت و سلامت: `bun run te:status` و `bun run te:doctor` (و دستورات `te microskills`، `te toolprune show`)
  - نکته: در محیط AI Studio مقدار `effective tokens` در `te status` به‌طور طبیعی `0` است و سنجش واقعی فشرده‌سازی خروجی از `bun run rtk:gain` خوانده می‌شود.

## ۳. کامپایل و تست فریم‌ور با `PlatformIO` (`pio`)
- ابزار **`PlatformIO Core` (`v6.2.0`)** همراه با محیط مجازی پایتون (`penv`)، پلتفرم‌ها و پکیج‌ها به‌صورت دائمی در `<repo>/.agent-state/platformio/` (`PLATFORMIO_CORE_DIR`) نگهداری و به `~/.platformio` و `/usr/local/bin/pio` متصل شده است.
- **دستورات کاربردی PlatformIO:**
  - تست‌های بومی: `bun run r -- pio test -e native` (و `native_core3`)
  - بیلد ESP32 Core v2: `bun run r -- pio run -e esp32dev`
  - بیلد ESP32 Core v3: `bun run r -- pio run -e esp32dev_core3`
  - نصب/بروزرسانی کامل تمام پلتفرم‌ها و کتابخانه‌ها: `bun run pio:setup`

## ۴. حفظ دائمی داده‌ها و بررسی سلامت
- داده‌های `rtk` در `.agent-state/rtk/`، حافظه و `microskills` ابزار `TokenEconomizer` در `.agent-state/tokeneconomizer/`، گراف `cbm` در `.codebase-memory/graph.db.zst` (و کش `.agent-state/cbm/`) و کل محیط `PlatformIO` در `.agent-state/platformio/` و `.pio/` ذخیره می‌شوند.
- بررسی سلامت کل ابزارها: `bun run tools:check` (یا `npm run tools:check`)

## ۵. نحوه پاسخ‌گویی و استاندارد کد
- خلاصه، دقیق و صادق باش؛ از اغراق، تکرار و توضیحات اضافه پرهیز کن.
- برای ویرایش‌های محدود، کل فایل را بازنویسی نکن. هرگز `.env`، `.agent-state/rtk/data/history.db`، `.agent-state/tokeneconomizer/repos/` یا `.codebase-memory/graph.db.zst` را حذف نکن.
- کارهای مستقل (خواندن/ویرایش فایل‌ها) را موازی انجام بده.
- پیش از تحویل تغییرات کد، `lint` / `typecheck` / `build` را از طریق `r` اجرا و بررسی کن.
