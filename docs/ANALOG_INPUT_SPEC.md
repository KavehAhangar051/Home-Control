# مستند فنی و پروتکل سگمنت ورودی آنالوگ (`analog_input` / ADC)

این مستند مرجع کامل پیاده‌سازی پشتیبانی از سگمنت **ورودی آنالوگ (ADC1)** در دو بخش زیر است:
1. **Cloudflare Worker و دیتابیس (Durable Object / KV / D1)**
2. **داشبورد (Frontend / MQTT / Local WebSocket / Rule Editor)**

تمام جزئیات، ثابت‌ها، بایت‌چینی‌ها و منطق هیسترزیس این سند مستقیماً منطبق با پیاده‌سازی فعلی فریم‌ور ESP32 (سازگار با هر دو نسخه Arduino-ESP32 Core v2.x و Core v3.x) است.

---

## ۱. مشخصات پایه و محدودیت‌های سخت‌افزاری ESP32

| ویژگی | مقدار / قانون | توضیحات |
| :--- | :--- | :--- |
| **نام استاندارد نوع سگمنت (`type`)** | `"analog_input"` | فریم‌ور نام مستعار `"adc_input"` را نیز می‌پذیرد، اما مقدار رسمی در Worker و Dashboard باید **`"analog_input"`** باشد. |
| **پین‌های مجاز (فقط ADC1)** | **`32, 33, 34, 35, 36, 39`** | به دلیل استفاده سخت‌افزاری WiFi از ماژول ADC2 روی ESP32، پین‌های ADC2 (`0, 2, 4, 12..15, 25..27`) در حالت اتصال وای‌فای غیرقابل اعتمادند و توسط فریم‌ور (`GpioAdc::isValidAdcPin`) **رد می‌شوند**. |
| **بازه رزولوشن (`adcResolution` / `res`)** | `8` تا `12` بیت | پیش‌فرض: **`12`** (`0..4095`). حداکثر مقدار: `maxValue = (1 << res) - 1`. سخت‌افزار به صورت بومی روی ۱۲ بیت با تضعیف `ADC_11db` (~۰ تا ۳.۳ ولت) خوانده و به رزولوشن انتخابی مقیاس می‌شود. |
| **بازه نمونه‌برداری (`adcSampleIntervalMs` / `sint`)** | `50` تا `60000` میلی‌ثانیه | پیش‌فرض: **`500`** میلی‌ثانیه (`2Hz`). فواصل خارج از بازه توسط فریم‌ور Clamp می‌شوند. |
| **حساسیت تغییر (`adcDeltaThreshold` / `delta`)** | `1` تا `maxValue` | پیش‌فرض: **`40`** (~۱٪ در حالت ۱۲ بیت). تا زمانی که `|newValue - lastReportedValue| < delta` باشد، پیام شبکه ارسال نمی‌شود تا از اشباع MQTT/WS جلوگیری گردد. |
| **آستانه بالای اتوماسیون (`adcHighThreshold` / `ath`)** | `0` تا `maxValue` | پیش‌فرض: **`0`** (مقایسه‌گر آستانه و موتور قوانین غیرفعال است و فقط مقدار عددی گزارش می‌شود). |
| **آستانه پایین هیسترزیس (`adcLowThreshold` / `atl`)** | `0` تا `ath` | پیش‌فرض: **`0`**. همیشه `atl <= ath` تضمین می‌شود (اگر `ath == 0` باشد، `atl` نیز `0` می‌شود). |
| **فیلتر سخت‌افزاری / نرم‌افزاری** | `4x Oversampling` + `EMA (α=0.5)` | بدون محاسبات اعشاری (Integer-only) برای حذف نویز ADC روی ESP32، همراه با **Rail Snapping** در نقاط دقیق `0` و `maxValue` تا سنسورها به ۰٪ و ۱۰۰٪ دقیق برسند. |
| **ماهیت فقط‌خواندنی (Read-Only)** | غیرقابل نوشتن | هرگونه فرمان نوشتن (`0x01`, `0x0A`, `set_state`) روی پین‌های `analog_input` توسط فریم‌ور رد می‌شود. |

