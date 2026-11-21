# مستند فنی و راهنمای پیاده‌سازی موتور قوانین نسخه ۲ (`RuleEngine v2`)
## پشتیبانی از «شرط چندبازه‌ای ورودی آنالوگ (`analog_input`)» و «دابل‌کلیک ورودی دیجیتال (`input`)»

این سند مرجع کامل برای پیاده‌سازی تغییرات **داشبورد (Frontend / Rule Editor / MQTT)** و **Cloudflare Worker و دیتابیس (Durable Object / D1 / KV)** است و به‌طور مستقیم با کد فعلی فریم‌ور ESP32 (تست‌شده روی هر دو Core v2 و Core v3) منطبق می‌باشد.

---

## ۱. خلاصه قابلیت‌های جدید در فریم‌ور ESP32

### ۱.۱. موتور شرط چندبازه‌ای برای سگمنت ورودی آنالوگ (`analog_input`)
در نسخه قبلی، ورودی آنالوگ فقط می‌توانست از یک جفت آستانه (`ath`/`atl`) مشابه کلید دیجیتال استفاده کند. در نسخه جدید:
- برای **هر پین `analog_input`** می‌توان تا **`6` بازه مستقل (`MAX_ANALOG_RANGE_RULES = 6`)** تعریف کرد.
- هر بازه دارای `minValue` و `maxValue` (شامل دو سر بازه: `minValue <= value <= maxValue`)، مقدار **هیسترزیس اختصاصی (`hysteresis`)**، نوع تریگر (**ورود به بازه `enter`** یا **خروج از بازه `exit`**)، پین هدف (خروجی دیجیتال `output` یا خروجی آنالوگ PWM `analog_output`)، نوع عملیات (`immediate` / `after_delay` / `for_duration`) و تاخیر (`0..60` ثانیه) است.
- بازه‌ها می‌توانند **مجزا** (مثلاً `0..1000`، `1500..2500`، `3000..4095`) یا **هم‌پوشان (Overlapping)** باشند؛ فریم‌ور وضعیت هر ۶ بازه را همزمان با یک Bitmask ۶بیتی و کد Branchless Xtensa ASM (`asm_range_eval`) ارزیابی می‌کند.
- **مقابله با تریگر کاذب در لحظه بوت یا آپدیت قانون:** هنگام اضافه‌شدن سگمنت یا آپدیت قوانین، فریم‌ور مقدار فعلی ADC را خوانده و Bitmask اولیه بازه‌ها را Seed می‌کند؛ بنابراین اگر سنسور در لحظه روشن‌شدن از قبل درون یک بازه باشد، فرمان ناخواسته اجرا نمی‌شود.
- **مستقل از `adcDeltaThreshold`:** حتی اگر `deltaThreshold` عدد بزرگی باشد و گام تغییر سنسور کوچکتر از `delta` باشد، عبور از مرز هر بازه (`rangeMaskChanged`) فوراً موتور قانون را اجرا می‌کند.
- **منطق هیسترزیس هر بازه (`hysteresis`):**
  - وقتی سنسور **خارج از بازه** است (`wasInRange = false`): شرط ورود دقیقاً `minValue <= value <= maxValue` است.
  - وقتی سنسور **داخل بازه** است (`wasInRange = true`): برای خروج باید از بازه گسترده‌شده `[max(0, minValue - hyst) .. min(maxScale, maxValue + hyst)]` خارج شود تا از نوسان/قطع‌ووصلی مداوم (Chatter) روی مرز جلوگیری شود.
- **سازگاری کامل با گذشته:** مکانیزم قدیمی `ath`/`atl` + `RH`/`RL` همچنان حفظ شده است و اگر کاربری از قبل قانون قدیمی داشته باشد، بدون شکست کار می‌کند؛ اما در رابط کاربری جدید برای `analog_input` باید **مدل چندبازه‌ای (`analogRanges`)** به‌عنوان روش اصلی نمایش داده شود.

