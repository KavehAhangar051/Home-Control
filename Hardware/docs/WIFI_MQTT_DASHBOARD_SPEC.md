# مشخصات رفع باگ‌ها و بهبودهای تب WiFi، بخش Access Point و تب MQTT در داشبورد

این سند حاصل بررسی کامل مخزن داشبورد (`Home-Control-Dashboard`) در ارتباط با منطق فریم‌ور ESP32 و همگام‌سازی Cloudflare Worker است.
تمامی باگ‌های سمت سخت‌افزار در مخزن سخت‌افزار برطرف شده‌اند؛ موارد زیر باید توسط هوش مصنوعی/توسعه‌دهنده داشبورد روی مخزن داشبورد اعمال شوند.

---

## ۱. باگ‌ها و نقص‌های تب WiFi (`WifiSection` و همگام‌سازی Cloudflare)

### باگ ۱-۱ (بحرانی): تغییر زودهنگام Store و Cancel معیوب هنگام افزودن شبکه جدید
* **فایل‌ها و خطوط:**
  * `features/settings/components/wifi-section/WifiSection.tsx` (خطوط `29-35` و `146`)
* **علت ریشه‌ای:**
  * تابع `handleAddNetwork` بلافاصله پس از کلیک روی `+` یک آیتم ساختگی `{ id: newId, ssid: "شبکه جدید", password: "" }` را وارد `useIoTStore.wifiNetworks` می‌کند.
  * ورود این آیتم به store بلافاصله `wifiNetworksConfigured = true` را فعال کرده و `useCloudflarePush` پس از ~۲ ثانیه رشته `"شبکه جدید"` را قبل از اتمام تایپ کاربر به Cloudflare Worker و ESP32 می‌فرستد و باعث ریستارت ناخواسته ESP32 می‌شود.
  * همچنین دکمه لغو (`onCancel={() => setEditingId(null)}`) فقط حالت ویرایش را می‌بندد و آیتم `"شبکه جدید"` را در لیست باقی می‌گذارد.
* **تغییر مورد نیاز:**
  * برای افزودن شبکه جدید از یک state محلی موقت (`draftNewNetwork: { id: string; ssid: string; password: string } | null`) استفاده کنید و تا زمانی که کاربر فرم معتبر را با دکمه **ذخیره** تأیید نکرده، `setWifiNetworks(...)` را صدا نزنید.
  * با کلیک روی لغو (`X`) در حالت افزودن، `draftNewNetwork` را `null` کنید بدون تغییر دادن store.

---

### باگ ۱-۲ (بحرانی): نبود محدودیت ۵ شبکه مطابق ظرفیت سخت‌افزار ESP32
* **فایل‌ها:** `features/settings/components/wifi-section/WifiSection.tsx` (خطوط `29-35`, `69-82`)
* **علت ریشه‌ای:**
  * سخت‌افزار ESP32 (حافظه NVS در `NetworkStorage.cpp` و پروتکل `AchaemenidConfigProtocol`) حداکثر **۵ شبکه وای‌فای** را پشتیبانی می‌کند. در داشبورد هیچ محدودیتی وجود ندارد و شبکه ششم به بالا بی‌صدا در ESP32 نادیده گرفته می‌شود.
* **تغییر مورد نیاز:**
  * ثابت `MAX_WIFI_NETWORKS = 5` تعریف شود.
  * دکمه `+` زمانی که `wifiNetworks.length >= MAX_WIFI_NETWORKS` (یا یک شبکه در حال افزودن است) غیرفعال (`disabled`) شود و شمارنده `wifiNetworks.length / 5` همراه با پیام راهنما نمایش داده شود.

---

### باگ ۱-۳ (بحرانی): نبود اعتبارسنجی SSID، رمز عبور و Trim کردن ورودی‌ها
* **فایل‌ها:**
  * `features/settings/components/wifi-section/WifiSection.tsx` (خطوط `43-49`)
  * `features/settings/components/wifi-section/WifiNetworkEditor.tsx` (خطوط `29-52`)
* **علت ریشه‌ای:**
  1. فیلد SSID فاقد `maxLength={32}` و اعتبارسنجی طول بایتی UTF-8 (۱ تا ۳۲ بایت مطابق استاندارد IEEE 802.11) است.
  2. فیلد رمز عبور اجازه ثبت رمز ۱ تا ۷ کاراکتری یا بالای ۶۳ بایت را می‌دهد؛ در حالی که WPA2-PSK فقط **خالی (شبکه باز)** یا **۸ تا ۶۳ بایت** را می‌پذیرد و در غیر این صورت اتصال ESP32 بی‌صدا شکست می‌خورد.
  3. تابع `handleSaveNetwork` در `WifiSection.tsx` مقدار `tempSsid` را پیش از ذخیره `trim()` نمی‌کند (`ssid: tempSsid`) و اگر SSID خالی باشد بدون نمایش هیچ پیام خطایی فقط `return` می‌کند.
