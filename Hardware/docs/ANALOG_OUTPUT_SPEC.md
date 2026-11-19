# مستند فنی و پروتکل سگمنت خروجی آنالوگ (`analog_output` / PWM)

این مستند مرجع کامل پیاده‌سازی پشتیبانی از سگمنت **خروجی آنالوگ (PWM / LEDC)** در دو بخش زیر است:
1. **Cloudflare Worker و دیتابیس (Durable Object / KV / D1)**
2. **داشبورد (Frontend / MQTT / Local WebSocket / Rule Editor)**

تمام جزئیات این سند مستقیماً منطبق با پیاده‌سازی فعلی فریم‌ور ESP32 (سازگار با هر دو نسخه Arduino-ESP32 Core v2.x و Core v3.x) است.

---

## ۱. مشخصات پایه و محدودیت‌های سخت‌افزاری ESP32

| ویژگی | مقدار / قانون | توضیحات |
| :--- | :--- | :--- |
| **نام استاندارد نوع سگمنت (`type`)** | `"analog_output"` | فریم‌ور نام مستعار `"pwm_output"` را نیز می‌پذیرد، اما مقدار رسمی در Worker و Dashboard باید **`"analog_output"`** باشد. |
| **حداکثر طول `id`** | ۳۱ کاراکتر | بافر ثابت ۳۲ بایتی در فریم‌ور (`char id[32]`). |
| **حداکثر طول `type`** | ۱۵ کاراکتر | بافر ثابت ۱۶ بایتی در فریم‌ور (`char type[16]`). `"analog_output"` دارای ۱۳ کاراکتر است. |
| **حداکثر تعداد کل سگمنت‌ها** | ۱۶ سگمنت | `MAX_SEGMENTS = 16` (حداکثر ۱۶ کانال LEDC روی ESP32). |
| **بازه رزولوشن (`pwmResolution` / `res`)** | `8` تا `12` بیت | پیش‌فرض: **`8`** (`0..255`). حداکثر: **`12`** (`0..4095`). مقادیر خارج از بازه توسط فریم‌ور Clamp می‌شوند. |
| **بازه فرکانس (`pwmFrequency` / `freq`)** | `100` تا `40000` هرتز | پیش‌فرض: **`5000`** هرتز (`5kHz`). مقادیر خارج از بازه Clamp می‌شوند. |
| **حداکثر مقدار Duty (`maxDuty`)** | `(1 << res) - 1` | ۸ بیت: `255` · ۹ بیت: `511` · ۱۰ بیت: `1023` · ۱۱ بیت: `2047` · ۱۲ بیت: `4095` (`MAX_ANALOG_OUTPUT_VALUE`). |
| **پین‌های غیرمجاز PWM** | `6, 7, 8, 9, 10, 11` (SPI Flash) و `34, 35, 36, 39` (Input-Only) | فریم‌ور این پین‌ها را در `addSegment` رد می‌کند (`GpioPwm::isValidPwmPin`). |
| **پین‌های پیشنهادی مجاز در UI** | `2, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33` | پین‌های `0, 1, 3` از نظر بیت‌مسک مجازند اما به دلیل Boot/UART بهتر است در UI با هشدار نمایش داده شوند. |

### منطق وضعیت (`state`)، مقدار (`value`) و حافظه آخرین مقدار (`lastNonZeroValue`)
- **رابطه `state` و `value`**: برای سگمنت `analog_output` همیشه `state === (value > 0)` است.
- **حافظه آخرین مقدار غیرصفر (`lastNonZeroValue`)**:
  - هرگاه مقدار صریح `value > 0` تنظیم شود، `lastNonZeroValue` به همان مقدار آپدیت می‌شود.
  - هرگاه خروجی خاموش شود (با `value = 0`، فرمان بولی `0x01` با `state = 0`، تایمر Auto-Off یا اکشن خاموشِ RuleEngine)، مقدار خروجی `0` می‌شود ولی **`lastNonZeroValue` حفظ می‌گردد**.
  - هرگاه فرمان روشن بولی (`0x01` با `state = 1` یا اکشن RuleEngine بدون مقدار صریح) ارسال شود، فریم‌ور خروجی را روی **`lastNonZeroValue`** بازمی‌گرداند (و اگر تاکنون مقدار غیرصفری نداشته باشد، روی `maxDuty` یعنی ۱۰۰٪ تنظیم می‌کند).

