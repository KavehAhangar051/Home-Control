# راهنمای زنجیره ابزار Clang و تحلیل استاتیک C/C++

این پروژه از چهار قابلیت کلیدی خانواده **LLVM/Clang** (نصب‌شده به‌صورت ایزوله در `.agent-state/cpp-tools/`) همراه با **RTK** (`bun run r -- ...`) برای حفظ کیفیت، ایمنی حافظه و یکنواختی کدهای فریم‌ور ESP32 استفاده می‌کند.

---

## ۱. همگام‌سازی پایگاه‌داده کامپایل (`compile_commands.json`)

از آنجا که فریم‌ور با کامپایلر **Xtensa GCC** (`xtensa-esp32-elf-g++`) بیلد می‌شود اما ابزارهای `clangd` و `clang-tidy` مبتنی بر LLVM/Clang هستند، اسکریپت [`tools/cpp.sh`](../tools/cpp.sh) خروجی `pio run -e <env> -t compiledb` را به‌صورت خودکار برای Clang نرمال‌سازی می‌کند:

- تزریق دقیق `--target=xtensa-esp32-elf` برای تطابق سایز اشاره‌گرها (۳۲ بیتی) و اسمبلی درون‌خطی Xtensa.
- انتخاب خودکار toolchain متناظر با هر محیط (`toolchain-xtensa-esp32` برای `esp32dev` / Core v2 و `toolchain-xtensa-esp-elf` برای `esp32dev_core3` / Core v3).
- تفکیک مسیرهای `-isystem` برای فایل‌های C و C++ و قرار دادن آن‌ها پس از مسیرهای `-I` مربوط به SDK (جهت جلوگیری از تداخل `pthread` در `gthr-default.h`).
- حذف فلگ‌های اختصاصی GCC/Xtensa (`-mlongcalls`، `-fstrict-volatile-bitfields`، `-fno-tree-*`، `-ftree-*`، `-fipa-*`، `-mfix-esp32-*`، `-fno-shrink-wrap`، `-fstack-usage`).

```bash
# همگام‌سازی برای Core v2 (محیط پیش‌فرض فعال)
bun run r -- bash ./tools/cpp.sh compiledb esp32dev

# همگام‌سازی برای Core v3
bun run r -- bash ./tools/cpp.sh compiledb esp32dev_core3
```

---

## ۲. فرمت خودکار کد (`clang-format`)

قوانین فرمت در [`.clang-format`](../.clang-format) تعریف شده‌اند. اسکریپت `tools/cpp.sh` تمامی فایل‌های فعال در `firmware/`، `include/`، `lib/` و `test/` را پوشش می‌دهد و به‌طور خودکار `test/mocks/` و نسخه‌های مرجع دست‌نخورده در `*/original/` را مستثنی می‌کند.

```bash
# اعمال فرمت روی کل پروژه
bun run r -- bash ./tools/cpp.sh format

# بررسی فرمت بدون تغییر فایل (خروجی غیرصفر در صورت عدم تطابق)
bun run r -- bash ./tools/cpp.sh format:check
```

---

## ۳. تایپ‌چک معنایی و بررسی هدرها (`clangd`)

تنظیمات در [`.clangd`](../.clangd) شامل `UnusedIncludes: Strict` و فیلتر فلگ‌های GCC است.

```bash
bun run r -- bash ./tools/cpp.sh typecheck firmware/src/main.cpp
```

### اصلاحات انجام‌شده در بازرسی `clangd`
- رفع باگ شرط IPv6 در `include/AsyncTCP/AsyncTCP.cpp` (`IP_IS_V6(ipaddr)` به جای بررسی آرایه).
- افزودن `override` در ۶ متد (`include/Timer/Timer.h` و `generic_esp_clients.hpp`) برای رفع `-Winconsistent-missing-override`.
- خودکفا کردن هدرهای پایه (`TimerCore.h`، `TimerAsm.h`، `HardwareTimer.h`، `TimerGroup.h`، `ErrorHandler.h`، `ssl_client.h` و هدرهای `AsyncMqttClient`).
- حذف هدرهای بلااستفاده در `MqttCommandDispatcher.cpp`، انتقال `CaptivePortalHelper.h` از `BootManager.h` به `BootManager.cpp` و افزودن `// IWYU pragma: export` به هدرهای Umbrella (`AchaemenidMQTT.h`، `AchaemenidWebSocketClient.h`، `AchaemenidWebSocketServer.h`).

