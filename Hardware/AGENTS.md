# ترجیحات کلی پروژه و قوانین کار با ابزارهای بهینه‌سازی (`cbm` و `rtk`)

## ۱. کشف ساختار با `codebase-memory-mcp` (`cbm`)
- ابزار **`codebase-memory-mcp` (`v0.12.1`)** برای گراف دانش کد (`app-applet`) پیکربندی شده است.
- **کشف مسیر و گراف کد (Hybrid):** هر وقت مسیر فایل/تابع را نمی‌دانی یا دنبال `search_graph`، `trace_path`، `query_graph`، `get_code_snippet`، `get_architecture` یا `detect_changes` هستی، از دستور زیر استفاده کن:
  - `bun run r -- bun run cbm <tool> --project app-applet ...` (یا `npm run r -- npm run cbm <tool> --project app-applet ...`)
- به‌محض شناخت مسیر فایل، بلافاصله سراغ `view_file` موازی یا `bun run r -- grep` برو.
- پس از تغییرات معنادار در کد (C++/TypeScript/اسکریپت‌ها)، گراف را بروزرسانی کن:
  - `bun run cbm:index` (یا `npm run cbm:index`) — این دستور گراف را در `.codebase-memory/graph.db.zst` ذخیره می‌کند تا در ایمپورت مجدد از گیت‌هاب نیز حفظ شود.
- دستورات کاربردی `cbm`:
  - لیست پروژه‌ها: `bun run cbm list_projects`
  - جستجوی گراف نمادها: `bun run cbm search_graph --project app-applet --name_pattern "<Pattern>" --limit 20`
  - ردیابی مسیر فراخوانی: `bun run cbm trace_path --project app-applet --function_name "<Func>" --direction both`
  - معماری پروژه: `bun run cbm get_architecture --project app-applet --aspects all`
  - مدیریت تصمیمات معماری (ADR): `bun run cbm manage_adr --project app-applet ...`

## ۲. بهینه‌سازی توکن (`rtk` - Rust Token Killer | Lite Mode)
- ابزار **`rtk` (`v1.2.1`)** روی حالت **Lite Mode** (تمدید `rtk:default` و `rtk:terse` در `.rtk/pipeline.toml`) در این مخزن پیکربندی و فعال است.
- **اجرای یکپارچه دستورات شل با `r`:** تمام دستورات ترمینال (`git`، `grep`، `rg`، `find`، `ls`، `diff`، `curl`، `npm`، `bun`، `tsc`، `test`، `build`، `cbm` و...) را حتماً از طریق یکی از روش‌های زیر اجرا کن:
  - `bun run r -- <cmd>` (یا `npm run r -- <cmd>` یا `bash ./tools/r <cmd>`)
- این wrapper قبل از هر دستور:
  1. در صورت ریست شدن کانتینر AI Studio یا ایمپورت جدید از گیت‌هاب، به‌صورت خودکار باینری، symlinkها و کش `rtk` و `codebase-memory-mcp` و مجوز `+x` اسکریپت‌ها را بازیابی و دیمن `cbm` را استارت می‌کند.
  2. دستورها را به‌صورت شفاف از طریق `rtk` اجرا و خروجی‌های حجیم را در Lite Mode فشرده می‌کند و آمار را در دیتابیس دائمی ذخیره می‌نماید (`cbm` بدون passthrough بریده‌شده اجرا می‌شود).
- **حفظ دائمی داده‌ها و تنظیمات:**
  - داده‌های `rtk` (`config.toml`, `pipeline.toml`, `history.db`, `recall.db`) در `<repo>/.agent-state/rtk/` نگهداری می‌شوند.
  - گراف دائمی `codebase-memory-mcp` در `<repo>/.codebase-memory/graph.db.zst` (و پشتیبان کش محلی در `<repo>/.agent-state/cbm/`) نگهداری می‌شود تا در چت‌های جدید، ریست کانتینر و حتی حذف پروژه و ایمپورت مجدد از گیت‌هاب از بین نروند.
- **دستورات مفید بررسی و نگهداری:**
  - بررسی سلامت کامل هر دو ابزار: `bun run tools:check` (یا `npm run tools:check`)
  - مشاهده آمار صرفه‌جویی توکن: `bun run rtk:gain`
  - بازیابی خروجی کامل بریده‌شده: `rtk recall <hash>`
  - اجرای بدون فیلتر در موارد خاص: `rtk bypass <cmd>`
  - بازسازی دستی ابزارها: `bun run rtk:setup` و `bun run cbm:setup`

## ۳. نحوه پاسخ‌گویی و استاندارد کد
- خلاصه، دقیق و صادق باش؛ از اغراق، تکرار و توضیحات اضافه پرهیز کن.
- برای ویرایش‌های محدود، کل فایل را بازنویسی نکن. هرگز `.env`، `.agent-state/rtk/data/history.db` یا `.codebase-memory/graph.db.zst` را حذف نکن.
- کارهای مستقل (خواندن/ویرایش فایل‌ها) را موازی انجام بده.
- پیش از تحویل تغییرات کد، `lint` / `typecheck` / `build` را از طریق `r` اجرا و بررسی کن.