---

## ۲. مدل داده پیشنهادی (Cloudflare Worker / Database / Dashboard)

### ۲.۱. مدل سگمنت (`Segment`)
فیلدهای جدیدی که باید به مدل سگمنت در دیتابیس، Worker و Dashboard اضافه شوند:

```ts
export type SegmentType = 'gpio_toggle' | 'output' | 'input' | 'analog_output';

export interface AnalogSegmentFields {
  type: 'analog_output';
  pin: number;                // پین مجاز PWM
  value: boolean;             // وضعیت روشن/خاموش (= analogValue > 0)
  analogValue: number;        // مقدار فعلی Duty Cycle در بازه [0 .. (2^pwmResolution - 1)]
  lastNonZeroValue?: number;  // آخرین مقدار غیرصفر برای UI و همگام‌سازی ON/OFF
  pwmResolution: number;      // 8..12 (پیش‌فرض: 8)
  pwmFrequency: number;       // 100..40000 Hz (پیش‌فرض: 5000)
  autoOffDelay?: number;      // ثانیه (0 = غیرفعال)
}
```

### ۲.۲. مدل اکشن موتور قوانین (`RuleAction`)
فیلد جدید `targetValue` به اکشن‌های `highActions` و `lowActions` اضافه می‌شود:

```ts
export interface RuleAction {
  targetPin: number;          // 0..39
  requiredHoldTime: 0 | 3 | 5 | 10;
  actionState: boolean;       // در حالت بولی استفاده می‌شود؛ در حالت آنالوگ معادل (targetValue > 0)
  actionType: 0 | 1 | 2;      // 0 = IMMEDIATE, 1 = AFTER_DELAY, 2 = FOR_DURATION
  delay: number;              // 0..60 ثانیه
  targetValue?: number | null; // null یا -1 = حالت بولی ON/OFF (حفظ آخرین مقدار)
                               // 0..4095 = مقدار صریح PWM Duty
}
```

> **نکته رفتار `ACTION_FOR_DURATION` روی PWM:**
> - اگر اکشن مقدار صریح `targetValue > 0` داشته باشد، به مدت `delay` ثانیه آن مقدار اعمال می‌شود و پس از اتمام، خروجی به `0` برمی‌گردد (با حفظ `lastNonZeroValue`).
> - اگر اکشن `targetValue === 0` باشد، به مدت `delay` ثانیه خروجی `0` می‌شود و پس از اتمام به آخرین مقدار غیرصفر بازمی‌گردد.
> - اگر `targetValue` برابر `-1` (یا `null`) باشد، دقیقاً مثل حالت دودویی ON/OFF عمل کرده و از حافظه آخرین مقدار استفاده می‌کند.

---

## ۳. بخش اول: مستند پیاده‌سازی در Cloudflare Worker و دیتابیس

### ۳.۱. تولید کانفیگ متنی `ESP_CFG_V2` (ارسال از Worker به ESP32)
هنگامی که ESP32 پیام `{"type":"get_config"}` می‌فرستد، Worker کانفیگ متنی را با هدر `ESP_CFG_V2` برمی‌گرداند. فرمت سطرهای جدید و توسعه‌یافته:

#### تعریف سگمنت خروجی آنالوگ (`S `)
```text
ESP_CFG_V2
C n=2
S id=dimmer_living type=analog_output pin=18 val=128 res=8 freq=5000 ao=0
S id=fan_room type=analog_output pin=19 val=2048 res=12 freq=5000 ao=30
```
- `id`: شناسه یکتا (بدون فاصله)
- `type`: مقدار ثابت `analog_output`
- `pin`: شماره GPIO عددی (مثل `18`، نه `A0`)
- `val`: مقدار اولیه Duty (`0` تا `(1 << res) - 1`). در صورت عدم ارسال، `0` در نظر گرفته می‌شود.
- `res`: رزولوشن بیت (`8` تا `12`). اختیاری؛ پیش‌فرض `8`.
- `freq`: فرکانس بر حسب هرتز (`100` تا `40000`). اختیاری؛ پیش‌فرض `5000`.
- `ao`: تایمر Auto-Off پیش‌فرض بر حسب ثانیه. اختیاری؛ پیش‌فرض `0`.

