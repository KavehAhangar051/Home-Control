# Achaemenid IoT Node — ESP32 Firmware & Tooling

فریم‌ور ماژولار، رویدادمحور (Event-Driven) و کم‌تأخیر برای نودهای خانه هوشمند مبتنی بر **ESP32** با معماری Zero-Heap در مسیرهای داغ (Hot Paths)، پشتیبانی هم‌زمان از **MQTT**، **WebSocket امن (WSS)**، سرور **WebSocket محلی**، **Captive Portal + mDNS**، موتور قوانین پیشرفته (**Rule Engine v2**) و نودهای کمکی (**Virtual Segments / Aux Nodes**).

---

## معماری و ساختار مخزن

```text
.
├── firmware/src/                 # نقطه ورود (main.cpp)، حلقه بهینه، رویدادها، تنظیمات و پل‌های کامپایل *_impl.cpp
├── lib/                          # کتابخانه‌های دامنه‌ای پروژه
│   ├── AchaemenidBootManager/    # بوت فوری آفلاین از NVS، Captive Portal، DNS/mDNS و اتصال غیرمسدودکننده Wi-Fi
│   ├── AchaemenidConfigProtocol/ # پروتکل فشرده پیکربندی (ESP_CFG_V2) و کدک باینری قوانین
│   ├── AchaemenidMQTT/           # کلاینت MQTT با پارسرهای باینری و مدیریت اتصال مجدد
│   ├── AchaemenidNetwork/        # مدیریت اتصال ناهمگام Wi-Fi
│   ├── AchaemenidRuleEngine/     # موتور قوانین (کلیک، دوبارکلیک، نگه‌داشتن، چندبازه‌ای آنالوگ و شرط‌ها)
│   ├── AchaemenidWebSocket/      # کلاینت WSS ابری و سرور WebSocket محلی
│   ├── AppEvents/                # تعریف رویدادهای سیستم
│   ├── AuxNodeManager/           # مدیریت نودهای کمکی ESP و پین‌های مجازی
│   ├── ConfigApplier/            # اعمال یکپارچه تنظیمات روی PinManager و AuxNodeManager
│   ├── GpioAdc/                  # خوانش غیرمسدودکننده SAR1 ADC1 با LUT و فیلتر
│   ├── GpioPwm/                  # درایور PWM (سازگار با LEDC Core v2 و Core v3)
│   ├── GpioSwitch/               # کنترل کلیدهای دیجیتال (Active-High / Active-Low)
│   └── PinManager/               # رجیستری پین‌ها، اسکن بیتی GPIO، تایمرهای Auto-Off و خروجی State JSON
├── include/                      # لایه‌های پایه و کتابخانه‌های بهینه‌سازی‌شده (Optimization، Events، Timer، AsyncTCP، WiFi، ...)
├── test/                         # ۸ مجموعه تست بومی (۱۳۲ تست در هر دو محیط native و native_core3)
├── .github/workflows/ci.yml      # پایپ‌لاین CI (فرمت، تست‌های بومی، clang-tidy، بیلد Core v2/v3 و وب)
├── docs/                         # مستندات فنی پروتکل‌ها، داشبورد، حافظه و ابزارهای Clang
├── tools/                        # اسکریپت‌های wrapper برای RTK (r / rtk.sh)، PlatformIO (pio.sh) و Clang (cpp.sh)
└── scripts/                      # اسکریپت‌های PlatformIO برای بیلد، خروجی prebuilt و فلش سریع
```

---

## محیط‌های PlatformIO

| محیط | کاربرد | دستور اجرا (با RTK) |
| :--- | :--- | :--- |
| `esp32dev_flash` | فلش سریع باینری آماده بدون کامپایل (پیش‌فرض) | `bun run r -- pio run -e esp32dev_flash -t upload` |
| `esp32dev_core3_flash` | فلش سریع باینری آماده Core v3 | `bun run r -- pio run -e esp32dev_core3_flash -t upload` |
| `esp32dev` | بیلد کامل از سورس روی Arduino-ESP32 Core v2 (`espressif32@^6.10.0`) | `bun run r -- pio run -e esp32dev` |
| `esp32dev_core3` | بیلد کامل از سورس روی Arduino-ESP32 Core v3 (`espressif32@8.0.0`) | `bun run r -- pio run -e esp32dev_core3` |
| `native` | اجرای تست‌های واحد روی میزبان (شبیه‌سازی Core v2) | `bun run r -- pio test -e native` |
| `native_core3` | اجرای تست‌های واحد روی میزبان (شبیه‌سازی Core v3) | `bun run r -- pio test -e native_core3` |

نصب یا بازسازی محیط PlatformIO در `.agent-state/platformio/`:
```bash
bun run pio:setup
```

---

## ابزارهای Clang و RTK

تمامی دستورات ترمینال از طریق wrapper پروژه (`bun run r -- <cmd>`) روی **RTK (حالت Lite)** اجرا می‌شوند.