### منطق اشمیت‌تریگر (Schmitt-Trigger Hysteresis) و تعامل با RuleEngine
سگمنت `analog_input` می‌تواند علاوه بر نمایش مقدار زنده سنسور، مستقیماً **موتور قوانین (`RuleEngine`)** را تحریک کند (شامل قوانین `HIGH` / `LOW`، زمان نگه‌داری `requiredHoldTime: 0 | 3 | 5 | 10` و اکشن‌های دیجیتال یا آنالوگ `aval` روی `analog_output`):
- اگر **`ath == 0`**: وضعیت بولی سگمنت (`state`) همیشه `false` است و قانونی اجرا نمی‌شود (فقط Telemetry عددی).
- اگر **`ath > 0`**:
  - هنگام شروع (`begin`)، وضعیت اولیه `state = (initialValue >= ath)` ثبت می‌شود (بدون ایجاد تریگر کاذب در لحظه بوت).
  - در حین کار:
    - گذار **`LOW → HIGH`**: وقتی `filteredValue >= ath`.
    - گذار **`HIGH → LOW`**:
      - اگر `atl < ath` (حالت هیسترزیس، مثلاً `ath = 2800, atl = 2200`): وقتی `filteredValue <= atl`.
      - اگر `atl == ath` (تک‌آستانه، مثلاً `ath = 2500, atl = 2500`): وقتی `filteredValue < ath`.
  - مقادیر بین `atl` و `ath` در **باند مرده (Dead-zone)** قرار می‌گیرند و از نوسان/قطع‌ووصلی مداوم رله یا PWM جلوگیری می‌کنند.
  - به محض گذار `LOW ↔ HIGH`، رویداد `pin_update` فوری ارسال شده و `RuleEngine::handleInput` با مدت‌زمان ماندگاری وضعیت قبلی (`durationSec`) فراخوانی می‌شود.

---

## ۲. مدل داده پیشنهادی (Cloudflare Worker / Database / Dashboard)

### ۲.۱. مدل سگمنت (`Segment`)
نوع جدید `'analog_input'` و فیلدهای پیکربندی آن را به مدل سگمنت اضافه کنید:

```ts
export type SegmentType =
  | 'gpio_toggle'
  | 'output'
  | 'input'
  | 'analog_output'
  | 'analog_input';

export interface AnalogInputSegmentFields {
  type: 'analog_input';
  pin: 32 | 33 | 34 | 35 | 36 | 39; // فقط پین‌های ADC1 سازگار با WiFi
  value: boolean;                  // وضعیت منطقی آستانه (true = HIGH, false = LOW)
  analogValue: number;             // آخرین مقدار خوانده‌شده در بازه [0 .. (2^adcResolution - 1)]
  adcResolution: number;           // 8..12 بیت (پیش‌فرض: 12)
  adcSampleIntervalMs: number;     // 50..60000 میلی‌ثانیه (پیش‌فرض: 500)
  adcDeltaThreshold: number;       // 1..maxValue حساسیت انتشار تغییر (پیش‌فرض: 40)
  adcHighThreshold: number;        // 0..maxValue آستانه HIGH (0 = غیرفعال)
  adcLowThreshold: number;         // 0..adcHighThreshold آستانه LOW برای هیسترزیس
  rule?: InputRuleConfig;          // دقیقاً همان ساختار قوانین سگمنت input (شامل highActions / lowActions)
}
```

---

## ۳. بخش اول: مستند پیاده‌سازی در Cloudflare Worker و دیتابیس

### ۳.۱. تولید کانفیگ متنی `ESP_CFG_V2` (ارسال از Worker به ESP32)
در پاسخ به `{"type":"get_config"}`، سطر `S ` برای سگمنت‌های `analog_input` به شکل زیر تولید می‌شود:

```text
ESP_CFG_V2
C n=3
S id=dimmer_porch type=analog_output pin=18 val=0 res=8 freq=5000 ao=0
S id=ldr_porch type=analog_input pin=34 res=12 sint=500 delta=40 ath=2800 atl=2200
RH tgt=18 hld=3 ast=1 atp=0 dly=0 aval=200
RL tgt=18 hld=0 ast=0 atp=0 dly=0
S id=pot_volume type=analog_input pin=35 res=10 sint=200 delta=15 ath=0 atl=0
```