#### تعریف قانون ورودی با اکشن آنالوگ (`RH ` و `RL `)
```text
S id=btn_wall type=input pin=5 val=0
RH tgt=18 hld=0 ast=1 atp=0 dly=0 aval=200
RH tgt=19 hld=3 ast=1 atp=2 dly=15 aval=3072
RL tgt=18 hld=0 ast=0 atp=0 dly=0
```
- `aval`: کلید جدید و اختیاری برای `targetValue` در بازه `0..4095`.
  - اگر `aval` ارسال شود (مقدار `0..4095`)، فریم‌ور دقیقاً همان Duty را اعمال می‌کند و `actionState` را خودکار برابر `(aval > 0)` قرار می‌دهد.
  - اگر `aval` ارسال نشود (یا `-1` باشد)، اکشن در حالت بولی (`ast=1` روشن با آخرین مقدار، `ast=0` خاموش) اجرا می‌شود.

---

### ۳.۲. پروتکل WebSocket بین Cloudflare Worker و ESP32

#### الف) ارسال وضعیت اولیه از Worker به ESP32 (پاسخ به `get_all_states`)
هنگام اولین اتصال، ESP32 پیام `{"type":"get_all_states"}` می‌فرستد. Worker باید پاسخ `state_sync` را با فیلد اختیاری **`values`** برگرداند:

```json
{
  "type": "state_sync",
  "states": {
    "2": true,
    "18": true,
    "19": false
  },
  "values": {
    "18": 180,
    "19": 0
  }
}
```
> **نکات مهم سمت Worker:**
> 1. فریم‌ور ابتدا آبجکت `"states"` و بلافاصله پس از آن آبجکت `"values"` را پردازش می‌کند؛ بنابراین مقدار دقیق پین‌های `analog_output` در `"values"` اولویت نهایی دارد.
> 2. ظرفیت بافر JSON در ESP32 برابر `StaticJsonDocument<1536>` است؛ ساختار JSON را بدون فضاهای اضافی (minified) و فقط با کلیدهای ضروری (`type`, `states`, `values`) ارسال کنید.

#### ب) ارسال فرمان اتوماسیون باینری از Worker به ESP32
علاوه بر فریم‌های قبلی (`0x06` تک‌پین بولی و `0x08` دسته‌ای بولی)، فریم باینری جدید **`0x0A`** برای تنظیم مقدار دقیق PWM در اتوماسیون‌های سرور پشتیبانی شده است:

| بایت | نام فیلد | نوع | توضیح |
| :---: | :--- | :--- | :--- |
| `0` | `opcode` | `uint8` | مقدار ثابت `0x0A` |
| `1` | `pin` | `uint8` | شماره GPIO هدف (`0..39`) |
| `2..3` | `value` | `uint16 LE` | مقدار PWM Duty (`0..4095`) به صورت Little-Endian |

**نمونه کد TypeScript در Cloudflare Worker:**
```ts
export function encodeCloudflareAnalogFrame(pin: number, value: number): Uint8Array {
  const clamped = Math.max(0, Math.min(4095, Math.round(value)));
  const buf = new Uint8Array(4);
  buf[0] = 0x0A;
  buf[1] = pin & 0xFF;
  buf[2] = clamped & 0xFF;
  buf[3] = (clamped >> 8) & 0xFF;
  return buf;
}
```
> فریم `0x0A` دریافتی از WebSocket کلادفلر با منشأ `PinStateChangeOrigin::Cloudflare` اجرا می‌شود و بنابراین ESP32 مجدداً آن را به کلادفلر Echo نمی‌کند (جلوگیری از حلقه همگام‌سازی).