* **تغییر مورد نیاز:**
  * تابع کمکی `getUtf8ByteLength(value: string)` (با `new TextEncoder().encode(value).length`) برای بررسی دقیق محدودیت بایتی (SSID فارسی/غیرانگلیسی بیش از ۱ بایت به ازای هر کاراکتر مصرف می‌کند) اضافه شود.
  * اعتبارسنجی inline پیش از ذخیره:
    * SSID (پس از `trim()`): الزامی، ۱ تا ۳۲ بایت، بدون تکرار با شبکه‌های موجود (یا هشدار تکراری).
    * رمز عبور: خالی (`""`) برای شبکه باز، یا ۸ تا ۶۳ بایت برای WPA/WPA2.
  * افزودن `maxLength={32}` روی input نام شبکه و `maxLength={63}` روی input رمز عبور به همراه دکمه نمایش/مخفی‌سازی رمز (`type="text" / "password"`).

---

### باگ ۱-۴ (بحرانی): تداخل همگام‌سازی کلودفلر در بخش Access Point سفارشی و پیام خطای گمراه‌کننده
* **فایل‌ها:**
  * `features/settings/components/wifi-section/WifiSection.tsx` (خطوط `20-23`, `90-133`)
  * `features/iot/hooks/achaemenidState/core/buildEspConfig.ts` (خطوط `45-57`)
* **علت ریشه‌ای:**
  1. **خطای گمراه‌کننده:** اگر `apSsid` خالی باشد ولی `apPassword` پر شود (`!apSsid.trim()`), شرط خط `21` در `WifiSection.tsx` باز هم پیام `"رمز AP سفارشی باید حداقل ۸ کاراکتر باشد."` را زیر فیلد رمز نمایش می‌دهد!
  2. **Race و حذف ناخواسته در تایپ زنده:** هر کلید تایپ‌شده در `esp-ap-ssid` و `esp-ap-password` بلافاصله `setWifiApConfig(...)` را در store تغییر می‌دهد و تایمر ۱۲۰۰ms در `useCloudflarePush` را فعال می‌کند. اگر کاربر هنگام تایپ مکث کند یا فقط یکی از دو فیلد را پاک کند، `buildEspConfig` مقدار `accessPoint` را `undefined` می‌فرستد که باعث جا ماندن تنظیمات قبلی یا ناهماهنگی با KV می‌شود.
  3. برخلاف تب MQTT، هیچ دکمه صریح **«ذخیره اکسس‌پوینت»** و **«بازگشت به پیش‌فرض»** وجود ندارد.
* **تغییر مورد نیاز:**
  * تبدیل فیلدهای AP در `WifiSection.tsx` به draft محلی (`apSsidDraft`, `apPasswordDraft`) همراه با دکمه‌های صریح **«ذخیره تنظیمات اکسس‌پوینت»** و **«بازنشانی به پیش‌فرض (MAC)»**.
  * تفکیک پیام‌های خطا به `apSsidError` (۱ تا ۳۲ بایت UTF-8، الزامی در صورت پر بودن رمز) و `apPasswordError` (۸ تا ۶۳ بایت UTF-8).
  * دکمه بازنشانی مقدار دقیق `{ ssid: "", password: "" }` را ست و ذخیره کند (تا Worker خط `A s= p=` را ارسال کرده و NVS سخت‌افزار به حالت پیش‌فرض MAC برگردد).

---

### باگ ۱-۵ (متوسط/UX): نبود هشدار ریستارت شدن ESP32 هنگام تغییر یا حذف کامل شبکه‌های WiFi
* **فایل:** `features/settings/components/wifi-section/WifiSection.tsx`
* **علت ریشه‌ای:**
  * با هر تغییر واقعی در لیست `wifiNetworks`، برد ESP32 برای اعمال شبکه‌های جدید ریستارت می‌شود (`ESP.restart()`) و در صورت حذف همه شبکه‌ها وارد حالت Captive Portal AP می‌شود. در داشبورد هیچ اعلانی پیش از حذف آخرین شبکه یا پس از تغییر به کاربر نشان داده نمی‌شود.
* **تغییر مورد نیاز:**
  * نمایش بنر راهنما در بالای تب WiFi + دیالوگ/Toast تأیید هنگام حذف آخرین شبکه وای‌فای مبنی بر اینکه دستگاه ریستارت شده و وارد حالت اکسس‌پوینت راه‌اندازی (`http://achaemenid.local/`) خواهد شد.

---

