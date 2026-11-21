# راهنمای تغییرات داشبورد (`Home-Control-Dashboard`) برای رفع ناهماهنگی شناسه سگمنت (Segment ID Sync)

> **هدف این سند:** این فایل به‌صورت دقیق تمام تغییرات مورد نیاز در ریپازیتوری `Home-Control-Dashboard` را مشخص می‌کند تا با نسخه اصلاح‌شده فریم‌ور ESP32 (`Achaemenid-IoT`) کاملاً هماهنگ شود و خطای حذف سگمنت (`[PinManager] Segment '<id>' not found.`) برای همیشه برطرف گردد.

---

## ۱. ریشه مشکل (چرا این باگ رخ می‌داد؟)

1. **تولید شناسه تصادفی (Random ID) برای سگمنت‌های سخت‌افزاری:**
   در فایل `features/iot/hooks/achaemenidState/core/segmentOperations.ts` (خط ۴۵)، تابع `createSegmentId()` با `Math.random().toString(36).substring(2, 9)` یک رشته تصادفی ۷ کاراکتری (مثل `jjib4yz`) می‌سازد. از آنجایی که هر پایه فیزیکی GPIO در ESP32 و داشبورد حداکثر **یک سگمنت فعال** دارد، هر بار که یک پایه (مثلاً GPIO 5) پس از قطع ارتباط، ریستور بکاپ، اختلاف کش، یا عدم دریافت پیام حذف مجدداً اضافه می‌شد، داشبورد یک ID تصادفی جدید برای همان GPIO 5 می‌ساخت، در حالی که ESP32 در NVS شناسه قدیمی آن پایه را نگه داشته بود.
2. **نبود شماره پایه (`pin`) در فریم باینری `DELETE_SEGMENT (0x03)`:**
   در کل پروتکل باینری MQTT (`0x01` تا `0x0E`)، تمام دستورات با `pin:u8` با سخت‌افزار صحبت می‌کنند **به‌جز** `DELETE_SEGMENT (0x03)` که فقط `[0x03][id_ascii...][0x00]` را ارسال می‌کرد. بنابراین تمام کنترل‌ها و Ruleها روی GPIO 5 درست کار می‌کردند، اما هنگام حذف سگمنت، اگر ID داشبورد و ESP32 حتی یک کاراکتر فرق داشت، حذف با خطای `Segment '<id>' not found.` شکست می‌خورد.

---

## ۲. تغییراتی که از پیش در فریم‌ور ESP32 اعمال شده‌اند (طرف سخت‌افزار)

فریم‌ور سخت‌افزار اکنون با حفظ **۱۰۰٪ سازگاری عقب‌رو (Backward Compatibility)** به قابلیت‌های زیر مجهز شده است:

1. **پشتیبانی از فریم توسعه‌یافته `DELETE_SEGMENT (0x03)` v2:**
   - فرمت قدیم: `[0x03][id_ascii...][0x00]` (همچنان پشتیبانی می‌شود)
   - فرمت جدید v2: `[0x03][id_ascii...][0x00][pin:u8]` (بایت اختیاری `pin` از `0` تا `39` بلافاصله بعد از بایت صفر `\0`)
   - رفتار فریم‌ور: ابتدا سگمنت را با `id` جستجو و حذف می‌کند؛ اگر `id` پیدا نشد و بایت `pin` (`0..39`) موجود بود، سگمنت ثبت‌شده روی همان `GPIO` را حذف و NVS را بروزرسانی می‌کند. همچنین اگر `pin` ارسال نشده باشد اما `id` از فرمت استاندارد `gpio_<N>` یا `pin_<N>` باشد، به‌عنوان fallback پایه `N` را حذف می‌کند (و هرگز شناسه‌های تصادفی مثل `7xhkvz2` را به اشتباه پارس نمی‌کند).
2. **جایگزینی خودکار در `ADD_SEGMENT (0x02)` (`upsertSegment`):**
   - اگر GPIO مورد نظر از قبل در ESP32 ثبت شده باشد، به‌جای رد کردن دستور (`Pin 5 already in use`)، سگمنت قبلی روی آن پایه حذف و سگمنت جدید با **دقیقاً ID جدید داشبورد** جایگزین و در NVS ذخیره می‌شود.
3. **ارسال نقشه `ids` در پیام `state_sync`:**
   - پیام JSON همگام‌سازی وضعیت (`exportStateJson()`) اکنون فیلد جدید `"ids"` را هم برمی‌گرداند:
     ```json
     {
       "type": "state_sync",
       "states": { "5": true },
       "values": {},
       "resolutions": {},
       "ids": { "5": "gpio_5" },
       "timers": { "5": 0 }
     }
     ```