```bash
# تولید compile_commands.json سازگار با Xtensa ESP32 (پیش‌فرض: esp32dev | قابل تغییر به esp32dev_core3)
bun run r -- bash ./tools/cpp.sh compiledb esp32dev

# فرمت کدهای C/C++ و بررسی فرمت (بدون دست‌زدن به test/mocks و */original/*)
bun run r -- bash ./tools/cpp.sh format
bun run r -- bash ./tools/cpp.sh format:check

# تایپ‌چک معنایی و بررسی هدرهای اضافه با clangd
bun run r -- bash ./tools/cpp.sh typecheck firmware/src/main.cpp

# تحلیل استاتیک عمیق با clang-tidy (بدون آرگومان = بررسی خودکار تمام TUهای فعال در compile_commands.json)
bun run r -- bash ./tools/cpp.sh tidy
bun run r -- bash ./tools/cpp.sh tidy firmware/src/main.cpp

# تحلیل استاتیک با cppcheck
bun run r -- bash ./tools/cpp.sh lint
```

جزئیات کامل تنظیمات، قوانین فعال و رفع باگ‌های انجام‌شده با Clang در [`docs/CLANG_TOOLING_GUIDE.md`](docs/CLANG_TOOLING_GUIDE.md) مستند شده است.

---

## مصرف حافظه و بهینه‌سازی‌های کلیدی (اندازه‌گیری‌شده روی بیلد فعلی)

| محیط | RAM استاتیک (`.data + .bss`) | Flash / `firmware.bin` | IRAM (`.iram0.text`) |
| :--- | :--- | :--- | :--- |
| **`esp32dev` (Core v2)** | `80,752 B` (`24.6%` از `327,680 B`) | `1,162,805 B` (`59.1%`) / `firmware.bin: 1,169,120 B` | `87,131 B` |
| **`esp32dev_core3` (Core v3)** | `86,324 B` (`26.3%` از `327,680 B`) | `1,302,923 B` (`66.3%`) / `firmware.bin: 1,307,712 B` | `93,727 B` |

- **مسیرهای داغ صفر-سربار (IRAM Hot Path):** تمام چک‌های دوره‌ای `loop()` (`BootManager::isPollDue()`، `isWsPollDue()`، `isWatchdogFeedDue()` و اسکن تک‌مرحله‌ای رجیسترهای GPIO) مستقیماً در IRAM اینلاین شده‌اند؛ در تیک‌های عادی هیچ فراخوانی به Flash یا `callx8` غیرمستقیم انجام نمی‌شود.
- **Zero-Heap SBO & Hardware Crypto:** کالبک‌های `FastFunction<..., 16>` (`32 B` کل، صفر تخصیص Heap تأییدشده با `nm`)، `-fno-exceptions` و `-fno-rtti` روی واحدهای C++ و شتاب‌دهنده سخت‌افزاری `mbedtls_sha1` برای Handshake وب‌سوکت فعال است.

---

## مستندات فنی (`docs/`)

- [`docs/CLANG_TOOLING_GUIDE.md`](docs/CLANG_TOOLING_GUIDE.md) — راهنمای ابزارهای `clang-format`، `clang-tidy`، `clangd` و `compile_commands.json`
- [`docs/RAM_OPTIMIZATION_REVERT_GUIDE.md`](docs/RAM_OPTIMIZATION_REVERT_GUIDE.md) — مستندات فاز ۱ و ۲ بهینه‌سازی RAM، Flash و نقاط داغ (بیش از ۵۴KB صرفه‌جویی RAM + تا ۶۶.۸KB Flash) و روش بازگردانی
- [`docs/ANALOG_INPUT_SPEC.md`](docs/ANALOG_INPUT_SPEC.md) — مشخصات ورودی آنالوگ (ADC1، هیسترزیس و کالیبراسیون)
- [`docs/ANALOG_OUTPUT_SPEC.md`](docs/ANALOG_OUTPUT_SPEC.md) — مشخصات خروجی آنالوگ (PWM / LEDC)
- [`docs/RULE_ENGINE_V2_DASHBOARD_SPEC.md`](docs/RULE_ENGINE_V2_DASHBOARD_SPEC.md) — مشخصات موتور قوانین v2 (چندبازه‌ای، دوبارکلیک و شرط‌ها)
- [`docs/VIRTUAL_SEGMENTS_DASHBOARD_SPEC.md`](docs/VIRTUAL_SEGMENTS_DASHBOARD_SPEC.md) — مشخصات سگمنت‌های مجازی و نودهای کمکی
- [`docs/SEGMENT_ID_SYNC_DASHBOARD_SPEC.md`](docs/SEGMENT_ID_SYNC_DASHBOARD_SPEC.md) — همگام‌سازی شناسه سگمنت‌ها
- [`docs/WIFI_MQTT_DASHBOARD_SPEC.md`](docs/WIFI_MQTT_DASHBOARD_SPEC.md) — مشخصات پیکربندی Wi-Fi، SoftAP، mDNS و MQTT
- [`docs/COMMAND_ACK_UI_DASHBOARD_SPEC.md`](docs/COMMAND_ACK_UI_DASHBOARD_SPEC.md) — مشخصات تأیید فرمان‌ها (ACK) در داشبورد
- [`AGENTS.md`](AGENTS.md) — دستورالعمل‌های استاندارد توسعه و اجرای دستورات