### باگ ۱-۶ (امنیتی/پشتیبان‌گیری): افشای رمز عبور WiFi در فایل Backup JSON بدون هشدار
* **فایل:** `features/iot/services/configBackupService.ts` (خطوط `56-72`)
* **علت ریشه‌ای:**
  * `buildDashboardBackupBundle()` تمام `wifiNetworks` را با رمز عبور plaintext در فایل JSON خروجی ذخیره می‌کند بدون اینکه کاربر مطلع باشد یا گزینه‌ای برای حذف رمزها (`includeWifiPasswords: boolean`) وجود داشته باشد.
* **تغییر مورد نیاز:**
  * افزودن گزینه اختیاری (یا هشدار صریح در UI پشتیبان‌گیری) برای Export بدون رمز عبور وای‌فای جهت اشتراک‌گذاری امن تنظیمات.

---

## ۲. باگ‌ها و نقص‌های تب MQTT (`MqttSection`, `createConfigSlice`, `mqtt/client`, `mqtt/init`)

### باگ ۲-۱ (بحرانی): نادیده گرفتن تغییر `broker_host` و `broker_port` در همگام‌سازی راه‌دور
* **فایل:** `features/iot/hooks/store/slices/createConfigSlice.ts` (خطوط `166-183`)
* **علت ریشه‌ای:**
  * در بررسی تغییرات دریافتی از Cloudflare فقط سه فیلد زیر چک می‌شوند:
    ```ts
    const changed =
      !currentMqtt ||
      currentMqtt.broker_ws_url !== config.mqtt.broker_ws_url ||
      currentMqtt.base_topic !== config.mqtt.base_topic ||
      currentMqtt.qos !== config.mqtt.qos;
    ```
  * تغییر `broker_host` یا `broker_port` از کلاینت دیگر در `changed` بررسی نمی‌شود و همچنین مقادیر همگام‌سازی‌شده از Cloudflare در `localStorage` ذخیره نمی‌شوند؛ بنابراین در اجرای بعدی پیش از sync کلودفلر (`bypassSync`)، تابع `getMqttSettings()` همچنان تنظیمات قدیمی `localStorage` را می‌خواند.
* **تغییر مورد نیاز:**
  * مقایسه `broker_host` و `broker_port` (و فیلدهای احراز هویت در صورت افزودن) در `changed`.
  * همگام‌سازی `localStorage` (`mqtt_broker_url`, `mqtt_broker_host`, `mqtt_broker_port`, `mqtt_base_topic`, `mqtt_qos`) هنگام دریافت تنظیمات جدید از Cloudflare.

---

### باگ ۲-۲ (بالا): عدم ذخیره `broker_host` و `broker_port` در `localStorage`
* **فایل‌ها:**
  * `features/settings/components/mqtt-section/MqttSection.tsx` (خطوط `48-50`, `88-94`)
  * `features/iot/services/mqtt/client.ts` (خطوط `48-73`)
* **علت ریشه‌ای:**
  * `MqttSection` تنها `mqtt_broker_url`, `mqtt_base_topic`, `mqtt_qos` را در `localStorage` ذخیره می‌کند و `broker_host` و `broker_port` را در حالت fallback با مقادیر ثابت `"broker.emqx.io"` و `1883` بازنویسی می‌کند.
* **تغییر مورد نیاز:**
  * ذخیره و بازیابی `mqtt_broker_host` و `mqtt_broker_port` در `localStorage` و بازگرداندن آن‌ها در `getMqttSettings()` / `resolveMqttDraftValues()`.

---

### باگ ۲-۳ (بالا): ماندگاری `overrides` محلی و سایه انداختن روی به‌روزرسانی‌های Cloudflare
* **فایل:** `features/settings/components/mqtt-section/MqttSection.tsx` (خطوط `70-77`, `104-128`)
* **علت ریشه‌ای:**
  * پس از ذخیره موفق در `handleSaveAndReconnect`، مقدار `overrides` هرگز پاک نمی‌شود (`setOverrides({})` فراخوانی نمی‌شود).
  * اگر صفحه باز بماند و تنظیمات MQTT از دستگاه دیگری تغییر کند و از Cloudflare دریافت شود، state محلی `overrides` تا زمان بسته شدن کامپوننت روی `mqttConfig` جدید سایه می‌اندازد و مقدار قدیمی را نمایش می‌دهد.
* **تغییر مورد نیاز:**
  * فراخوانی `setOverrides({})` پس از اعمال `setMqttConfig(newMqttConfig)` (و پاک‌سازی تایمر `setTimeout` هنگام unmount).

---

### باگ ۲-۴ (بحرانی): نبود اعتبارسنجی ورودی‌ها و باگ تایپ پورت (`|| 1883`)
* **فایل‌ها:**
  * `features/settings/components/mqtt-section/MqttFormFields.tsx` (خطوط `61-70`)
  * `features/settings/components/mqtt-section/MqttSection.tsx` (خطوط `85-105`)