---

## ۴. تحلیل استاتیک عمیق (`clang-tidy`)

پیکربندی در [`.clang-tidy`](../.clang-tidy) شامل دسته‌های `clang-analyzer-*`، `bugprone-*`، `performance-*` و `readability-*` است و برای الگوهای استاندارد ESP32/Arduino تنظیم شده است:

- فعال ماندن `bugprone-signed-char-misuse` برای باگ‌های واقعی `signed char` همراه با `CharTypedefsToIgnore: 'int8_t;__int8_t'` (چون در پروژه `int8_t` عمداً برای شماره پین `-1` و تریگر دوبارکلیک `-1` استفاده می‌شود).
- حذف هشدارهای کاذب ماکرو/امبدد: `bugprone-suspicious-include` (برای پل‌های `*_impl.cpp`)، `bugprone-signed-bitwise` (ماسک‌های GPIO و فلگ‌های ESP-IDF)، `bugprone-throwing-static-initialization` (محیط `-fno-exceptions`)، `readability-simplify-boolean-expr` (ماکروی `UNLIKELY(x)` با `!!(x)`)، `readability-static-accessed-through-instance` (الگوی `WiFi.mode()` و سازگاری با ماک native) و `clang-analyzer-optin.performance.Padding` (چیدمان عمدی خط کش ۳۲ بایتی `AsyncClient`).

```bash
# بررسی یک فایل خاص
bun run r -- bash ./tools/cpp.sh tidy firmware/src/main.cpp
```

### اصلاحات کلیدی انجام‌شده در بازرسی `clang-tidy`
- **ایمنی و آنالایزر (`clang-analyzer-*`):**
  - جایگزینی آرایه ۲ بایتی و `operator+=(const char*)` در `SegmentParsers.cpp` با `operator+=(char)` (رفع `UninitializedRead` و حذف `strlen`/`memcpy` در هر کاراکتر).
  - مقداردهی اولیه `copier_` در سازنده‌های `FastFunction` (رفع `UninitializedObject` در `FastFunction` و `ListenerEntry`).
  - دسترسی مستقیم به `Storage::heap_ptr` به جای `void**` type punning در `FastFunctionConstructors.h` (رفع `NewDeleteLeaks` و بهبود ایمنی strict-aliasing).
- **کارایی (`performance-*`):**
  - حذف تمام کپی‌های اضافه `WebsocketsMessage`، `String` و `uniuno::Error` در `WebSocketClient`، `WebSocketServer` و `BootManager` با `const&` و `std::move`.
- **ایمنی و خوانایی (`bugprone-*` و `readability-*`):**
  - افزودن `default: break;` به `switch`های پارسرهای MQTT (`SegmentParsers.cpp` و `StateParsers.cpp`).
  - اصلاح نوع متغیر حلقه در `PinStateManager::rebuildInputCache()` (`uint8_t` → `int` در مقایسه با `MAX_PINS`).
  - اصلاح `const`-correctness (`ArrayBase::mallocForGrow`، `GpioSwitch::updateHardware`، `BootManager::bootErrorFn` و `loadOfflineConfigFromNvs`)، استفاده از `.empty()`، ادغام `if`های تودرتو، حذف `static` اضافه در anonymous namespace و رفع ابهام `(*ptr).reset()` روی `std::unique_ptr`.

> **نکته تفکیک Core v2 / Core v3:** سه پل کامپایل `NetworkClientSecure_impl.cpp`، `NetworkCore_impl.cpp` و `WiFi_impl.cpp` مبتنی بر APIهای Arduino-ESP32 Core v3 هستند؛ هنگام کار با `compile_commands.json` نسخه `esp32dev` (Core v2)، این سه فایل باید با `esp32dev_core3` بررسی شوند.
