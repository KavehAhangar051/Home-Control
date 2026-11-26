# راهنمای تغییرات کاهش مصرف RAM (و نحوه بازگردانی روی میکروی قوی‌تر)

این سند تمام تغییراتی را که برای آزادسازی حدود **۲۸.۷ کیلوبایت DRAM** روی ESP32 فعلی (جهت جلوگیری از خطاهای `(-16) BIGNUM - Memory allocation failed` و `(-32512) SSL - Memory allocation failed` هنگام TLS Handshake با Cloudflare Worker) اعمال شد، مستند می‌کند.

> [!NOTE]
> **تأثیر روی سرعت و بهینه‌سازی‌های قبلی پروژه:**
> هیچ‌کدام از بهینه‌سازی‌های سرعتی شما (از جمله `LOOP_IRAM_ATTR`، `CCOUNT` throttling، `LoopOptimizer`، `Pin Dispatch LUT`، `FastFunction` SBO، مسیر سریع `single_persistent` در `EventDispatcher` و پارس بدون Heap) **تغییر نکرده‌اند و کند نشده‌اند**.
> تغییرات زیر صرفاً ظرفیت حداکثری جدول رویدادها، اندازه استک دو تسک FreeRTOS و زمان‌بندی تخصیص/آزادسازی آبجکت WebSocket را تعدیل کرده‌اند.

---

## خلاصه میزان صرفه‌جویی در حافظه

- **RAM استاتیک (`.data` + `.bss`) در خروجی `pio run -e esp32dev`:**
  - قبل: `110,100` بایت (`33.6%` از `327,680` بایت)
  - بعد: `95,732` بایت (`29.2%` از `327,680` بایت)
  - صرفه‌جویی استاتیک: **۱۴٬۳۶۸ بایت**
- **Heap پویا (استک تسک‌ها):**
  - کاهش استک `AsyncTCP`: **۸٬۱۹۲ بایت**
  - کاهش استک `loopTask`: **۶٬۱۴۴ بایت**
  - مجموع صرفه‌جویی استک‌ها: **۱۴٬۳۳۶ بایت**
- **جمع کل صرفه‌جویی تضمینی:** حدود **۲۸٬۷۰۴ بایت (~۲۸ کیلوبایت)** + جلوگیری از نگهداری آبجکت بلااستفاده `WebsocketsClient` روی Heap پیش از اتصال و پس از شکست اتصال.

---

## فهرست دقیق تغییرات و روش بازگردانی

### ۱. کاهش ظرفیت `EventDispatcher`
- **فایل‌ها:**
  - `Hardware/include/Events/Impl/EventDispatcherTemplate.h` (خطوط ۷ و ۱۲۷)
  - `Hardware/include/Events/Impl/EventDispatcherInterface.h` (خطوط ۱۰ و ۵۹)
- **مقدار قبلی:** `<32, 8>` (حداکثر ۳۲ نوع رویداد و ۸ شنونده برای هر رویداد)
- **مقدار فعلی:** `<20, 4>` (حداکثر ۲۰ نوع رویداد و ۴ شنونده برای هر رویداد)
- **تأثیر واقعی:** با توجه به اینکه در `EventHandlers.cpp` جمعاً ۱۶ نوع رویداد (هرکدام با ۱ شنونده) ثبت شده است، **هیچ تأثیری روی سرعت یا عملکرد فعلی ندارد**؛ تنها محدودیت این است که اگر در آینده تعداد رویدادهای متمایز از ۲۰ بیشتر شود یا برای یک رویداد بیش از ۴ شنونده ثبت کنید، ثبت جدید رد می‌شود.
- **نحوه بازگردانی روی میکروی قوی‌تر:**
  در هر دو فایل بالا مقادیر `<20, 4>` را به `<32, 8>` (یا بیشتر) برگردانید:
  ```cpp
  // EventDispatcherInterface.h
  template <size_t MaxEvents = 32, size_t MaxListeners = 8>
  ...
  using EventDispatcherCore = EventDispatcherCoreBase<32, 8>;

  // EventDispatcherTemplate.h
  template <size_t MaxEvents = 32, size_t MaxListeners = 8>
  ...
  using EventDispatcher = EventDispatcherBase<32, 8>;
  ```

---

### ۲. کاهش اندازه استک تسک `AsyncTCP`
- **فایل:** `Hardware/include/AsyncTCP/AsyncTCP.h` (خط ۵۴)
- **مقدار قبلی:**
  ```cpp
  #define CONFIG_ASYNC_TCP_STACK_SIZE 8192 * 2
  ```
  (معادل ۱۶٬۳۸۴ بایت)
