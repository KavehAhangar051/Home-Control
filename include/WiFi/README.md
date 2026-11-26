# WiFi — High-Performance Optimized Edition (ESP32)

نسخه بهینه‌سازی‌شده اختصاصی کتابخانه **WiFi** هسته Arduino-ESP32 برای پروژه خانه هوشمند **Achaemenid IoT**؛ طراحی‌شده با هدف بیشینه‌سازی سرعت پکت‌ها، حذف تخصیص‌های پویای Heap با استفاده از حافظه آزاد SRAM داخلی، و کاهش حجم Flash.

---

## مراحل ۵ گانه بهینه‌سازی

| مرحله | عنوان | تغییرات و دستاوردهای کلیدی |
| :--- | :--- | :--- |
| **مرحله ۱** | **Optimization Libs (`FastFunction` & `SmallVector`)** | ارتقای کالبک تست اتصال `ConnectionTestCB_t` در `WiFiMulti` از `std::function` به `uniuno::FastFunction<bool(void), 32>` (بافر SBO بدون Heap)؛ جایگزینی `std::vector<WifiAPlist_t>` با `uniuno::SmallVector<WifiAPlist_t, 8>`. |
| **مرحله ۲** | **Memory-for-Speed (Zero-Heap Buffers)** | فعال‌سازی پیش‌فرض بافرهای استاتیک DMA در درایور WiFi (`_wifiUseStaticBuffers = true`) جهت حذف تخصیص و آزادسازی پویای بافرهای TX/RX؛ اختصاص استخر ایستا برای اسکن (`s_staticScanPool[16]`) در `WiFiScan.cpp` جهت حذف `calloc`/`free`؛ ذخیره ثابت `ssid`/`passphrase` در `WifiAPlist_t` و خواندن مستقیم `getScanInfoByIndex` به جای ساخت `String`های موقت در `WiFiMulti.cpp`. |
| **مرحله ۳** | **Flash De-bloating** | حذف سوئیچ‌کیس‌های حجیم و جدول پرش در `STA.cpp` (`disconnectReasonName` با جدول متراکم O(1) برای کدهای ۱ تا ۳۹ و جدول خطی کدهای پراکنده) و حذف حلقه ۸ شاخه‌ای محاسبه CIDR و IPv4 در `WiFiGeneric.cpp`؛ ادغام رشته‌های لاگ تکراری در `WiFiMulti.cpp`. |
| **مرحله ۴** | **Xtensa LX6 Hardware Primitives (`WiFiAsm.h`)** | پیاده‌سازی [`WiFiAsm.h`](WiFiAsm.h) شامل جدول بیت‌مسک بدون پرش (`isReconnectableReason` با استخراج بیتی `extui`-سازگار)، فرمت‌کننده سریع آدرس MAC بدون نیاز به `snprintf` (`formatMacStr`)، مقایسه بدون پرش BSSID (`macEqual`) و محاسبه تک‌دستوری CIDR (`subnetCidr32` با `__builtin_popcount`). |
| **مرحله ۵** | **Modular Architecture & Documentation** | جداسازی کامل از سورس فریمورک از طریق بریج کامپایل `WiFi_impl.cpp` و `lib_ignore`، گارد تداخل نمادهای استاتیک (`_WIFI_STRNCPY_DEFINED`)، مستندسازی استاندارد و نگهداری نسخه دست‌نخورده در `original/`. |

---

## ساختار فایل‌ها

```text
Hardware/include/WiFi/
├── WiFiAsm.h            # توابع سطح پایین Xtensa LX6 (بیت‌مسک بدون پرش، فرمت MAC، ریاضی IPv4)
├── WiFi.h / WiFi.cpp    # کلاس اصلی WiFiClass و رابط عمومی
├── WiFiGeneric.h / .cpp # مدیریت درایور سطح پایین، بافرهای DMA استاتیک و محاسبات شبکه
├── WiFiSTA.h / STA.cpp  # مدیریت کلاینت ایستگاه (Station) و جدول بهینه کدهای قطع اتصال
├── WiFiAP.h / AP.cpp    # مدیریت حالت Access Point و پورتال راه‌اندازی محلی
├── WiFiScan.h / .cpp    # اسکن شبکه‌ها با استخر حافظه ایستا s_staticScanPool
├── WiFiMulti.h / .cpp   # انتخاب بهترین AP بدون تخصیص Heap (SmallVector + FastFunction)
└── original/            # نسخه پشتیبان دست‌نخورده برای مقایسه و مرجع
```

---

## تنظیمات بیلد در PlatformIO

در فایل `platformio.ini`:
```ini
build_flags =
    -I Hardware/include/WiFi
lib_ignore = ..., WiFi
```
تمامی واحدهای کامپایل از طریق [`WiFi_impl.cpp`](../../firmware/src/core/WiFi_impl.cpp) به صورت یکپارچه کامپایل می‌شوند.

---

## آمار حافظه (تأییدشده در بیلد `esp32dev`)

| معیار | پیش از بهینه‌سازی WiFi | پس از بهینه‌سازی ۵ مرحله‌ای WiFi | تغییر |
| :--- | :---: | :---: | :---: |
| **RAM ایستا (DRAM)** | 115,456 بایت (35.2%) | **117,560 بایت (35.9%)** | +2,104 بایت (استخر اسکن و آرایه ثابت AP) |
| **Flash (کد و RODATA)** | 1,216,009 بایت (61.8%) | **1,215,281 بایت (61.8%)** | **-728 بایت کاهش مصرف Flash** |