### ۱.۲. شرط «دابل کلیک (`double_click`)» برای سگمنت ورودی دیجیتال (`input`)
- یک شرط جدید به شرط‌های ورودی دیجیتال اضافه شده است که در پروتکل با مقدار عددی **`requiredHoldTime = -1`** (و در کانفیگ متنی با `hld=-1` یا `hld=dc` یا `hld=double_click`) نمایش داده می‌شود.
- **پنجره زمانی تشخیص دابل‌کلیک:** **`400` میلی‌ثانیه** (`DEFAULT_DOUBLE_CLICK_WINDOW_MS = 400`) از لحظه رهاشدن کلیک اول تا فشرده‌شدن کلیک دوم.
- **رفتار هوشمند و هم‌زیستی (Coexistence) با تک‌کلیک و نگه‌داشتن:**
  1. **اگر روی یک قطبیت (مثلاً `HIGH`) دابل‌کلیک تعریف نشده باشد:** تک‌کلیک (`hld = 0`) با **تأخیر صفر (0ms)** دقیقاً مثل قبل در لحظه فشردن اجرا می‌شود.
  2. **اگر روی یک قطبیت هم تک‌کلیک (`hld = 0`) و هم دابل‌کلیک (`hld = -1`) تعریف شده باشد:**
     - پس از رهاشدن کلیک اول، فریم‌ور تایمر `400ms` را فعال می‌کند و اجرای تک‌کلیک را موقتاً به تعویق می‌اندازد.
     - اگر در طول `400ms` کلیک دوم رخ دهد: تایمر تک‌کلیک لغو شده و **فقط عملیات دابل‌کلیک** فوراً اجرا می‌شود (رهاکردن کلیک دوم هیچ عملیات اضافه‌ای تولید نمی‌کند).
     - اگر پس از `400ms` کلیک دومی رخ ندهد: **فقط عملیات تک‌کلیک (`hld = 0`)** اجرا می‌شود.
  3. **اگر دابل‌کلیک (`hld = -1`) در کنار نگه‌داشتن (`hld = 3 | 5 | 10`) تعریف شده باشد:**
     - اگر کلید به مدت `>= 2` ثانیه نگه داشته شود، ردیابی کلیک لغو شده و هنگام رهاکردن، عملیات Hold-Time مربوطه (`3s` / `5s` / `10s`) اجرا می‌شود.
     - اگر دو بار سریع فشرده شود، عملیات دابل‌کلیک اجرا می‌شود.
- دابل‌کلیک مانند سایر اکشن‌ها می‌تواند هم خروجی دیجیتال (`ast=0|1`) و هم خروجی آنالوگ PWM (`aval=0..4095`) را با هر سه نوع عملیات (`immediate`, `after_delay`, `for_duration`) کنترل کند.

---

## ۲. مدل داده TypeScript (برای دیتابیس، Cloudflare Worker و Dashboard)

### ۲.۱. به‌روزرسانی شرط ورودی دیجیتال (`RuleAction`)
مقدار **`-1`** را به مقادیر مجاز `requiredHoldTime` اضافه کنید:

```ts
/**
 * مقادیر مجاز شرط ورودی دیجیتال:
 *  -1 : دابل کلیک (Double Click - پنجره 400ms)
 *   0 : تک کلیک / لحظه‌ای (Single Click / Immediate)
 *   3 : نگه‌داشتن ۳ ثانیه
 *   5 : نگه‌داشتن ۵ ثانیه
 *  10 : نگه‌داشتن ۱۰ ثانیه
 */
export type DigitalHoldTime = -1 | 0 | 3 | 5 | 10;

export type RuleActionType = 0 | 1 | 2;
// 0 = ACTION_IMMEDIATE (فوری)
// 1 = ACTION_AFTER_DELAY (اجرا پس از delay ثانیه)
// 2 = ACTION_FOR_DURATION (اجرا به مدت delay ثانیه و سپس بازگشت)

export interface RuleAction {
  targetPin: number;            // GPIO هدف (0..39)
  requiredHoldTime: DigitalHoldTime; // -1 | 0 | 3 | 5 | 10
  actionState: boolean;         // true = ON, false = OFF
  actionType: RuleActionType;   // 0 | 1 | 2
  delay: number;                // 0..60 ثانیه
  targetValue?: number;         // اختیاری: -1 یا undefined برای حالت دیجیتال، 0..4095 برای خروجی PWM
}
```

