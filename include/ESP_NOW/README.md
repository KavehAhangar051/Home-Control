# بهینه‌سازی 5 مرحله‌ای کتابخانه ESP-NOW (`Hardware/include/ESP_NOW`)

نسخه بومی‌سازی و بهینه‌شده کتابخانه `ESP_NOW` برای برد ESP32 تحت پروژه Home-Control (سازگار با هر دو نسخه `ESP-IDF v4.4` و `ESP-IDF v5.x`). نسخه اصلی و بدون تغییر کتابخانه جهت مرجع در پوشه `original/` نگهداری شده است.

---

## خلاصه 5 مرحله بهینه‌سازی

### مرحله 1: بهینه‌سازی تخصیص حافظه و حذف Callback Allocation (`ESP32_NOW.h` / `ESP32_NOW.cpp`)
- جایگزینی `_esp_now_peers[20]` ثابت با `uniuno::SmallVector<ESP_NOW_Peer *, ESP_NOW_MAX_TOTAL_PEER_NUM>` (ظرفیت Inline بدون Heap و پیمایش فقط روی Peerهای فعال + حذف $O(1)$ با `erase_unordered`).
- پشتیبانی از `uniuno::FastFunction<void(const esp_now_recv_info_t *, const uint8_t *, int), 48>` (`ESP_NOW_NewPeerCb`) برای ثبت Lambda/Closure بدون `std::function` و بدون تخصیص Heap.

### مرحله 2: کشف و رفع گلوگاه‌های پنهان و باگ‌های Runtime (`ESP32_NOW.cpp` / `ESP32_NOW_Serial.cpp`)
- **حذف قفل مضاعف WiFi Task در مسیر RX:** در `_esp_now_rx_cb` دیگر روی هر بسته ورودی تابع `esp_now_is_peer_exist()` قبل از جستجوی Peer محلی صدا زده نمی‌شود؛ ابتدا لیست محلی با `Spinlock` سریع بررسی می‌شود و فقط در صورت ناشناس بودن فرستنده به `esp_now_is_peer_exist()` و `_new_peer_cb` ارجاع داده می‌شود.
- **ایمنی هم‌زمانی لیست Peerها:** حفاظت خواندن/نوشتن `_esp_now_peers` با `portMUX_TYPE _peers_mux` و آزادسازی قفل پیش از فراخوانی Callbackهای مجازی `onReceive()` / `onSent()`.
- **رفع باگ Timeout و بازگشتی Serial:** اصلاح تبدیل `pdMS_TO_TICKS(timeout)` در `ESP_NOW_Serial_Class::write()` و بازگشت `0` به‌جای `-1` در `size_t read(uint8_t*, size_t)` هنگام خالی/نامعتبر بودن بافر.

### مرحله 3: انتقال ساختارهای Hot Path به DRAM و حذف گلوگاه FreeRTOS Byte-Queue (`ESP32_NOW_Serial.h` / `ESP32_NOW_Serial.cpp`)
- جایگزینی `QueueHandle_t rx_queue` با **بافر حلقوی توانی از ۲ (`rx_buf_`, `rx_cap_`, `rx_mask_`)** تخصیص‌یافته در حافظه سریع `MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT`.
- در نسخه قبلی، دریافت هر بسته در `onReceive()` به ازای هر بایت `xQueueSend()` صدا می‌زد (تا 250/1470 بار Lock/Unlock در WiFi Task)؛ اکنون کل بسته در **1 بخش بحرانی کوتاه** و حداکثر **2 کپی پیوسته** (بخش اول تا انتهای بافر و بخش wraparound) در بافر حلقوی قرار می‌گیرد و `read(buffer, size)` نیز به‌صورت دسته‌ای (Bulk) می‌خواند.

### مرحله 4: دستورات سطح پایین Xtensa LX6 Assembly و بیت‌عملیات (`EspNowAsm.h`)
- مقایسه 6-بایتی MAC بدون فراخوانی `memcmp()` با خوانش 32-بیتی + 16-بیتی ایمن از نظر Alignment (`espnow_asm::macEqual`) و تشخیص مستقیم Broadcast (`espnow_asm::isBroadcastMac`).
- کپی بافر RX/TX از طریق `espnow_asm::copyAlignedOrByte()` با تکیه بر روتین اسمبلی `uniuno::xtensa_asm::asm_copy_words` (`LOOP` سخت‌افزاری بدون سربار شاخه در LX6) برای داده‌های 4-بایتی هم‌تراز و fallback سریع `memcpy` برای سایر موارد.

### مرحله 5: Inline سازی، برآورد شاخه‌ها و کاهش حجم Flash (`ESP32_NOW.h` / `ESP32_NOW.cpp`)
- استفاده از `FORCE_INLINE` (`CompilerTraits.h`) برای متدهای پرکاربرد و سبک (`getMaxDataLen()`, `getVersion()`, `availableForWrite()`, `addr()`, `getChannel()`, `getInterface()`, `isEncrypted()`, `operator bool()`).
- تگ‌گذاری `HOT_PATH` و `LIKELY` / `UNLIKELY` در `_esp_now_rx_cb`, `_esp_now_tx_cb`, `ESP_NOW_Peer::send()`, `ESP_NOW_Class::write()`, `ESP_NOW_Serial_Class::onReceive()`, `read()`, `available()`.
- یکپارچه‌سازی لاگ خطاهای تکراری در `_esp_now_log_error()` با استفاده از `esp_err_to_name()` به‌جای 5 زنجیره تکراری `if/else if` برای کاهش حجم Flash.

---

## وضعیت ساخت و نتایج اندازه‌گیری شده (Build `esp32dev`)
- **ابزار ساخت:** PlatformIO (`framework-arduinoespressif32 @ 3.20017.241212+sha.dcc1105b`)
- **وضعیت کامپایل:** `[SUCCESS]` (بدون خطا یا هشدار در ماژول‌های تغییر یافته)
- **RAM:** `118,836 bytes` از `327,680 bytes` (`36.3%`) — تغییر نسبت به بیس‌لاین `ESP_NOW` (`118,676 B`): `+160 B` (به دلیل `SmallVector` + `FastFunction` استاتیک و حذف نیاز به Heap داینامیک در مسیر ثبت Callback)
- **Flash:** `1,222,577 bytes` از `1,966,080 bytes` (`62.2%`) — کاهش `456 bytes` نسبت به بیس‌لاین (`1,223,033 B`) با وجود افزوده شدن `ESP32_NOW_Serial` بهینه‌شده و توابع Inline مسیر داغ.
- **محدودیت راستی‌آزمایی:** کامپایل کامل با موفقیت انجام شده است؛ تست عملی روی سخت‌افزار فیزیکی (تست تبادل بسته ESP-NOW بین دو برد ESP32) پس از تکمیل پیاده‌سازی در firmware اصلی انجام خواهد شد.