#### ج) پیام‌های دریافتی Worker از ESP32
Worker باید این دو پیام متنی را از ESP32 پردازش و در دیتابیس/Durable Object ذخیره کند:

1. **تغییر وضعیت تک‌پین (`sync_pin`)** — ناشی از ورودی فیزیکی، RuleEngine یا تغییر محلی:
   ```json
   {
     "type": "sync_pin",
     "pin": 18,
     "state": true,
     "value": 180,
     "resolution": 8
   }
   ```
   - برای پین‌های دیجیتال، فیلدهای `value` و `resolution` وجود ندارند (`{"type":"sync_pin","pin":2,"state":true}`).
   - برای پین‌های `analog_output`، Worker باید هم `state` و هم `analogValue = msg.value` را ذخیره کند و اگر `msg.value > 0` بود، `lastNonZeroValue = msg.value` را نیز به‌روزرسانی نماید.

2. **همگام‌سازی کامل هنگام اتصال مجدد (`state_sync`)**:
   ```json
   {
     "type": "state_sync",
     "states": { "2": true, "18": true, "19": false },
     "values": { "18": 180, "19": 0 },
     "resolutions": { "18": 8, "19": 12 },
     "timers": { "2": 0, "18": 45, "19": 0 }
   }
   ```
   - Worker باید در حالت reconnect، مقادیر `values` و `states` را در Durable Object/DB ذخیره کرده و به کلاینت‌های داشبورد اطلاع‌رسانی کند.

3. **نکته مهم درباره مالکیت ذخیره (`DashboardCommand`)**:
   - دقیقاً مشابه سگمنت دیجیتال، زمانی که داشبورد فرمانی از طریق MQTT یا Local WS می‌فرستد، ESP32 فقط `command_ack` روی MQTT می‌فرستد و `sync_pin` به Worker ارسال **نمی‌کند**. بنابراین Endpointهای API در Worker که داشبورد برای ذخیره تغییر وضعیت صدا می‌زند باید فیلد `analogValue` (و `pwmResolution`/`pwmFrequency` هنگام ساخت/ویرایش سگمنت) را بپذیرند و ذخیره کنند.

---

## ۴. بخش دوم: مستند پیاده‌سازی در داشبورد (Dashboard)

### ۴.۱. پروتکل باینری MQTT (انتشار روی `<baseTopic>/Command`)

> **قانون سراسری بایت‌چینی:** تمام اعداد چندبایتی (`uint16`, `int16`, `int32`) در پروتکل به صورت **Little-Endian (LE)** هستند.

#### ۱) Opcode `0x0A` — تنظیم مقدار خروجی آنالوگ (`SET_ANALOG_OUTPUT`)
برای تغییر اسلایدر PWM (همراه یا بدون تایمر Auto-Off):

- **فرم کامل (۸ بایت — توصیه‌شده):**
  | آفست | اندازه | نوع | فیلد | توضیح |
  | :---: | :---: | :--- | :--- | :--- |
  | `0` | 1 | `uint8` | `opcode` | `0x0A` |
  | `1` | 1 | `uint8` | `pin` | شماره GPIO (`0..39`) |
  | `2..3` | 2 | `uint16 LE` | `value` | مقدار Duty (`0..maxDuty`) |
  | `4..7` | 4 | `int32 LE` | `timer` | زمان Auto-Off بر حسب ثانیه (`0` یا `-1` برای لغو/بدون تایمر) |

- **فرم فشرده (۴ بایت — بدون تایمر):**
  `[0x0A][pin:u8][value:u16LE]` (فریم‌ور `timer` را `-1` در نظر می‌گیرد و تایمر قبلی را لغو می‌کند).

```ts
export function encodeSetAnalogOutput(pin: number, value: number, timerSeconds = 0): Uint8Array {
  const clamped = Math.max(0, Math.min(4095, Math.round(value)));
  const buf = new Uint8Array(8);
  const view = new DataView(buf.buffer);
  buf[0] = 0x0A;
  buf[1] = pin & 0xFF;
  view.setUint16(2, clamped, true);       // Little-Endian
  view.setInt32(4, timerSeconds | 0, true); // Little-Endian
  return buf;
}
```