### ۲.۲. مدل قانون چندبازه‌ای ورودی آنالوگ (`AnalogRangeRule`)
```ts
export const MAX_ANALOG_RANGE_RULES = 6;
export const RULE_TRIGGER_DOUBLE_CLICK = -1;
export const RULE_ANALOG_VALUE_UNSET = -1;

export type AnalogRangeTriggerMode = 0 | 1;
// 0 = RANGE_ON_ENTER ('enter') — اجرا هنگام ورود مقدار سنسور به بازه [minValue..maxValue]
// 1 = RANGE_ON_EXIT  ('exit')  — اجرا هنگام خروج مقدار سنسور از بازه (با درنظر گرفتن hysteresis)

export interface AnalogRangeRule {
  minValue: number;             // 0..maxAdcValue (حداقل بازه)
  maxValue: number;             // minValue..maxAdcValue (حداکثر بازه)
  hysteresis: number;           // 0..floor(maxAdcValue / 2) — پیش‌فرض پیشنهادی: 20..50
  triggerMode: AnalogRangeTriggerMode; // 0 = enter, 1 = exit
  targetPin: number;            // GPIO خروجی هدف (output یا analog_output)
  actionState: boolean;         // برای خروجی دیجیتال (true/false)
  targetValue?: number;         // -1 یا undefined برای دیجیتال، 0..4095 برای analog_output (PWM)
  actionType: RuleActionType;   // 0 = فوری، 1 = بعد از تاخیر، 2 = برای مدت مشخص
  delay: number;                // 0..60 ثانیه
  enabled?: boolean;            // پیش‌فرض: true
}

export interface InputRuleConfig {
  active: boolean;
  highActions: RuleAction[];         // برای سگمنت input (حداکثر 4 عدد)
  lowActions: RuleAction[];          // برای سگمنت input (حداکثر 4 عدد)
  analogRanges?: AnalogRangeRule[];  // برای سگمنت analog_input (حداکثر 6 عدد)
}
```

> **نکته کلیدی در محاسبه `active`:**
> در Worker و Dashboard، مقدار `rule.active` باید زمانی `true` باشد که حداقل یکی از `highActions`، `lowActions` یا `analogRanges` دارای آیتم باشد:
> ```ts
> const isActive =
>   (rule.highActions?.length ?? 0) > 0 ||
>   (rule.lowActions?.length ?? 0) > 0 ||
>   (rule.analogRanges?.length ?? 0) > 0;
> ```

---

## ۳. تغییرات پروتکل کانفیگ متنی `ESP_CFG_V2` (در Cloudflare Worker)

در تابعی که کانفیگ `ESP_CFG_V2` را برای ESP32 تولید می‌کند، دو تغییر زیر را اعمال کنید:

### ۳.۱. سطرهای `RH` / `RL` برای دابل‌کلیک دیجیتال
اگر `action.requiredHoldTime === -1` باشد، مقدار `hld=-1` (یا `hld=dc`) را خروجی دهید:
```text
S id=btn_room type=input pin=4
RH tgt=2 hld=0 ast=1 atp=0 dly=0
RH tgt=18 hld=-1 aval=200 atp=0 dly=0
RH tgt=2 hld=3 ast=0 atp=0 dly=0
```
- فریم‌ور هر سه فرمت `hld=-1`، `hld=dc` و `hld=double_click` را می‌پذیرد. پیشنهاد رسمی برای یکپارچگی: **`hld=-1`**.

### ۳.۲. سطر جدید `RR` (Rule Range) برای بازه‌های ورودی آنالوگ
بلافاصله بعد از سطر `S id=... type=analog_input ...`، به ازای هر آیتم فعال در `segment.rule.analogRanges` (حداکثر ۶ سطر)، یک سطر با پیشوند **`RR `** تولید کنید:

```text
S id=temp_sensor type=analog_input pin=34 res=12 sint=200 delta=40 ath=0 atl=0
RR min=0 max=1000 hyst=40 tgt=18 aval=64 trg=enter atp=0 dly=0
RR min=1500 max=2500 hyst=50 tgt=18 aval=160 trg=enter atp=0 dly=0
RR min=3000 max=4095 hyst=50 tgt=2 ast=1 trg=enter atp=0 dly=0
RR min=3000 max=4095 hyst=50 tgt=2 ast=0 trg=exit atp=1 dly=3
```