| کلید | الزامی | بازه مجاز | پیش‌فرض در فریم‌ور | توضیح |
| :--- | :---: | :--- | :---: | :--- |
| `id` | بله | حداکثر ۳۱ کاراکتر | — | شناسه یکتای سگمنت (بدون فاصله) |
| `type` | بله | `analog_input` | — | نوع سگمنت |
| `pin` | بله | `32, 33, 34, 35, 36, 39` | — | شماره GPIO روی ADC1 |
| `res` | خیر | `8..12` | `12` | رزولوشن خروجی بر حسب بیت |
| `sint` | خیر | `50..60000` | `500` | بازه نمونه‌برداری بر حسب میلی‌ثانیه |
| `delta` | خیر | `1..maxValue` | `40` | حداقل تغییر لازم برای ارسال Telemetry |
| `ath` | خیر | `0..maxValue` | `0` | آستانه HIGH برای اشمیت‌تریگر (`0` = غیرفعال) |
| `atl` | خیر | `0..ath` | `0` | آستانه LOW برای هیسترزیس |

- سطرهای قانون (`RH ` و `RL `) بلافاصله پس از سطر `S ` می‌آیند و دقیقاً از همان قالب استاندارد سگمنت `input` (از جمله کلید اختیاری `aval` برای تنظیم Duty روی `analog_output`) پیروی می‌کنند.

---

### ۳.۲. پروتکل WebSocket بین Cloudflare Worker و ESP32

#### الف) پیام‌های دریافتی Worker از ESP32
1. **تغییر مقدار یا وضعیت تک‌پین (`sync_pin`) — با Debounce یک‌ثانیه‌ای (`1000ms`):**
   ```json
   {
     "type": "sync_pin",
     "pin": 34,
     "state": true,
     "value": 3120,
     "resolution": 12
   }
   ```
   - برای جلوگیری از اشباع Durable Object / دیتابیس هنگام تغییرات پیوسته سنسور (مثلاً چرخاندن پتانسیومتر)، فریم‌ور ارسال `sync_pin` به کلادفلر را با تایمر **`1000ms`** Debounce می‌کند، اما مقدار نهایی دقیق را همیشه همگام‌سازی می‌نماید.
   - Worker باید در دیتابیس برای سگمنت با این `pin` هر دو مقدار `value (boolean) = msg.state` و `analogValue = msg.value` را ذخیره کند.

2. **همگام‌سازی کامل هنگام اتصال مجدد (`state_sync`):**
   ```json
   {
     "type": "state_sync",
     "states": { "2": true, "18": true, "34": true, "35": false },
     "values": { "18": 180, "34": 3120, "35": 512 },
     "resolutions": { "18": 8, "34": 12, "35": 10 },
     "timers": { "2": 0, "18": 45 }
   }
   ```
   - توجه: پین‌های `analog_input` در `states`, `values` و `resolutions` حضور دارند، اما در `timers` وجود ندارند (چون تایمر Auto-Off فقط مخصوص خروجی‌هاست).

#### ب) پیام‌های ارسالی Worker به ESP32
- در پاسخ به `get_all_states` هنگام اولین اتصال:
  - Worker نیازی به ارسال مقدار برای پین‌های `analog_input` در `state_sync` ندارد (چون سخت‌افزار مالک مقدار واقعی سنسور است). حتی اگر ارسال شود، فریم‌ور به صورت امن آن را نادیده می‌گیرد.
- **فریم باینری `0x0C` (تغییر زنده تنظیمات ADC از سمت Worker):**
  - `[0x0C][pin:u8][sint:u16LE][delta:u16LE][ath:u16LE][atl:u16LE]` (۱۰ بایت) یا همراه با `[res:u8]` (۱۱ بایت).
- **فریم باینری `0x0D` (درخواست خوانش فوری سنسور از سمت Worker):**
  - `[0x0D][pin:u8]` (۲ بایت) — فریم‌ور بلافاصله سنسور را خوانده و پاسخ را روی MQTT، Local WS و `sync_pin` کلادفلر منتشر می‌کند.

---

## ۴. بخش دوم: مستند پیاده‌سازی در داشبورد (Dashboard)

### ۴.۱. پروتکل باینری MQTT (انتشار روی `<baseTopic>/Command`)

> **قانون سراسری بایت‌چینی:** تمام اعداد چندبایتی (`uint16`, `int16`, `int32`) در پروتکل به صورت **Little-Endian (LE)** هستند.