#### ۲) Opcode `0x01` — کلید روشن/خاموش سریع (`TOGGLE_PIN`)
ساختار ۷ بایتی قبلی بدون هیچ تغییری روی پین‌های `analog_output` نیز کار می‌کند:
- `[0x01][pin:u8][state:u8][timer:i32LE]`
- اگر `state = 0x00`: خروجی PWM صفر می‌شود و آخرین مقدار غیرصفر در حافظه ESP32 می‌ماند.
- اگر `state = 0x01`: آخرین مقدار غیرصفر بازگردانی می‌شود (و اگر تایمر `> 0` باشد، Auto-Off فعال می‌شود).

#### ۳) Opcode `0x02` — افزودن سگمنت جدید (`ADD_SEGMENT`)
کاملاً سازگار با نسخه قبل، با **۵ بایت متادیتای اختیاری در انتهای فریم** برای `analog_output`:

| ترتیب | نوع | فیلد | توضیح |
| :--- | :--- | :--- | :--- |
| بایت `0` | `uint8` | `opcode` | `0x02` |
| بایت `1` | `uint8` | `pin` | شماره GPIO |
| بایت `2` | `uint8` | `legacyVal` | مقدار اولیه قدیمی (برای دیجیتال `0/1`؛ برای PWM بهتر است `0` باشد و مقدار دقیق در `initVal` بیاید) |
| متغیر | `c-string` | `id + '\0'` | شناسه سگمنت با پایان `0x00` |
| متغیر | `c-string` | `type + '\0'` | رشته `"analog_output"` با پایان `0x00` |
| اختیاری (+1B) | `uint8` | `resolution` | `8..12` (پیش‌فرض `8`) |
| اختیاری (+2B) | `uint16 LE` | `frequency` | `100..40000` (پیش‌فرض `5000`) |
| اختیاری (+2B) | `uint16 LE` | `initialValue` | `0..4095` (مقدار شروع PWM) |

```ts
export function encodeAddAnalogSegment(
  id: string,
  pin: number,
  resolution = 8,
  frequency = 5000,
  initialValue = 0
): Uint8Array {
  const enc = new TextEncoder();
  const idBytes = enc.encode(id);
  const typeBytes = enc.encode('analog_output');
  const totalLen = 3 + idBytes.length + 1 + typeBytes.length + 1 + 5;
  const buf = new Uint8Array(totalLen);
  const view = new DataView(buf.buffer);

  let off = 0;
  buf[off++] = 0x02;
  buf[off++] = pin & 0xFF;
  buf[off++] = 0; // legacyVal
  buf.set(idBytes, off); off += idBytes.length; buf[off++] = 0;
  buf.set(typeBytes, off); off += typeBytes.length; buf[off++] = 0;

  buf[off++] = Math.max(8, Math.min(12, resolution));
  view.setUint16(off, Math.max(100, Math.min(40000, frequency)), true); off += 2;
  view.setUint16(off, Math.max(0, Math.min(4095, initialValue)), true);
  return buf;
}
```

#### ۴) Opcode `0x0B` — به‌روزرسانی قانون با پشتیبانی مقدار PWM (`UPDATE_RULE_ANALOG`)
- Opcode `0x05` قبلی (با اکشن‌های ۱۱ بایتی) بدون تغییر باقی مانده است.
- Opcode **`0x0B`** ساختار دقیقاً مشابهی دارد اما هر اکشن **۱۳ بایت** است (اضافه شدن ۲ بایت `int16 LE` در انتهای هر اکشن برای `targetValue`).
- **ساختار کل فریم:**
  `[0x0B][inputPin:u8][highCount:u8][highAction_0 (13B)...][lowCount:u8][lowAction_0 (13B)...]`