| کلید | الزامی | بازه مجاز | پیش‌فرض | توضیح |
| :--- | :---: | :--- | :---: | :--- |
| `min` | بله | `0..maxAdcValue` | — | حد پایین بازه (اگر `min > max` باشد فریم‌ور خودکار جابه‌جا می‌کند) |
| `max` | بله | `0..maxAdcValue` | — | حد بالای بازه |
| `tgt` | بله | `0..39` | — | شماره GPIO خروجی هدف |
| `hyst` | خیر | `0..floor(maxAdcValue/2)` | `0` | مقدار هیسترزیس خروج از بازه |
| `trg` | خیر | `0` / `enter` یا `1` / `exit` | `0` (`enter`) | حالت تریگر: ورود به بازه یا خروج از بازه |
| `ast` | خیر* | `0` یا `1` | `0` | وضعیت خروجی دیجیتال هدف (`0=OFF`, `1=ON`) |
| `aval` | خیر* | `0..4095` | `-1` (غیرفعال) | مقدار Duty برای خروجی `analog_output` (اگر ارسال شود `ast` خودکار از `aval > 0` استخراج می‌شود) |
| `atp` | خیر | `0`, `1`, `2` | `0` | نوع عملیات (`0=فوری`, `1=پس از تاخیر`, `2=به مدت مشخص`) |
| `dly` | خیر | `0..60` | `0` | مدت تاخیر یا دوام بر حسب ثانیه |

> *نکته:* اگر خروجی هدف از نوع `analog_output` است، کلید `aval` را ارسال کنید؛ اگر `output` دیجیتال است، `ast` را ارسال کنید و `aval` را نگذارید.

---

## ۴. تغییرات پروتکل باینری زنده (MQTT و Cloudflare WebSocket)

### ۴.۱. آپدیت قانون ورودی دیجیتال — Opcode `0x05` و `0x0B` (پشتیبانی از Double-Click)
ساختار باینری Opcode `0x05` (اکشن‌های دیجیتال) و `0x0B` (اکشن‌های دیجیتال + آنالوگ PWM) **هیچ تغییری در طول بایت‌ها ندارد**!
فقط در فیلد ۴بیتی/۴بایتی **`requiredHoldTime` (`int32` Little-Endian)** که قبلاً فقط مقادیر `0, 3, 5, 10` مجاز بود، اکنون مقدار **`-1`** (`0xFF 0xFF 0xFF 0xFF` در Little-Endian) نیز مجاز است:

```ts
// نوشتن holdTime (پشتیبانی از -1 برای double_click)
view.setInt32(offset, action.requiredHoldTime, true); // -1 -> FF FF FF FF
```

---

### ۴.۲. Opcode جدید `0x0E` — آپدیت زنده قوانین چندبازه‌ای آنالوگ (`UPDATE_ANALOG_RANGE_RULES`)
این Opcode جدید توسط **هر دو مسیر زیر** در ESP32 پشتیبانی می‌شود:
- **MQTT** روی تاپیک `<baseTopic>/Command` (`RuleParsers.cpp`)
- **Cloudflare WebSocket** به صورت فریم باینری (`WsClientParser.cpp`)

پس از دریافت فریم `0x0E`، فریم‌ور قوانین بازه‌ای پین را جایگزین می‌کند، `analogRangeActiveMask` را با مقدار فعلی ADC همگام‌سازی می‌کند (بدون تریگر کاذب)، و تنظیمات جدید را به‌صورت اتمیک در **NVS (نسخه ۵)** ذخیره می‌نماید.

#### ساختار دقیق بایت‌به‌بایت فریم `0x0E` (همه اعداد چندبایتی **Little-Endian** هستند):

**هدر فریم (۳ بایت):**
| بایت | نوع | توضیح |
| :---: | :---: | :--- |
| `0` | `uint8` | Opcode ثابت **`0x0E`** |
| `1` | `uint8` | `inputPin`: شماره GPIO سگمنت `analog_input` (`32, 33, 34, 35, 36, 39`) |
| `2` | `uint8` | `rangeCount`: تعداد بازه‌ها (`0..6`). ارسال `0` تمام قوانین بازه‌ای این پین را پاک و غیرفعال می‌کند. |