#### ۱) Opcode `0x02` — افزودن سگمنت جدید `analog_input` (`ADD_SEGMENT`)
کاملاً سازگار با نسخه قبل؛ برای `type = "analog_input"` تا **۹ بایت متادیتای اختیاری تدریجی** در انتهای فریم پشتیبانی می‌شود:

| ترتیب | نوع | فیلد | بازه / پیش‌فرض | توضیح |
| :--- | :--- | :--- | :--- | :--- |
| بایت `0` | `uint8` | `opcode` | `0x02` | کد فرمان افزودن سگمنت |
| بایت `1` | `uint8` | `pin` | `32,33,34,35,36,39` | شماره GPIO (فقط ADC1) |
| بایت `2` | `uint8` | `legacyVal` | `0` | بدون استفاده برای ADC (مقدار `0` بفرستید) |
| متغیر | `c-string` | `id + '\0'` | حداکثر ۳۱ کاراکتر | شناسه یکتا |
| متغیر | `c-string` | `type + '\0'` | `"analog_input"` | رشته نوع سگمنت با پایان `0x00` |
| اختیاری (+1B) | `uint8` | `adcResolution` | `8..12` (پیش‌فرض `12`) | رزولوشن بیت |
| اختیاری (+2B) | `uint16 LE` | `adcSampleIntervalMs` | `50..60000` (پیش‌فرض `500`) | بازه نمونه‌برداری (ms) |
| اختیاری (+2B) | `uint16 LE` | `adcDeltaThreshold` | `1..maxValue` (پیش‌فرض `40`) | حساسیت انتشار تغییر |
| اختیاری (+2B) | `uint16 LE` | `adcHighThreshold` | `0..maxValue` (پیش‌فرض `0`) | آستانه HIGH اشمیت‌تریگر |
| اختیاری (+2B) | `uint16 LE` | `adcLowThreshold` | `0..ath` (پیش‌فرض `0`) | آستانه LOW هیسترزیس |

```ts
export function encodeAddAnalogInputSegment(
  id: string,
  pin: number,
  resolution = 12,
  sampleIntervalMs = 500,
  deltaThreshold = 40,
  highThreshold = 0,
  lowThreshold = 0
): Uint8Array {
  const enc = new TextEncoder();
  const idBytes = enc.encode(id);
  const typeBytes = enc.encode('analog_input');
  const res = Math.max(8, Math.min(12, Math.round(resolution)));
  const maxVal = (1 << res) - 1;
  const sint = Math.max(50, Math.min(60000, Math.round(sampleIntervalMs)));
  const delta = Math.max(1, Math.min(maxVal, Math.round(deltaThreshold)));
  const ath = Math.max(0, Math.min(maxVal, Math.round(highThreshold)));
  const atl = ath === 0 ? 0 : Math.max(0, Math.min(ath, Math.round(lowThreshold)));

  const totalLen = 3 + idBytes.length + 1 + typeBytes.length + 1 + 9;
  const buf = new Uint8Array(totalLen);
  const view = new DataView(buf.buffer);

  let off = 0;
  buf[off++] = 0x02;
  buf[off++] = pin & 0xFF;
  buf[off++] = 0; // legacyVal
  buf.set(idBytes, off); off += idBytes.length; buf[off++] = 0;
  buf.set(typeBytes, off); off += typeBytes.length; buf[off++] = 0;

  buf[off++] = res;
  view.setUint16(off, sint, true); off += 2;
  view.setUint16(off, delta, true); off += 2;
  view.setUint16(off, ath, true); off += 2;
  view.setUint16(off, atl, true);
  return buf;
}
```

#### ۲) Opcode `0x0C` — ویرایش زنده تنظیمات سگمنت ورودی آنالوگ (`UPDATE_ANALOG_INPUT_CONFIG`)
به داشبورد اجازه می‌دهد بدون حذف سگمنت و بدون از دست رفتن قوانین (`RuleConfig`)، بازه نمونه‌برداری، حساسیت، آستانه‌های هیسترزیس و رزولوشن را تغییر داده و در NVS ذخیره کند:

| آفست | اندازه | نوع | فیلد | توضیح |
| :---: | :---: | :--- | :--- | :--- |
| `0` | 1 | `uint8` | `opcode` | مقدار ثابت `0x0C` |
| `1` | 1 | `uint8` | `pin` | شماره GPIO سگمنت `analog_input` |
| `2..3` | 2 | `uint16 LE` | `sampleIntervalMs` | `50..60000` میلی‌ثانیه |
| `4..5` | 2 | `uint16 LE` | `deltaThreshold` | `1..maxValue` |
| `6..7` | 2 | `uint16 LE` | `highThreshold` | `0..maxValue` (`0` = غیرفعال) |
| `8..9` | 2 | `uint16 LE` | `lowThreshold` | `0..highThreshold` |
| `10` *(اختیاری)* | 1 | `uint8` | `resolution` | `0` برای حفظ رزولوشن فعلی، یا `8..12` برای تغییر بیت |

> **هشدار اعتبارسنجی فریم‌ور:** طول فریم باید دقیقاً **۱۰ یا ۱۱ بایت** باشد و مقدار `resolution` (در صورت ارسال) باید `0` یا بین `8..12` باشد.

```ts
export function encodeUpdateAnalogInputConfig(
  pin: number,
  sampleIntervalMs: number,
  deltaThreshold: number,
  highThreshold: number,
  lowThreshold: number,
  resolution?: number // undefined یا 0 = حفظ رزولوشن فعلی
): Uint8Array {
  const hasRes = resolution !== undefined && resolution > 0;
  const buf = new Uint8Array(hasRes ? 11 : 10);
  const view = new DataView(buf.buffer);

  buf[0] = 0x0C;
  buf[1] = pin & 0xFF;
  view.setUint16(2, Math.max(50, Math.min(60000, Math.round(sampleIntervalMs))), true);
  view.setUint16(4, Math.max(1, Math.min(4095, Math.round(deltaThreshold))), true);
  view.setUint16(6, Math.max(0, Math.min(4095, Math.round(highThreshold))), true);
  view.setUint16(8, Math.max(0, Math.min(4095, Math.round(lowThreshold))), true);
  if (hasRes) {
    buf[10] = Math.max(8, Math.min(12, Math.round(resolution!)));
  }
  return buf;
}
```

#### ۳) Opcode `0x0D` — خوانش لحظه‌ای سنسور (`READ_ANALOG_INPUT`)
برای دکمه «به‌روزرسانی لحظه‌ای / Refresh» روی کارت سنسور (عبور از `sampleIntervalMs` و `deltaThreshold` و ارسال فوری مقدار واقعی):

- **ساختار فریم (۲ بایت):** `[0x0D][pin:u8]`

```ts
export function encodeReadAnalogInput(pin: number): Uint8Array {
  return new Uint8Array([0x0D, pin & 0xFF]);
}
```

#### ۴) Opcode `0x05` و `0x0B` — به‌روزرسانی قوانین روی `analog_input`
هر دو فرمان `0x05` (اکشن‌های ۱۱ بایتی بولی) و `0x0B` (اکشن‌های ۱۳ بایتی با پشتیبانی مقدار PWM `targetValue`) بدون هیچ تغییری روی پین‌های `analog_input` نیز پذیرفته شده و در NVS (نسخه ۴) ذخیره می‌شوند.

---

### ۴.۲. پیام‌های دریافتی داشبورد از MQTT (`<baseTopic>/State`)

1. **گزارش تغییر مقدار یا عبور از آستانه (`pin_update`):**
   ```json
   {
     "type": "pin_update",
     "pin": 34,
     "state": true,
     "value": 3120,
     "resolution": 12,
     "source": "physical_input"
   }
   ```
   - هنگام تغییر طبیعی سنسور، `source` برابر `"physical_input"` است.
   - هنگام پاسخ به خوانش لحظه‌ای `0x0D` یا `read_analog`، `source` برابر `"local"` است.
   - داشبورد باید هر دو مقدار `analogValue = msg.value` و `value (boolean) = msg.state` را در کارت سگمنت به‌روزرسانی کند.

2. **همگام‌سازی کامل (`state_sync` — پاسخ به `0x09` یا `get_state`):**
   ```json
   {
     "type": "state_sync",
     "states": { "2": true, "18": true, "34": true, "35": false },
     "values": { "18": 180, "34": 3120, "35": 512 },
     "resolutions": { "18": 8, "34": 12, "35": 10 },
     "timers": { "2": 0, "18": 45 }
   }
   ```

---