- **ساختار هر اکشن ۱۳ بایتی:**
  | آفست درون اکشن | اندازه | نوع | فیلد | بازه مجاز |
  | :---: | :---: | :--- | :--- | :--- |
  | `0` | 1 | `int8` | `targetPin` | `0..39` |
  | `1..4` | 4 | `int32 LE` | `requiredHoldTime` | فقط `0`, `3`, `5`, `10` |
  | `5` | 1 | `uint8` | `actionState` | `0x00` یا `0x01` |
  | `6` | 1 | `uint8` | `actionType` | `0` (Immediate), `1` (AfterDelay), `2` (ForDuration) |
  | `7..10` | 4 | `int32 LE` | `delay` | `0..60` ثانیه |
  | `11..12` | 2 | `int16 LE` | `targetValue` | `-1` (حالت بولی) یا `0..4095` (مقدار دقیق PWM) |

> **هشدار اعتبارسنجی فریم‌ور:** فریم‌ور طول کل فریم را دقیق بررسی می‌کند (`offset != len` باعث رد شدن فریم می‌شود) و حداکثر ۴ اکشن برای `HIGH` و ۴ اکشن برای `LOW` می‌پذیرد.

```ts
export function encodeUpdateRuleAnalog(
  inputPin: number,
  highActions: RuleAction[],
  lowActions: RuleAction[]
): Uint8Array {
  const hi = highActions.slice(0, 4);
  const lo = lowActions.slice(0, 4);
  const totalLen = 4 + (hi.length + lo.length) * 13;
  const buf = new Uint8Array(totalLen);
  const view = new DataView(buf.buffer);

  let off = 0;
  buf[off++] = 0x0B;
  buf[off++] = inputPin & 0xFF;

  const writeActions = (list: RuleAction[]) => {
    buf[off++] = list.length;
    for (const a of list) {
      const hasAnalog = a.targetValue !== null && a.targetValue !== undefined && a.targetValue >= 0;
      const tVal = hasAnalog ? Math.min(4095, Math.round(a.targetValue!)) : -1;
      buf[off] = a.targetPin & 0xFF;
      view.setInt32(off + 1, a.requiredHoldTime | 0, true);
      buf[off + 5] = (hasAnalog ? tVal > 0 : a.actionState) ? 0x01 : 0x00;
      buf[off + 6] = a.actionType & 0xFF;
      view.setInt32(off + 7, a.delay | 0, true);
      view.setInt16(off + 11, tVal, true);
      off += 13;
    }
  };

  writeActions(hi);
  writeActions(lo);
  return buf;
}
```

---

### ۴.۲. پیام‌های دریافتی داشبورد از MQTT (`<baseTopic>/State`)

داشبورد باید در شنونده پیام‌های `/State` این ۳ قالب JSON را پشتیبانی کند:

1. **تاییدیه فرمان (`command_ack`):**
   ```json
   { "type": "command_ack", "pin": 18, "state": true, "value": 180, "resolution": 8 }
   ```
   *(اگر فیلد `value` وجود داشت، وضعیت تاییدشده مقدار آنالوگ پین را هم آپدیت کنید.)*

2. **تغییر وضعیت مستقل (`pin_update`):**
   ```json
   {
     "type": "pin_update",
     "pin": 18,
     "state": true,
     "value": 180,
     "resolution": 8,
     "source": "automation"
   }
   ```
   مقادیر ممکن برای `source`: `"automation"` | `"physical_input"` | `"cloudflare"` | `"local"`.

3. **همگام‌سازی کامل (`state_sync` — پاسخ به `0x09` یا `get_state`):**
   ```json
   {
     "type": "state_sync",
     "states": { "2": true, "18": true, "19": false },
     "values": { "18": 180, "19": 0 },
     "resolutions": { "18": 8, "19": 12 },
     "timers": { "2": 0, "18": 45, "19": 0 }
   }
   ```

---

### ۴.۳. پروتکل Local WebSocket (حالت مستقیم شبکه محلی - پورت `81`)