**بدنه فریم (`rangeCount × 12` بایت — هر بازه دقیقاً ۱۲ بایت):**
| آفست درون رکورد | طول | نوع | بازه مجاز | توضیح |
| :---: | :---: | :---: | :--- | :--- |
| `+0` | ۲ بایت | `uint16 LE` | `0..4095` | `minValue` |
| `+2` | ۲ بایت | `uint16 LE` | `0..4095` | `maxValue` |
| `+4` | ۲ بایت | `uint16 LE` | `0..2047` | `hysteresis` |
| `+6` | ۱ بایت | `int8` | `0..39` | `targetPin` |
| `+7` | ۱ بایت | `uint8` | بیت‌مسک | `flags` (جدول زیر را ببینید) |
| `+8` | ۱ بایت | `uint8` | `0..60` | `delay` (ثانیه) |
| `+9` | ۲ بایت | `int16 LE` | `-1` یا `0..4095` | `targetValue` (`-1` = حالت دیجیتال با `actionState`، `0..4095` = مقدار PWM) |
| `+11` | ۱ بایت | `uint8` | `0x00` | `reserved` (همیشه `0` ارسال شود) |

**بیت‌چینی فیلد `flags` (آفست `+7`):**
| بیت‌ها | نام | مقادیر |
| :---: | :--- | :--- |
| **بیت `0`** (`0x01`) | `actionState` | `0 = OFF`, `1 = ON` |
| **بیت‌های `1..2`** (`(actionType & 0x03) << 1`) | `actionType` | `0 = IMMEDIATE`, `1 = AFTER_DELAY`, `2 = FOR_DURATION` |
| **بیت `3`** (`(triggerMode & 0x01) << 3`) | `triggerMode` | `0 = RANGE_ON_ENTER`, `1 = RANGE_ON_EXIT` |
| **بیت‌های `4..7`** | رزرو | همیشه `0` |

**طول کل فریم:** دقیقاً `3 + (rangeCount * 12)` بایت. فریم‌ور هر فریم با طول نامتناسب یا مقادیر خارج از بازه را به‌طور کامل رد می‌کند.

#### کد آماده TypeScript برای ساخت فریم باینری `0x0E`:
```ts
export const OPCODE_UPDATE_ANALOG_RANGE_RULES = 0x0E;

export function encodeUpdateAnalogRangeRulesFrame(
  inputPin: number,
  ranges: AnalogRangeRule[]
): Uint8Array {
  const activeRanges = ranges.filter(r => r.enabled !== false).slice(0, 6);
  const totalLen = 3 + activeRanges.length * 12;
  const buf = new Uint8Array(totalLen);
  const view = new DataView(buf.buffer);

  buf[0] = OPCODE_UPDATE_ANALOG_RANGE_RULES;
  buf[1] = inputPin & 0xFF;
  buf[2] = activeRanges.length & 0xFF;

  let offset = 3;
  for (const r of activeRanges) {
    const minVal = Math.min(r.minValue, r.maxValue);
    const maxVal = Math.max(r.minValue, r.maxValue);
    const hasAnalogTarget = typeof r.targetValue === 'number' && r.targetValue >= 0;
    const targetValue = hasAnalogTarget ? Math.min(4095, Math.round(r.targetValue!)) : -1;
    const actionState = hasAnalogTarget ? targetValue > 0 : Boolean(r.actionState);

    const flags =
      (actionState ? 0x01 : 0x00) |
      ((r.actionType & 0x03) << 1) |
      ((r.triggerMode & 0x01) << 3);

    view.setUint16(offset + 0, minVal, true);
    view.setUint16(offset + 2, maxVal, true);
    view.setUint16(offset + 4, Math.max(0, Math.round(r.hysteresis || 0)), true);
    view.setInt8(offset + 6, r.targetPin);
    buf[offset + 7] = flags;
    buf[offset + 8] = Math.min(60, Math.max(0, Math.round(r.delay || 0)));
    view.setInt16(offset + 9, targetValue, true);
    buf[offset + 11] = 0; // reserved
    offset += 12;
  }

  return buf;
}
```

---

## ۵. راهنمای طراحی و پیاده‌سازی رابط کاربری داشبورد (Dashboard UI)