4. **پاکسازی کامل RAM قبل از اعمال تنظیمات جدید (`onConfigLoaded`):**
   - هنگام دریافت پیکربندی `ESP_CFG_V2` از Cloudflare، ابتدا تمام سگمنت‌های RAM با `pinManager.clearAllSegments()` پاک شده و سپس تنظیمات جدید اعمال و در NVS ذخیره می‌شوند؛ همچنین `AchaemenidConfigProtocol` حتی در صورت نبود هدر `C n=` با وجود خطوط معتبر `S ` مقدار `segmentsProvided = true` را تنظیم می‌کند.

---

## ۳. تغییرات مورد نیاز در داشبورد (`Home-Control-Dashboard`)

لطفاً تغییرات زیر را به ترتیب در ریپازیتوری داشبورد اعمال کنید:

### تغییر ۱: افزودن بایت اختیاری `pin` به فریم `DELETE_SEGMENT (0x03)`

#### الف) `features/iot/services/mqtt/segmentPublishers.ts` (خطوط ۱۷۹ تا ۱۹۲)

تابع‌های `buildDeleteSegmentFrame` و `publishDeleteSegmentCommand` را به‌صورت زیر به‌روزرسانی کنید تا در صورت وجود شماره پایه معتبر (`0..39`)، یک بایت `pin & 0xff` بلافاصله پس از بایت `0x00` اضافه شود:

```ts
export const buildDeleteSegmentFrame = (id: string, pin?: number | string): Uint8Array => {
  const idBytes = textEncoder.encode(id.slice(0, 31));
  const parsedPin =
    pin !== undefined && pin !== null && String(pin).trim() !== ""
      ? Number(pin)
      : Number.NaN;
  const hasValidPin = Number.isInteger(parsedPin) && parsedPin >= 0 && parsedPin <= 39;

  const buf = new Uint8Array(1 + idBytes.length + 1 + (hasValidPin ? 1 : 0));
  buf[0] = MQTT_OPCODES.DELETE_SEGMENT;
  buf.set(idBytes, 1);
  buf[1 + idBytes.length] = 0;

  if (hasValidPin) {
    buf[1 + idBytes.length + 1] = parsedPin & 0xff;
  }

  return buf;
};

export const publishDeleteSegmentCommand = (id: string, pin?: number | string) => {
  const buf = buildDeleteSegmentFrame(id, pin);
  publishMqttCommand(
    buf,
    pin !== undefined ? `Published delete_segment: id=${id}, pin=${pin}` : `Published delete_segment: id=${id}`,
  );
};
```

#### ب) `features/iot/services/ports.ts` (خط ۳۹) و `features/iot/services/deviceGatewayAdapter.ts` (خطوط ۸۳ تا ۸۵)

امضای متد `publishDeleteSegment` را در پورت و آداپتر به‌صورت backward-compatible به‌روزرسانی کنید:

در `features/iot/services/ports.ts`:
```ts
publishDeleteSegment(id: string, pin?: number | string): void;
```

در `features/iot/services/deviceGatewayAdapter.ts`:
```ts
publishDeleteSegment(id: string, pin?: number | string): void {
  mqttDeleteSegment(id, pin);
}
```

#### ج) `features/iot/hooks/achaemenidState/useSegmentManagement.ts` (خطوط ۱۹۲ تا ۲۲۰)

در هر دو تابع `handleRemoveSegment` و `handleRemoveGroup`، شماره پایه (`target.pin` / `segment.pin`) را هم به `publishDeleteSegmentCommand` پاس بدهید:

```ts
  const handleRemoveSegment = useCallback(
    (id: string) => {
      const segments = useIoTStore.getState().segments;
      const target = segments.find((segment) => segment.id === id);
      setSegments(segments.filter((s) => s.id !== id));
      if (target && target.type !== "placeholder") {
        publishDeleteSegmentCommand(id, target.pin);
      }
    },
    [setSegments],
  );

  const handleRemoveGroup = useCallback(
    (groupId: string) => {
      const currentSegments = useIoTStore.getState().segments;
      for (const segment of currentSegments) {
        if (resolveSegmentGroup(segment.group) === groupId && segment.type !== "placeholder") {
          publishDeleteSegmentCommand(segment.id, segment.pin);
        }
      }
      setGroupsOrder(
        (prev) => planRemoveGroup({ groupsOrder: prev, segments: [], groupId }).nextGroupsOrder,
      );
      setSegments(
        (prev) => planRemoveGroup({ groupsOrder: [], segments: prev, groupId }).nextSegments,
      );
    },
    [setGroupsOrder, setSegments],
  );
```