سرور محلی WebSocket روی ESP32 (`WsServerParser`) برای حفظ Zero-Heap از پارس مستقیم رشته‌ای استفاده می‌کند. **نکته حیاتی: در JSON ارسالی به Local WS هیچ فاصله‌ای (whitespace) بعد از `:` نگذارید (از `JSON.stringify` استاندارد استفاده کنید).**

- **تنظیم مقدار PWM (با `set_state` یا `set_analog`):**
  ```json
  {"command":"set_state","pin":18,"value":180,"timer":30}
  ```
  یا:
  ```json
  {"command":"set_analog","pin":18,"value":2048}
  ```
- **کلید ON/OFF سریع (بازگردانی آخرین مقدار / صفر کردن):**
  ```json
  {"command":"set_state","pin":18,"state":1,"timer":0}
  ```
- **دریافت وضعیت کامل:**
  ```json
  {"command":"get_state"}
  ```
  پاسخ دقیقاً همان JSON `state_sync` شامل `states`, `values`, `resolutions`, `timers` است.

---

## ۵. نکات مهم پیاده‌سازی UI و تجربه کاربری در داشبورد

1. **Throttle روی اسلایدر (جلوگیری از اشباع MQTT/ESP32):**
   - هنگام کشیدن اسلایدر (Drag)، ارسال فریم `0x0A` را با بازه **`80ms` تا `120ms`** Throttle کنید و در رویداد `onPointerUp` / `onChange` نهایی، مقدار دقیق آخر را بلافاصله ارسال نمایید تا هم نرمی کنترل لحظه‌ای حفظ شود و هم صف شبکه پر نشود.
2. **نمایش درصد و تبدیل رزولوشن:**
   - همیشه `maxDuty = (1 << resolution) - 1` را بر اساس رزولوشن همان سگمنت محاسبه کنید (`255` برای ۸ بیت، `4095` برای ۱۲ بیت).
   - نمایش درصد برای کاربر: `percent = Math.round((analogValue / maxDuty) * 100)`.
   - تبدیل درصد کاربر به Duty: `duty = Math.round((percent / 100) * maxDuty)`.
3. **دکمه پاور در کنار اسلایدر:**
   - روی کارت سگمنت `analog_output` هم یک دکمه پاور (ارسال `0x01` برای حفظ آخرین مقدار) و هم اسلایدر (ارسال `0x0A`) قرار دهید. اگر کاربر روی پاور کلیک کرد و `state` از `false` به `true` رفت، مقدار اسلایدر در UI به `lastNonZeroValue` (و در پاسخ `command_ack` به مقدار دقیق بازگشتی از ESP32) تنظیم می‌شود.
4. **مدیریت Auto-Off محلی:**
   - مشابه خروجی دیجیتال، پایان طبیعی تایمر Auto-Off در ESP32 بدون ارسال `pin_update` انجام می‌شود (زیرا داشبورد شمارش معکوس را محلی اجرا می‌کند). با رسیدن شمارش معکوس داشبورد به `0`، وضعیت کارت را به `state = false, analogValue = 0` تغییر دهید و `lastNonZeroValue` را دست‌نخورده نگه دارید.
5. **فرم افزودن/ویرایش سگمنت:**
   - هنگام انتخاب نوع `analog_output`:
     - پین‌های `6..11` و `34, 35, 36, 39` را غیرفعال/فیلتر کنید.
     - انتخاب رزولوشن (`8-bit: 0..255` پیش‌فرض و `12-bit: 0..4095`) و فرکانس (پیش‌فرض `5000 Hz`، قابل تغییر در بازه `100..40000`) را ارائه دهید.
6. **ویرایشگر قوانین (Rule Editor):**
   - وقتی پین هدف (`targetPin`) یک سگمنت `analog_output` است، به کاربر اجازه انتخاب دو حالت را بدهید:
     - **حالت بولی (روشن با آخرین مقدار / خاموش):** `targetValue = -1` (در `ESP_CFG_V2` کلید `aval` حذف می‌شود).
     - **حالت مقدار دقیق PWM:** اسلایدر `0..maxDuty` که در `targetValue` و کلید `aval` ذخیره و با Opcode **`0x0B`** ارسال می‌شود.