### ۵.۱. ویرایشگر قانون برای ورودی دیجیتال (`type === 'input'`)
در فرم/مودال تعریف قانون برای سگمنت‌های دیجیتال (`input`):
1. در لیست انتخاب شرط (Trigger / Hold Condition) کنار گزینه‌های فعلی، گزینه **`دابل کلیک (Double Click)`** را اضافه کنید:
   - `0` → **تک کلیک / لحظه‌ای** (`Single Click`)
   - **`-1`** → **دابل کلیک (۲ بار فشردن سریع)** (`Double Click`) — **جدید**
   - `3` → **نگه‌داشتن ۳ ثانیه** (`Hold 3s`)
   - `5` → **نگه‌داشتن ۵ ثانیه** (`Hold 5s`)
   - `10` → **نگه‌داشتن ۱۰ ثانیه** (`Hold 10s`)
2. **نکته راهنمای UX (Tooltip / Hint):**
   - وقتی کاربر روی همان قطبیت (`HIGH` یا `LOW`) هم تک‌کلیک (`0`) و هم دابل‌کلیک (`-1`) تعریف کرده باشد، یک یادداشت کوتاه نمایش دهید:
     *«هنگام ترکیب تک‌کلیک و دابل‌کلیک روی یک کلید، اجرای تک‌کلیک با تاخیر ۴۰۰ میلی‌ثانیه برای تشخیص کلیک دوم انجام می‌شود.»*
3. **ارسال تغییرات به دستگاه:**
   - هنگام ذخیره قانون روی سگمنت دیجیتال، دقیقاً از همان مسیر قبلی (ارسال به API/Worker برای ذخیره در دیتابیس + ارسال فریم باینری **`0x05`** یا **`0x0B`** از طریق MQTT) استفاده شود؛ فقط مقدار `requiredHoldTime: -1` باید بدون فیلتر شدن در Validation فرانت‌اند و Worker پذیرفته شود.

### ۵.۲. ویرایشگر قانون چندبازه‌ای برای ورودی آنالوگ (`type === 'analog_input'`)
**تغییر مهم:** برای سگمنت‌هایی با نوع `analog_input` دیگر نباید فرم «تک کلیک / نگه‌داشتن / HIGH / LOW» نمایش داده شود! به‌جای آن، **ویرایشگر قوانین بازه‌ای (Analog Multi-Range Rule Editor)** نمایش داده شود:

1. **نوار وضعیت زنده سنسور در بالای مودال:**
   - نمایش مقدار فعلی سنسور (`analogValue` از `0` تا `maxAdcValue = (1 << adcResolution) - 1`) همراه با درصد و نوار پیشرفت.
   - نمایش رنگ/نشانگر «فعال» کنار هر بازه‌ای که مقدار زنده سنسور در حال حاضر داخل `[minValue..maxValue]` آن قرار دارد.
2. **لیست بازه‌های شرط (`analogRanges` — حداکثر ۶ بازه):**
   - دکمه **«+ افزودن بازه جدید»** (وقتی `analogRanges.length >= 6` باشد غیرفعال شود با پیام حداکثر ۶ بازه).
   - هر کارت بازه شامل فیلدهای زیر است:
     - **حداقل مقدار (`minValue`)** و **حداکثر مقدار (`maxValue`)**: ورودی عددی (یا Range Slider دوطرفه) در بازه `0` تا `maxAdcValue` (مثلاً `0..4095` برای ۱۲ بیت). همچنین نمایش معادل درصدی کنار اعداد برای خوانایی بهتر کاربر.
     - **هیسترزیس (`hysteresis`)**: ورودی عددی (`0` تا `Math.floor(maxAdcValue / 2)`، مقدار پیش‌فرض پیشنهادی `30` برای ۱۲ بیت و `5` برای ۸ بیت) با توضیح کوتاه *«باند محافظ برای جلوگیری از قطع‌ووصلی روی مرز بازه»*.
     - **زمان اجرا (`triggerMode`)**: انتخابگر دوحالته:
       - `0` (**هنگام ورود به بازه** — `On Enter`)
       - `1` (**هنگام خروج از بازه** — `On Exit`)
     - **خروجی هدف (`targetPin`)**: انتخاب از بین سگمنت‌های `output` و `analog_output` همان دستگاه.
     - **مقدار/وضعیت هدف:**
       - اگر خروجی هدف `output` (دیجیتال) است: کلید `روشن (ON)` / `خاموش (OFF)` (`actionState`, و `targetValue = -1`).
       - اگر خروجی هدف `analog_output` (PWM) است: اسلایدر/عدد `0` تا `(1 << targetPwmRes) - 1` (`targetValue`, و `actionState = targetValue > 0`).
     - **نوع عملیات (`actionType`) و زمان (`delay`):**
       - `0`: **فوری** (`Immediate`)
       - `1`: **اجرا پس از تاخیر** (`After Delay` — ورودی `1..60` ثانیه)
       - `2`: **اجرا برای مدت مشخص** (`For Duration` — ورودی `1..60` ثانیه)
     - دکمه **حذف بازه**.