---

### تغییر ۲: تولید شناسه قطعی (Deterministic Pin-Based ID) برای سگمنت‌های سخت‌افزاری جدید

در `features/iot/hooks/achaemenidState/core/segmentOperations.ts` (خطوط ۴۵ تا ۹۰):

برای جلوگیری از تولید IDهای تصادفی متفاوت برای یک GPIO یکسان در جلسات مختلف، برای سگمنت‌های سخت‌افزاری جدید (هر نوعی به‌جز `placeholder`) از شناسه قطعی `gpio_<pin>` (مثلاً `gpio_5`) استفاده کنید. شناسه‌های تصادفی فقط برای `placeholder`ها (که پایه فیزیکی ندارند) یا زمانی که پایه معتبر نیست استفاده شوند.

> **مهم (حفظ سازگاری با داده‌های ذخیره‌شده قبلی):** شناسه‌های قدیمی کاربران که از قبل در Cloudflare/localStorage ذخیره شده‌اند را هنگام بارگذاری (deserialize) دست‌نخورده نگه دارید تا هیچ workflow، گروه یا تنظیمات ذخیره‌شده‌ای نشکند. برای آن‌ها ارسال `pin` در فریم `0x03` v2 حذف را تضمین می‌کند و برای سگمنت‌های جدید از `gpio_<pin>` استفاده می‌شود.

```ts
export function createHardwareSegmentId(
  pin: string | number | undefined,
  randomFn: () => number = Math.random,
): string {
  const parsed = pin !== undefined && String(pin).trim() !== "" ? Number(pin) : Number.NaN;
  if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 39) {
    return `gpio_${parsed}`;
  }
  return createSegmentId(randomFn);
}
```

و در `planAddSegment(...)` (حدود خط ۸۵):

```ts
  const resolvedId =
    params.createId
      ? params.createId()
      : input.type === "placeholder"
        ? createSegmentId()
        : createHardwareSegmentId(input.pin);

  const newSegment: Segment = {
    id: resolvedId,
    // ... بقیه فیلدها بدون تغییر
```

*(نکته: حفظ امکان override از طریق `params.createId` باعث می‌شود تمام تست‌های واحد موجود که `createId` سفارشی پاس می‌دهند بدون تغییر پاس شوند.)*

---

### تغییر ۳: پارس کردن فیلد اختیاری `ids` در پیام `state_sync` (برای همگام‌سازی و تشخیص Drift)

#### الف) `features/iot/services/mqtt/messageParser.ts` (خطوط ۳۴ تا ۴۰ و ۲۱۵ تا ۲۲۶)

در نوع بازگشتی `state_sync`، فیلد اختیاری `ids?: Record<string, string>` را اضافه کنید:

```ts
  | {
      kind: "state_sync";
      states: Record<string, boolean>;
      timers: Record<string, number>;
      values?: Record<string, number>;
      resolutions?: Record<string, number>;
      ids?: Record<string, string>;
    }
```

و درون شاخه `if (data.type === "state_sync" && data.states && !Array.isArray(data.states))` (قبل از `return`):

```ts
        let normalizedIds: Record<string, string> | undefined;
        if (data.ids && typeof data.ids === "object" && !Array.isArray(data.ids)) {
          normalizedIds = {};
          for (const key in data.ids) {
            if (Object.hasOwn(data.ids, key) && typeof data.ids[key] === "string") {
              const trimmed = data.ids[key].trim();
              if (trimmed.length > 0 && trimmed.length <= 31) {
                normalizedIds[key] = trimmed;
              }
            }
          }
        }

        return {
          kind: "state_sync",
          states: normalizedStates,
          timers: normalizedTimers,
          ...(normalizedValues !== undefined ? { values: normalizedValues } : {}),
          ...(normalizedResolutions !== undefined ? { resolutions: normalizedResolutions } : {}),
          ...(normalizedIds !== undefined ? { ids: normalizedIds } : {}),
        };
```

#### ب) `features/iot/services/mqtt/init.ts` (حدود خط ۴۳۰ — اختیاری ولی توصیه‌شده)

در بلوک `else if (parsedState.kind === "state_sync")` می‌توانید هنگام دریافت `parsedState.ids`، در صورت وجود اختلاف بین `segment.id` در داشبورد و `parsedState.ids[String(segment.pin)]` در ESP32، یک لاگ دیباگ ثبت کنید (یا در صورت تمایل یک پیام `0x02 ADD_SEGMENT` مجدد ارسال کنید که اکنون با رفتار `upsertSegment` در ESP32 بلافاصله ID را بدون حذف تنظیمات داشبورد همگام می‌کند).