- **مقدار فعلی:**
  ```cpp
  #define CONFIG_ASYNC_TCP_STACK_SIZE 8192
  ```
  (معادل ۸٬۱۹۲ بایت)
- **تأثیر واقعی:** سرعت اجرای `AsyncTCP` و MQTT تغییری نمی‌کند؛ فقط فضای استک تسک `async_tcp` از ۱۶KB به ۸KB کم شده است. اگر در آینده در کالبک‌های `AsyncMqttClient` متغیرهای محلی بسیار سنگین روی استک قرار دهید، ممکن است نیاز به افزایش دوباره باشد.
- **نحوه بازگردانی روی میکروی قوی‌تر:**
  خط ۵۴ را دوباره به `8192 * 2` برگردانید.

---

### ۳. کاهش اندازه استک `loopTask` آردوینو
- **فایل:** `Hardware/firmware/src/main.cpp` (خط ۳۴)
- **مقدار قبلی:**
  ```cpp
  size_t getArduinoLoopTaskStackSize(void) {
      return 16384;
  }
  ```
- **مقدار فعلی:**
  ```cpp
  size_t getArduinoLoopTaskStackSize(void) {
      return 10240;
  }
  ```
- **تأثیر واقعی:** هیچ تأثیری روی سرعت `loop()` ندارد (حافظه `ParseResult` قبلاً به Heap منتقل شده بود و پیش‌فرض Arduino-ESP32 نیز `8192` بایت است). تنها برای توابع با عمق فراخوانی زیاد یا بافرهای استک بزرگ‌تر از چند کیلوبایت روی `loopTask`، برگشت به `16384` حاشیه امنیت بیشتری می‌دهد.
- **نحوه بازگردانی روی میکروی قوی‌تر:**
  مقدار بازگشتی `getArduinoLoopTaskStackSize()` را دوباره `16384` قرار دهید.

---

### ۴. تخصیص تنبل و آزادسازی فوری `WebsocketsClient` در `AchaemenidWebSocketClient`
- **فایل:** `Hardware/lib/AchaemenidWebSocket/src/core/WebSocketClient.cpp`
- **تغییر اعمال‌شده:**
  1. در سازنده `AchaemenidWebSocketClient` (خطوط ۵۶–۶۱)، ساخت یک نمونه اولیه `WebsocketsClient` + `InsecureEsp32TcpClient` حذف شد (چون `doConnect()` بلافاصله آن را `delete` می‌کرد و یک نمونه جدید می‌ساخت).
  2. در `doConnect()`، اگر `newClient->connect(...)` شکست بخورد، `newClient` بلافاصله بسته و `delete` می‌شود (به‌جای نگه‌داشتن آبجکت مرده تا تلاش بعدی).
  3. چاپ `Free heap` و `Max alloc` پیش از اتصال اضافه شد.
- **تأثیر واقعی:** این تغییر نه‌تنها به سرعت ضربه نمی‌زند، بلکه یک مصرف بیهوده و نگه‌داری حافظه مرده را برطرف کرده است؛ بنابراین **توصیه می‌شود حتی روی میکروی قوی‌تر هم همین حالت را نگه دارید** (در صورت نیاز فقط لاگ `Serial.printf` مربوط به `Free heap` را حذف کنید).

---

## تفکیک باگ‌های برطرف‌شده (مواردی که نباید برگردانده شوند)

تغییرات زیر برای رفع باگ منطقی اتصال TLS/Socket بودند و **ارتباطی به کاهش RAM ندارند**؛ روی میکروی قوی‌تر هم باید باقی بمانند:
- **`Hardware/lib/AchaemenidWebSocket/src/core/WebSocketClient.cpp`**: تابع `parseWssUrl` و استفاده از `connect(host, port, path)` (برای حفظ `InsecureEsp32TcpClient`؛ البته در نسخه نهایی تولید توصیه می‌شود به‌جای `setInsecure()` از `setCACert()` یا `useBuiltinCACertBundle()` استفاده شود).
- **`Hardware/include/ArduinoWebsockets/tiny_websockets/network/generic_esp/generic_esp_clients.hpp`**: اجرای `client.setNoDelay(true)` فقط در صورت `if (didConnect)` (رفع خطای `errno: 9`).
- **`Hardware/include/NetworkClientSecure/ssl_client.cpp`**: بازنشانی `ssl_client->socket = -1;` پس از `memset` در `stop_ssl_socket`.

---

## نکته مهم هنگام بازگردانی تغییرات

پس از برگرداندن هرکدام از موارد بالا، حتماً با یکی از محیط‌های کامپایل کامل بیلد بگیرید تا باینری‌های `firmware/prebuilt/` هم به‌روزرسانی شوند:
```bash
pio run -e esp32dev
# یا برای Core v3:
pio run -e esp32dev_core3
```