3. **ارسال تغییرات به دستگاه:**
   - ابتدا قانون در دیتابیس/Cloudflare Worker ذخیره شود (تا هنگام ریبوت دستگاه در `ESP_CFG_V2` با سطرهای `RR ` برگردد).
   - سپس فریم باینری **`0x0E`** با تابع `encodeUpdateAnalogRangeRulesFrame(segment.pin, rule.analogRanges)` روی MQTT (`<baseTopic>/Command`) و/یا WebSocket کلادفلر ارسال شود تا ESP32 بدون نیاز به ریبوت و در کسری از میلی‌ثانیه قوانین جدید را اعمال و در NVS ذخیره کند.

---

## ۶. چک‌لیست اعتبارسنجی (Validation) در Worker و Dashboard

1. در Worker / Backend API (جایی که `requiredHoldTime` اعتبارسنجی می‌شود):
   - لیست مقادیر مجاز را از `[0, 3, 5, 10]` به **`[-1, 0, 3, 5, 10]`** تغییر دهید.
2. در Worker (تولیدکننده `ESP_CFG_V2`):
   - برای سگمنت‌های `analog_input`، بعد از خط `S ...`، تمام `analogRanges` را با فرمت `RR min=... max=... hyst=... tgt=... trg=... atp=... dly=...` (و `aval=...` یا `ast=...`) تولید کنید.
3. اعتبارسنجی `analogRanges` پیش از ذخیره و ارسال:
   - `analogRanges.length <= 6`
   - `0 <= minValue <= maxValue <= (1 << adcResolution) - 1`
   - `0 <= hysteresis <= Math.floor(((1 << adcResolution) - 1) / 2)`
   - `triggerMode` فقط `0` یا `1`
   - `actionType` فقط `0`, `1` یا `2` و `0 <= delay <= 60`
   - `targetPin` حتماً متعلق به یک سگمنت خروجی (`output` یا `analog_output`) باشد و `targetPin !== inputPin`.
4. **مثال تست انتها‌به‌انتها (End-to-End Test Cases):**
   - **تست ۱ (دابل‌کلیک دیجیتال):** روی یک کلید `input`، تک‌کلیک (`hld=0`) برای رله ۱ و دابل‌کلیک (`hld=-1`) برای رله ۲ تعریف کنید -> ذخیره -> بررسی ارسال فریم `0x05`/`0x0B` با بایت‌های `FF FF FF FF` -> بررسی حضور `hld=-1` در خروجی `ESP_CFG_V2` -> تست ریبوت ESP32.
   - **تست ۲ (چندبازه آنالوگ):** روی یک سنسور `analog_input` سه بازه تعریف کنید: `[0..1000]` -> PWM=64، `[1500..2500]` -> PWM=160، `[3000..4095]` -> رله آلارم ON -> ذخیره -> بررسی ارسال فریم `0x0E` با طول `3 + 3*12 = 39` بایت -> بررسی حضور سه خط `RR ` در `ESP_CFG_V2` -> تست ریبوت ESP32.
   - **تست ۳ (پاک‌کردن قوانین آنالوگ):** حذف همه بازه‌ها -> ذخیره -> ارسال فریم ۳بایتی `[0x0E, pin, 0x00]` -> غیرفعال‌شدن قانون روی ESP32.