> **توصیه طراحی:** برای جلوگیری از شکستن ارجاع‌های داخلی داشبورد (مانند Drag & Drop، چیدمان کارت‌ها یا Ruleها)، `segment.id` در استور داشبورد را بی‌صدا عوض نکنید؛ بلکه در صورت تشخیص drift در `parsedState.ids`، با توجه به اینکه ESP32 اکنون هم `0x02` upsert و هم `0x03` با `pin` را پشتیبانی می‌کند، داشبورد به‌عنوان Source of Truth باقی می‌ماند.

---

### تغییر ۴: بررسی سازگاری Cloudflare Worker (در صورت وجود ریپازیتوری جداگانه Worker)

در کدی که JSON ذخیره شده در Cloudflare KV را به متن `ESP_CFG_V2` تبدیل می‌کند، مطمئن شوید:
1. خط `C n=<تعداد سگمنت‌ها>` همیشه چاپ شود (حتی وقتی `n=0` است تا حذف آخرین سگمنت نیز روی ESP32 اعمال شود).
2. فیلد `id` هر سگمنت در خط `S id=<seg.id> type=... pin=...` **دقیقاً همان `seg.id` ذخیره‌شده از داشبورد** باشد و در Worker هرگز ID جدید تولید یا بازنویسی نشود.

---

## ۴. تست‌های پیشنهادی برای افزودن در داشبورد

در تست‌های موجود ریپازیتوری داشبورد (به‌خصوص `tests/safety-net.test.mjs`، `tests/domain-contracts.test.mjs` و `tests/mqtt-state-sync.test.mjs`) موارد زیر را اضافه و اجرا کنید:

1. **`buildDeleteSegmentFrame("jjib4yz", 5)`**:
   - بررسی شود که خروجی برابر با `[0x03, ...ascii("jjib4yz"), 0x00, 0x05]` است.
   - بررسی شود که `buildDeleteSegmentFrame("jjib4yz")` (بدون `pin`) همچنان فریم legacy `[0x03, ...ascii("jjib4yz"), 0x00]` می‌سازد.
   - بررسی شود که مقادیر نامعتبر `pin` (مثل `-1`, `40`, `""`, `undefined`, `NaN`) بایت اضافه نمی‌سازند.
2. **`createHardwareSegmentId` و `planAddSegment`**:
   - برای سگمنت سخت‌افزاری با `pin: "5"` شناسه برابر `"gpio_5"` تولید شود.
   - برای `type: "placeholder"` همچنان شناسه یکتای تصادفی تولید شود.
   - اگر `createId` سفارشی به `planAddSegment` پاس داده شود، از همان استفاده شود.
3. **`parseMqttStateMessage` برای `state_sync` دارای `"ids"`**:
   - ورودی `{"type":"state_sync","states":{"5":true},"ids":{"5":"gpio_5"},"timers":{"5":0}}` به‌درستی `kind: "state_sync"` و `ids: { "5": "gpio_5" }` را برگرداند.
   - ورودی قدیمی بدون `"ids"` همچنان بدون خطا پارس شود.

---

## ۵. خلاصه پروتکل باینری `DELETE_SEGMENT (0x03)` (مرجع سریع)

| نسخه | ساختار بایت‌ها | طول | توضیح |
| :--- | :--- | :--- | :--- |
| **v1 (Legacy)** | `[0x03] [id_0 ... id_k] [0x00]` | `2 + len(id)` | فقط حذف با `id` (و در فریم‌ور جدید fallback برای `gpio_<N>`) |
| **v2 (Extended)** | `[0x03] [id_0 ... id_k] [0x00] [pin:u8]` | `3 + len(id)` | حذف با `id` و در صورت عدم تطابق ID، fallback قطعی روی `GPIO pin` (`0..39`) |

- **سازگاری کامل دوطرفه:**
  - داشبورد جدید + فریم‌ور قدیمی: فریم‌ور قدیمی تا `0x00` را می‌خواند و بایت انتهایی را نادیده می‌گیرد (بدون کرش).
  - داشبورد قدیمی + فریم‌ور جدید: فریم‌ور جدید نبود بایت انتهایی را تشخیص می‌دهد و با `id` (و الگوی `gpio_<N>`) کار می‌کند.
  - داشبورد جدید + فریم‌ور جدید: حتی در صورت وجود هرگونه ناهماهنگی ID از گذشته، حذف سگمنت و افزودن مجدد آن روی هر GPIO به‌صورت ۱۰۰٪ تضمینی عمل می‌کند.