* **علت ریشه‌ای:**
  1. در `MqttFormFields.tsx` کد `onChange={(e) => setBrokerPort(parseInt(e.target.value, 10) || 1883)}` اجازه پاک کردن فیلد پورت برای تایپ پورت جدید (مثلاً `8883`) را نمی‌دهد و بلافاصله مقدار را به `1883` برمی‌گرداند.
  2. هیچ اعتبارسنجی روی فیلدها انجام نمی‌شود:
     * `brokerWsUrl` ممکن است خالی باشد یا با `ws://`/`wss://` شروع نشود (و در صفحات `https://` استفاده از `ws://` توسط مرورگر مسدود می‌شود!).
     * `brokerHost` و `baseTopic` در ESP32 حداکثر **۶۳ بایت** طول دارند؛ همچنین `baseTopic` نباید شامل wildcardهای MQTT (`+`, `#`) یا `/` ابتدا/انتها باشد (`foo//Command`).
     * `brokerPort` خارج از بازه `1..65535` مسدود نمی‌شود.
* **تغییر مورد نیاز:**
  * نگه‌داشتن ورودی پورت به‌صورت رشته‌ای در پیش‌نویس ویرایش و تبدیل/بررسی بازه `1..65535` هنگام ذخیره.
  * اعتبارسنجی کامل پیش از ذخیره و اتصال مجدد:
    * `brokerWsUrl`: الزامی، URL معتبر با پروتکل `wss:` یا `ws:` (با هشدار mixed-content روی `https:` برای `ws://`).
    * `brokerHost`: الزامی، بدون فاصله/کاراکتر کنترلی، حداکثر ۶۳ بایت UTF-8.
    * `brokerPort`: عدد صحیح بین `1` تا `65535`.
    * `baseTopic`: الزامی (پس از حذف `/` ابتدا و انتها)، حداکثر ۶۳ بایت UTF-8، بدون `+` و `#` و فاصله.

---

### باگ ۲-۵ (متوسط): نمایش نادرست «ذخیره شد» بدون بازتاب وضعیت واقعی اتصال MQTT و نبود پشتیبانی اختیاری از Username/Password
* **فایل‌ها:**
  * `features/settings/components/mqtt-section/MqttSection.tsx`
  * `features/iot/services/config/types.ts` (`MqttConfig`)
  * `features/iot/services/mqtt/init.ts`
* **علت ریشه‌ای:**
  * حتی اگر broker جدید نامعتبر یا غیرقابل دسترس باشد، دکمه بلافاصله «ذخیره شد» نشان می‌دهد و هیچ نشانگر وضعیت اتصال فعلی MQTT (متصل / در حال اتصال / قطع) در همان صفحه وجود ندارد.
  * **قابلیت پیشنهادی (هم‌اکنون در سخت‌افزار آماده شده است):** فریم‌ور ESP32 اکنون پارامترهای اختیاری `u=<user>` و `pw=<pass>` را در خط `M` پروتکل `ESP_CFG_V2` پشتیبانی و در NVS ذخیره می‌کند. در صورت نیاز به استفاده از بروکرهای خصوصی دارای رمز (مانند EMQX Cloud یا Mosquitto با احراز هویت)، می‌توان فیلدهای اختیاری `username` و `password` را به فرم MQTT و Worker اضافه کرد.

---

## ۳. چک‌لیست تست‌های پیشنهادی در مخزن داشبورد

1. **تست `WifiSection`:**
   * کلیک روی `+` و سپس Cancel (`X`) نباید هیچ شبکه جدیدی را در store یا `localStorage`/Cloudflare ثبت کند.
   * افزودن ۶ شبکه باید با محدودیت ۵ شبکه متوقف شود.
   * رمز ۴ کاراکتری در WiFi یا AP باید پیام خطای inline بدهد و ذخیره نشود.
   * خالی کردن فقط `apSsid` با رمز پر باید خطای نام شبکه بدهد نه خطای «طول رمز».
   * کلیک روی «بازنشانی AP به پیش‌فرض» باید `wifiApConfig` را به `{ ssid: "", password: "" }` ست کند.
2. **تست `MqttSection` و `createConfigSlice`:**
   * تایپ پورت `8883` پس از پاک کردن `1883` نباید وسط تایپ به `1883` برگردد.
   * وارد کردن topic حاوی `+` یا `#` یا URL نامعتبر باید مانع ذخیره شود.
   * تغییر `broker_host` یا `broker_port` از Cloudflare sync (`applyEspConfig`) باید باعث فراخوانی `reconnectMqtt()` و به‌روزرسانی `localStorage` شود.
   * پس از ذخیره موفق در `MqttSection`، تغییر مجدد از کلودفلر نباید توسط `overrides` قدیمی پوشانده شود.