### ۴.۳. پروتکل Local WebSocket (حالت مستقیم شبکه محلی - پورت `81`)

> **نکته حیاتی Zero-Heap Parser:** در JSON ارسالی به Local WS هیچ فاصله‌ای بعد از `:` نگذارید (از `JSON.stringify` استاندارد استفاده کنید).

- **خوانش لحظه‌ای ADC:**
  ```json
  {"command":"read_analog","pin":34}
  ```
- **ویرایش زنده تنظیمات ADC:**
  ```json
  {"command":"config_analog_input","pin":34,"sint":500,"delta":40,"ath":2800,"atl":2200,"res":12}
  ```
  *(توصیه می‌شود همیشه مقادیر فعلی `sint`, `delta`, `ath`, `atl` را همراه فرمان ارسال کنید؛ در صورت حذف، مقادیر پیش‌فرض `500 / 40 / 0 / 0` اعمال می‌شوند. ارسال نکردن `res` یا مقدار `0` رزولوشن فعلی را حفظ می‌کند.)*
- **دریافت وضعیت کامل:**
  ```json
  {"command":"get_state"}
  ```

---

## ۵. نکات مهم پیاده‌سازی UI و تجربه کاربری در داشبورد

1. **فیلتر سخت‌گیرانه پین‌های ADC1 در فرم افزودن سگمنت:**
   - وقتی کاربر نوع `analog_input` را انتخاب می‌کند، **فقط پین‌های `32, 33, 34, 35, 36, 39`** را فعال نمایش دهید و یک توضیح کوتاه بگذارید که سایر پین‌های آنالوگ (ADC2) با ماژول WiFi تداخل سخت‌افزاری دارند.
   - یادآوری برای کاربر: پین‌های `34, 35, 36, 39` روی ESP32 فقط‌ورودی (Input-Only) هستند و مقاومت Pull-Up/Pull-Down داخلی ندارند — ایده‌آل برای سنسورهای آنالوگ!
2. **محاسبه درصد و ولتاژ تقریبی در کارت سنسور:**
   ```ts
   const maxVal = (1 << segment.adcResolution) - 1; // 4095 برای 12-bit
   const percent = Math.round((segment.analogValue / maxVal) * 100);
   const approxVoltage = ((segment.analogValue / maxVal) * 3.3).toFixed(2); // ~0.00V .. 3.30V
   ```
3. **نمایش بصری باند هیسترزیس (Schmitt-Trigger):**
   - روی نوار پیشرفت یا گیج سنسور، اگر `adcHighThreshold > 0` است، دو نشانگر کوچک برای `atl` (آستانه پایین) و `ath` (آستانه بالا) و یک Badge وضعیت **`HIGH` / `LOW`** نمایش دهید تا کاربر دقیقاً ببیند چه زمانی قوانین تحریک می‌شوند.
   - در فرم ویرایش، اعتبارسنجی کنید که `0 <= atl <= ath <= maxVal` باشد.
4. **دکمه خوانش لحظه‌ای (Refresh):**
   - روی کارت سگمنت `analog_input` یک دکمه کوچک Refresh قرار دهید که در حالت MQTT فریم ۲ بایتی `0x0D` و در حالت Local WS فرمان `read_analog` را ارسال کند.
5. **پشتیبانی در ویرایشگر قوانین (Rule Editor):**
   - سگمنت‌های `analog_input` را در لیست سگمنت‌های دارای Rule (در کنار `input`) قرار دهید.
   - اگر `adcHighThreshold === 0` بود، در ویرایشگر قانون به کاربر یادآوری کنید که برای فعال شدن تریگر قانون، ابتدا آستانه `HIGH` (`ath`) و در صورت نیاز هیسترزیس `LOW` (`atl`) را تنظیم کند.
6. **تنظیمات پیشنهادی (Presets) برای سنسورهای رایج در فرم داشبورد:**
   - **پتانسیومتر / دیمر دستی:** `res=10` یا `12` · `sint=150ms` · `delta=20` · `ath=0`
   - **سنسور نور (LDR) / روشنایی خودکار:** `res=12` · `sint=1000ms` · `delta=60` · `ath=2800` · `atl=2200`
   - **سنسور رطوبت خاک / دما (NTC):** `res=12` · `sint=2000ms` · `delta=50` · `ath=2500` · `atl=2000`
