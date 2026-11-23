# راهنمای کامل پیاده‌سازی پشتیبانی از ESPهای کمکی و سگمنت مجازی در داشبورد (`Home-Control-Dashboard`)

> **هدف این سند:** این فایل به‌عنوان دستورالعمل فنی دقیق و کامل برای هوش مصنوعی/توسعه‌دهنده روی ریپازیتوری `https://github.com/KavehAhangar051/Home-Control-Dashboard` نوشته شده است تا تمام تغییرات داشبورد و همگام‌سازی پیکربندی برای **فاز ۱ (ثبت ESPهای کمکی + سگمنت‌های مجازی)** را با سازگاری ۱۰۰٪ نسبت به فریم‌ور جدید ESP32 مرکزی (`Achaemenid-IoT`) پیاده‌سازی کند.

---

## ۱. نمای کلی معماری (فضای یکپارچه پین‌ها + رجیستری ESPهای کمکی)

در معماری جدید، ESP32 مرکزی همچنان نقش هاب (Hub) و منبع واحد ارتباط با داشبورد (MQTT / Local WebSocket / Cloudflare) را دارد، اما می‌تواند علاوه بر GPIOهای فیزیکی خودش، سگمنت‌های متعلق به میکروکنترلرهای کمکی (`ESP8266-01`, `ESP8266-12`, `ESP32`, `ESP32-C3`, `ESP32-S3`) را نیز مدیریت کند (که در فاز ۲ از طریق `ESP-NOW` و در مقیاس بزرگ از طریق `ESP-MESH` به هاب متصل می‌شوند).

برای اینکه کل پروتکل‌های کنترل، تایمر، PWM، ADC و موتور قوانین (`RuleEngine`) بدون شکستن سازگاری عقب‌رو روی هر دو نوع سگمنت کار کنند، از **فضای یکپارچه شماره پین (`0..127`)** استفاده شده است:

| محدوده `pin` | نوع سگمنت | شناسه قطعی پیشنهادی (`id`) | توضیح |
| :--- | :--- | :--- | :--- |
| **`0 .. 39`** | سگمنت فیزیکی محلی (ESP32 مرکزی) | `gpio_<0..39>` (مثلاً `gpio_5`) | مستقیماً به GPIO / LEDC / SAR1 ADC برد مرکزی متصل است. |
| **`40 .. 127`** | سگمنت مجازی (`isVirtual = true`) | `vpin_<40..127>` (مثلاً `vpin_40`) | بدون دست‌زدن به سخت‌افزار برد مرکزی، به `(nodeId: 1..16, remotePin: 0..39)` روی یک ESP کمکی متصل است. |

### ظرفیت‌ها و محدودیت‌های سمت فریم‌ور ESP32 مرکزی
- **حداکثر تعداد کل سگمنت‌ها (محلی + مجازی):** از `16` به **`48`** افزایش یافته است (`MAX_SEGMENTS = 48`).
- **حداکثر تعداد بردهای ESP کمکی قابل ثبت:** **`16`** برد (`nodeId` از `1` تا `16`؛ مقدار `0` رزرو برای برد مرکزی است).
- **ظرفیت پایه هر برد کمکی (`pinCapacity`):** از `1` تا `32`.
- **شماره پایه روی برد کمکی (`remotePin`):** از `0` تا `39`.
- **ذخیره‌سازی دائمی (NVS):**
  - فهرست کامل بردهای کمکی (شامل `nodeId`، آدرس ۶ بایتی `MAC`، `pinCapacity`، `chipType`، `name`) به‌صورت اتمی در فضای `AchaemenidNodes` ذخیره می‌شود و پس از هر ریستارت ESP32 مرکزی بلافاصله بازیابی می‌گردد.
  - سگمنت‌های محلی و مجازی (همراه با `isVirtual`، `nodeId`، `remotePin` و تمام Ruleها) در فرمت فشرده `NVS V6` ذخیره می‌شوند (با حفظ سازگاری کامل برای خواندن نسخه‌های قبلی `V2..V5`).

---

## ۲. مرجع کامل پروتکل سمت فریم‌ور ESP32 مرکزی (از پیش پیاده‌سازی‌شده)

### ۲.۱. Opcodeهای جدید باینری MQTT (روی تاپیک `<baseTopic>/Command`)

#### الف) `0x0F` — `UPSERT_AUX_NODE` (ثبت یا ویرایش برد ESP کمکی)
```text
[0x0F][nodeId:u8][mac:6B][pinCapacity:u8][chipType:u8][name_utf8...][0x00]
```
- `nodeId`: عدد صحیح `1..16`.
- `mac`: دقیقاً **۶ بایت** (بزرگ/کوچک‌بودن هگز در داشبورد پارس و به ۶ بایت خام تبدیل شود). باید یک آدرس **Unicast معتبر** باشد:
  - تمام صفر (`00:00:00:00:00:00`) نباشد.
  - Broadcast (`FF:FF:FF:FF:FF:FF`) نباشد.
  - Multicast نباشد (`(mac[0] & 0x01) === 0`).
- `pinCapacity`: عدد صحیح `1..32` (تعداد پایه‌های قابل تعریف / سگمنت خالی برای این برد).
- `chipType`: کد ۱ بایتی نوع تراشه مطابق جدول زیر:

| مقدار (`uint8`) | شناسه پیشنهادی در داشبورد | نام نمایشی | ظرفیت پیش‌فرض | پایه‌های پیشنهادی (`remotePin`) |
| :---: | :--- | :--- | :---: | :--- |
| `0` | `"unknown"` | برد سفارشی (ESP) | `4` | `0..39` |
| `1` | `"esp8266_01"` | ESP8266-01 / 01S | `2` (قابل افزایش تا `4`) | `0, 2` (و `1, 3` در صورت عدم استفاده از Serial) |
| `2` | `"esp8266_12"` | ESP8266-12E / NodeMCU | `8` | `0, 2, 4, 5, 12, 13, 14, 15, 16` (+ `17` برای `A0`) |
| `3` | `"esp32"` | ESP32 DevKit | `12` | `2, 4, 5, 12..19, 21..23, 25..27, 32..36, 39` |
| `4` | `"esp32_c3"` | ESP32-C3 | `8` | `0..10, 20, 21` |
| `5` | `"esp32_s3"` | ESP32-S3 | `12` | `1..21, 38..48` (تا `39` در فاز ۱) |

- `name_utf8`: نام گروه / برد (حداکثر ۳۱ بایت UTF-8، منتهی به `0x00`).
- **پاسخ فریم‌ور روی `<baseTopic>/State`:**
  ```json
  {"type":"aux_node_ack","action":"upsert","id":1,"mac":"AA:BB:CC:DD:EE:01","cap":4,"chip":1}
  ```
- **نکته Deduplication:** اگر MAC ارسالی قبلاً زیر یک `nodeId` دیگر ثبت شده باشد، فریم‌ور به‌صورت خودکار رکورد قدیمی آن MAC را به `nodeId` جدید منتقل می‌کند تا هرگز دو برد با یک MAC وجود نداشته باشند.

#### ب) `0x10` — `DELETE_AUX_NODE` (حذف برد ESP کمکی)
```text
[0x10][nodeId:u8][flags:u8][optional mac:6B]
```
- `nodeId`: `1..16` (یا `0` اگر فقط با `mac` حذف می‌شود).
- `flags`:
  - `bit 0 (0x01)`: `cascadeSegments` — اگر `1` باشد، تمام سگمنت‌های مجازی متصل به این `nodeId` نیز به‌صورت آبشاری از RAM و NVS حذف می‌شوند (مقدار پیشنهادی پیش‌فرض: `0x01`).
- `mac` (اختیاری، ۶ بایت): در صورت ارسال، به‌عنوان fallback برای شناسایی و حذف برد استفاده می‌شود.
- **پاسخ فریم‌ور روی `<baseTopic>/State`:**
  ```json
  {"type":"aux_node_ack","action":"delete","id":1}
  ```

#### ج) `0x11` — `ADD_VIRTUAL_SEGMENT` (افزودن یا جایگزینی سگمنت مجازی)
```text
[0x11][virtualPin:u8][nodeId:u8][remotePin:u8][initState:u8][id_ascii...][0x00][type_ascii...][0x00][optional PWM 5B or ADC 9B metadata]
```
- `virtualPin`: شماره پین مجازی در بازه **`40..127`**.
- `nodeId`: شناسه برد کمکی ثبت‌شده در بازه **`1..16`** (باید قبلاً با `0x0F` ثبت شده باشد، وگرنه فریم‌ور آن را رد می‌کند).
- `remotePin`: شماره GPIO روی برد کمکی در بازه **`0..39`**.
- `initState`: مقدار اولیه (`0` یا `1`).
- `id_ascii`: شناسه قطعی **`vpin_<virtualPin>`** (حداکثر ۳۱ کاراکتر، منتهی به `0x00`).
- `type_ascii`: دقیقاً همان مقادیر `0x02` (`"gpio_toggle"` / `"output"`, `"input"`, `"analog_output"`, `"analog_input"`).
- **متادیتای اختیاری انتهایی:** دقیقاً مشابه `ADD_SEGMENT (0x02)`:
  - برای `analog_output`: حداکثر ۵ بایت `[res:u8][freq:u16LE][initVal:u16LE]`
  - برای `analog_input`: حداکثر ۹ بایت `[res:u8][sint:u16LE][delta:u16LE][ath:u16LE][atl:u16LE]`
- **رفتار Upsert:** اگر قبلاً سگمنتی روی همان `virtualPin` یا روی همان زوج `(nodeId, remotePin)` وجود داشته باشد، به‌صورت امن جایگزین می‌شود.

### ۲.۲. Opcodeهای موجود که اکنون بازه پین `0..127` را می‌پذیرند (بدون تغییر فرمت فریم)
تمام دستورات زیر روی فریم‌ور ESP32 اکنون هم پین محلی (`0..39`) و هم پین مجازی (`40..127`) را پشتیبانی می‌کنند:
- `0x01` (`TOGGLE_PIN`)، `0x06` (`AUTOMATION_TOGGLE`)، `0x08` (`BATCH_TOGGLE`)، `0x0A` (`SET_ANALOG_OUTPUT`)
- `0x03` (`DELETE_SEGMENT` v2 — بایت fallback انتهایی اکنون `0..127` را می‌پذیرد!)
- `0x05` / `0x0B` (`UPDATE_RULE` — هم `inputPin` و هم `targetPin` اکنون `0..127` هستند؛ یعنی کلید مجازی می‌تواند رله محلی را بزند و برعکس!)
- `0x0C` (`UPDATE_ANALOG_INPUT_CONFIG`)، `0x0D` (`READ_ANALOG_INPUT`)، `0x0E` (`UPDATE_ANALOG_RANGE_RULES`)

### ۲.۳. فرمت توسعه‌یافته پیام `state_sync` (در MQTT `/State` و Local WebSocket)
فریم‌ور اکنون دو فیلد اختیاری جدید `"virtual"` و `"nodes"` را نیز در `state_sync` ارسال می‌کند:
```json
{
  "type": "state_sync",
  "states": { "5": true, "40": false },
  "values": { "41": 180 },
  "resolutions": { "41": 8 },
  "ids": { "5": "gpio_5", "40": "vpin_40", "41": "vpin_41" },
  "virtual": {
    "40": { "node": 1, "rpin": 2 },
    "41": { "node": 1, "rpin": 0 }
  },
  "nodes": [
    { "id": 1, "mac": "AA:BB:CC:DD:EE:01", "cap": 4, "chip": 1, "name": "باغچه", "online": false }
  ],
  "timers": { "5": 0, "40": 0, "41": 0 }
}
```
*(اگر هیچ سگمنت مجازی ثبت نشده باشد فیلد `"virtual"` و اگر هیچ برد کمکی ثبت نشده باشد فیلد `"nodes"` ارسال نمی‌شود؛ بنابراین ۱۰۰٪ سازگار عقب‌رو است.)*

### ۲.۴. فرمت متنی `ESP_CFG_V2` (برای Cloudflare Worker / Sync کامل)
```text
ESP_CFG_V2
E n=1
E id=1 mac=AA:BB:CC:DD:EE:01 cap=4 chip=1 name=Garden_Node
C n=2
S id=gpio_5 type=output pin=5 val=0 ao=0
S id=vpin_40 type=output pin=40 val=0 ao=0 virt=1 node=1 rpin=2
```
- خطوط `E ` باید **قبل از** خطوط `S ` قرار بگیرند.
- برای `name` در خط `E ` فاصله‌ها را با `_` (یا percent-encode ساده بدون فاصله) ارسال کنید زیرا پارسر خطی با فاصله توکن‌بندی می‌کند.

---

## ۳. تغییرات مورد نیاز فایل‌به‌فایل در داشبورد (`Home-Control-Dashboard`)

### تغییر ۱: افزودن مدل `AuxNodeConfig` و فیلدهای مجازی به Typeها و Store

#### الف) `features/iot/config/types.ts` (و `features/iot/store/types.ts`)
انواع زیر را اضافه کنید:
```ts
export type AuxChipType =
  | "unknown"
  | "esp8266_01"
  | "esp8266_12"
  | "esp32"
  | "esp32_c3"
  | "esp32_s3";

export const AUX_CHIP_CODE_MAP: Record<AuxChipType, number> = {
  unknown: 0,
  esp8266_01: 1,
  esp8266_12: 2,
  esp32: 3,
  esp32_c3: 4,
  esp32_s3: 5,
};

export const AUX_CHIP_FROM_CODE: Record<number, AuxChipType> = {
  0: "unknown",
  1: "esp8266_01",
  2: "esp8266_12",
  3: "esp32",
  4: "esp32_c3",
  5: "esp32_s3",
};

export interface AuxNodeConfig {
  /** شناسه یکتای عددی برد کمکی روی هاب مرکزی (1..16) */
  id: number;
  /** نام برد / نام گروه متناظر در داشبورد */
  name: string;
  /** آدرس MAC نرمال‌شده با حروف بزرگ (AA:BB:CC:DD:EE:FF) */
  mac: string;
  /** نوع تراشه ESP کمکی */
  chipType: AuxChipType;
  /** تعداد پایه‌های قابل استفاده (1..32) — به همین تعداد Placeholder در گروه ساخته می‌شود */
  pinCapacity: number;
  /** نام گروه مرتبط در groupsOrder داشبورد (معمولاً برابر با name) */
  groupId: string;
  /** وضعیت آنلاین بودن (در فاز ۲ از طریق ESP-NOW پر می‌شود؛ در فاز ۱ پیش‌فرض false) */
  online?: boolean;
}
```

در اینترفیس `Segment` (در `features/iot/config/types.ts`) سه فیلد اختیاری زیر را اضافه کنید (برای سازگاری کامل با سگمنت‌های محلی فعلی، هر سه اختیاری هستند):
```ts
  isVirtual?: boolean;
  /** شناسه برد کمکی (1..16) — فقط وقتی isVirtual === true (همچنین برای placeholderهای گروه ESP کمکی) */
  nodeId?: number;
  /** شماره پایه فیزیکی روی برد کمکی (0..39) */
  remotePin?: number;
```

در `ConfigSlice` (`features/iot/store/slices/createConfigSlice.ts` و `features/iot/store/types.ts`):
- فیلد `auxNodes: AuxNodeConfig[]` (مقدار اولیه `[]`) و اکشن‌های `setAuxNodes`, `upsertAuxNode`, `removeAuxNode` را اضافه کرده و در persist / load (Cloudflare KV و localStorage) ذخیره و بازیابی کنید.

---

### تغییر ۲: اعتبارسنجی MAC، تخصیص خودکار `virtualPin` و باز کردن محدوده پین (`0..127`)

در `features/iot/utils/pinValidation.ts` (یا یک ماژول جدید `features/iot/utils/auxNodeUtils.ts` متصل به آن):

```ts
export const LOCAL_GPIO_MIN = 0;
export const LOCAL_GPIO_MAX = 39;
export const VIRTUAL_PIN_MIN = 40;
export const VIRTUAL_PIN_MAX = 127;
export const MAX_AUX_NODES = 16;
export const MAX_AUX_PIN_CAPACITY = 32;
export const MAX_TOTAL_SEGMENTS = 48;

export function isLocalGpioPin(pin: number): boolean {
  return Number.isInteger(pin) && pin >= LOCAL_GPIO_MIN && pin <= LOCAL_GPIO_MAX;
}

export function isVirtualPin(pin: number): boolean {
  return Number.isInteger(pin) && pin >= VIRTUAL_PIN_MIN && pin <= VIRTUAL_PIN_MAX;
}

export function isValidManagedPin(pin: number): boolean {
  return Number.isInteger(pin) && pin >= LOCAL_GPIO_MIN && pin <= VIRTUAL_PIN_MAX;
}

/**
 * پارس و اعتبارسنجی آدرس MAC (پشتیبانی از AA:BB:... ، AA-BB-... و AABBCCDDEEFF).
 * آدرس‌های All-Zero، Broadcast (FF:...) و Multicast (بیت کم‌ارزش بایت اول = 1) را رد می‌کند.
 */
export function parseAndValidateMac(raw: string): { valid: true; normalized: string; bytes: Uint8Array } | { valid: false; error: string } {
  const cleaned = raw.trim().replace(/[:-]/g, "").toUpperCase();
  if (!/^[0-9A-F]{12}$/.test(cleaned)) {
    return { valid: false, error: "فرمت آدرس MAC نامعتبر است (مثال: AA:BB:CC:DD:EE:01)." };
  }
  const bytes = new Uint8Array(6);
  for (let i = 0; i < 6; i++) {
    bytes[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  }
  const allZero = bytes.every((b) => b === 0x00);
  const allFf = bytes.every((b) => b === 0xff);
  if (allZero || allFf) {
    return { valid: false, error: "آدرس MAC نمی‌تواند صفر یا Broadcast باشد." };
  }
  if ((bytes[0] & 0x01) !== 0) {
    return { valid: false, error: "آدرس MAC باید Unicast باشد (بیت کم‌ارزش بایت اول باید زوج باشد)." };
  }
  const normalized = Array.from(bytes)
    .map((b) => b.toString(16).toUpperCase().padStart(2, "0"))
    .join(":");
  return { valid: true, normalized, bytes };
}

/** تخصیص کوچک‌ترین nodeId آزاد در بازه 1..16 */
export function allocateNextAuxNodeId(auxNodes: AuxNodeConfig[]): number | null {
  const used = new Set(auxNodes.map((n) => n.id));
  for (let id = 1; id <= MAX_AUX_NODES; id++) {
    if (!used.has(id)) return id;
  }
  return null;
}

/** تخصیص کوچک‌ترین virtualPin آزاد در بازه 40..127 */
export function allocateNextVirtualPin(segments: Array<{ pin?: string | number }>): number | null {
  const used = new Set<number>();
  for (const s of segments) {
    const n = Number(s.pin);
    if (isVirtualPin(n)) used.add(n);
  }
  for (let pin = VIRTUAL_PIN_MIN; pin <= VIRTUAL_PIN_MAX; pin++) {
    if (!used.has(pin)) return pin;
  }
  return null;
}
```

همچنین در `features/iot/hooks/achaemenidState/core/segmentOperations.ts` تابع `createHardwareSegmentId` را طوری به‌روزرسانی کنید که:
- برای `0..39` شناسه `gpio_<pin>` تولید کند.
- برای `40..127` شناسه **`vpin_<pin>`** تولید کند!

---

### تغییر ۳: افزودن Opcodeها و Builderهای باینری MQTT

#### الف) `features/iot/services/mqtt/protocol.ts`
سه Opcode جدید را به `MQTT_OPCODES` اضافه کنید:
```ts
  UPSERT_AUX_NODE: 0x0f,
  DELETE_AUX_NODE: 0x10,
  ADD_VIRTUAL_SEGMENT: 0x11,
```

#### ب) `features/iot/services/mqtt/segmentPublishers.ts`
1. **باز کردن محدوده پین در Builderهای موجود:**
   در تمام توابع موجود (`buildDeleteSegmentFrame`, `buildUpdateAnalogInputConfigFrame`, `buildReadAnalogInputFrame`, `buildUpdateRuleFrame`, `buildUpdateAnalogRangeRulesFrame`, و کنترل‌های `0x01`/`0x06`/`0x08`/`0x0A`) شرط `parsedPin >= 0 && parsedPin <= 39` را به **`parsedPin >= 0 && parsedPin <= 127`** تغییر دهید.
2. **افزودن ۳ تابع Builder/Publisher جدید:**
```ts
export const buildUpsertAuxNodeFrame = (node: {
  id: number;
  mac: string;
  pinCapacity: number;
  chipType: AuxChipType;
  name: string;
}): Uint8Array => {
  const macRes = parseAndValidateMac(node.mac);
  if (!macRes.valid) {
    throw new Error(macRes.error);
  }
  const nameBytes = textEncoder.encode((node.name || "").slice(0, 31));
  const buf = new Uint8Array(1 + 1 + 6 + 1 + 1 + nameBytes.length + 1);
  buf[0] = MQTT_OPCODES.UPSERT_AUX_NODE;
  buf[1] = node.id & 0xff;
  buf.set(macRes.bytes, 2);
  buf[8] = Math.max(1, Math.min(32, Math.trunc(node.pinCapacity))) & 0xff;
  buf[9] = (AUX_CHIP_CODE_MAP[node.chipType] ?? 0) & 0xff;
  buf.set(nameBytes, 10);
  buf[10 + nameBytes.length] = 0x00;
  return buf;
};

export const buildDeleteAuxNodeFrame = (
  nodeId: number,
  options?: { cascadeSegments?: boolean; mac?: string },
): Uint8Array => {
  const cascade = options?.cascadeSegments ?? true;
  const macRes = options?.mac ? parseAndValidateMac(options.mac) : null;
  const includeMac = Boolean(macRes && macRes.valid);
  const buf = new Uint8Array(includeMac ? 9 : 3);
  buf[0] = MQTT_OPCODES.DELETE_AUX_NODE;
  buf[1] = nodeId & 0xff;
  buf[2] = cascade ? 0x01 : 0x00;
  if (includeMac && macRes && macRes.valid) {
    buf.set(macRes.bytes, 3);
  }
  return buf;
};

export const buildAddVirtualSegmentFrame = (params: {
  virtualPin: number; // 40..127
  nodeId: number;     // 1..16
  remotePin: number;  // 0..39
  id: string;         // e.g. "vpin_40"
  type: string;       // "gpio_toggle" | "input" | "analog_output" | "analog_input"
  initState?: number;
  // همان فیلدهای اختیاری PWM و ADC مشابه buildAddSegmentFrame
  pwmResolution?: number;
  pwmFrequency?: number;
  initialValue?: number;
  adcResolution?: number;
  adcSampleIntervalMs?: number;
  adcDeltaThreshold?: number;
  adcHighThreshold?: number;
  adcLowThreshold?: number;
}): Uint8Array => {
  const idBytes = textEncoder.encode(params.id.slice(0, 31));
  const typeBytes = textEncoder.encode(params.type.slice(0, 31));
  const trailing = buildTrailingSegmentMetadataBytes(params); // همان متادیتای 5B PWM یا 9B ADC از 0x02
  const buf = new Uint8Array(5 + idBytes.length + 1 + typeBytes.length + 1 + trailing.length);
  buf[0] = MQTT_OPCODES.ADD_VIRTUAL_SEGMENT;
  buf[1] = params.virtualPin & 0xff;
  buf[2] = params.nodeId & 0xff;
  buf[3] = params.remotePin & 0xff;
  buf[4] = (params.initState ?? 0) & 0xff;
  let offset = 5;
  buf.set(idBytes, offset);
  offset += idBytes.length;
  buf[offset++] = 0x00;
  buf.set(typeBytes, offset);
  offset += typeBytes.length;
  buf[offset++] = 0x00;
  if (trailing.length > 0) {
    buf.set(trailing, offset);
  }
  return buf;
};
```
و متناظر آن‌ها `publishUpsertAuxNodeCommand`, `publishDeleteAuxNodeCommand`, `publishAddVirtualSegmentCommand` را تعریف و در `features/iot/services/ports.ts` و `deviceGatewayAdapter.ts` متصل کنید.

#### ج) `features/iot/services/mqtt/messageParser.ts` و `init.ts`
1. در نوع `state_sync` دو فیلد اختیاری زیر را اضافه و پارس کنید:
   ```ts
   virtual?: Record<string, { node: number; rpin: number }>;
   nodes?: Array<{ id: number; mac: string; cap: number; chip: number; name: string; online: boolean }>;
   ```
2. نوع پیام جدید `aux_node_ack` را پارس کنید:
   ```ts
   | {
       kind: "aux_node_ack";
       action: "upsert" | "delete";
       id: number;
       mac?: string;
       cap?: number;
       chip?: number;
     }
   ```
3. در `init.ts` هنگام دریافت `state_sync` با `nodes`، وضعیت `online` بردهای کمکی موجود را در Store به‌روزرسانی کنید (و در صورت دریافت `aux_node_ack`، یک Toast / وضعیت تأیید ذخیره در ESP32 مرکزی نمایش دهید).

---

### تغییر ۴: تجربه کاربری (UX) ثبت ESP کمکی و ایجاد خودکار گروه با `N` سگمنت خالی

این بخش دقیقاً مطابق جریان کاری درخواستی طراحی شده است:

1. **دکمه و مودال «افزودن ESP کمکی» (Add Auxiliary ESP Modal):**
   - کنار دکمه «افزودن گروه / سگمنت» در هدر داشبورد، گزینه **«افزودن برد کمکی (ESP)»** اضافه شود.
   - فیلدهای فرم:
     1. **نام گروه / نام برد (`name`)** — اجباری (مثلاً «روشنایی باغچه»). نباید تکراری با نام گروه‌های موجود باشد.
     2. **آدرس MAC برد کمکی (`mac`)** — اجباری با ماسک/اعتبارسنجی زنده (`AA:BB:CC:DD:EE:01`) و بررسی عدم تکرار MAC در `auxNodes`.
     3. **نوع میکروکنترلر (`chipType`)** — انتخاب از بین `ESP8266-01`، `ESP8266-12`، `ESP32`، `ESP32-C3`، `ESP32-S3`، `سفارشی`. تغییر آن ظرفیت پیشنهادی را تنظیم می‌کند.
     4. **ظرفیت پایه (`pinCapacity`)** — عدد `1` تا `32` (مثلاً `4`).
2. **عملیات هنگام ثبت فرم (`handleCreateAuxNode` در `useSegmentManagement.ts`):**
   - تخصیص `nodeId = allocateNextAuxNodeId(auxNodes)` (در صورت پر بودن ۱۶ اسلات، نمایش خطای فارسی مناسب).
   - ارسال فریم باینری **`0x0F` (`publishUpsertAuxNodeCommand`)** به ESP32 مرکزی تا MAC و مشخصات در NVS هاب ذخیره شود.
   - اضافه کردن برد به `auxNodes` در Store.
   - ایجاد خودکار گروه جدید با نام `name` در `groupsOrder`.
   - ایجاد خودکار **`pinCapacity` عدد سگمنت خالی (`type: "placeholder"`)** درون همان گروه، با فیلدهای:
     ```ts
     {
       id: createSegmentId(),
       type: "placeholder",
       name: `پایه خالی ${i + 1}`,
       group: node.groupId,
       isVirtual: true,
       nodeId: node.id,
     }
     ```
3. **نمایش هدر گروه متعلق به ESP کمکی:**
   - اگر گروه به یک `AuxNodeConfig` متصل باشد، در هدر گروه یک Badge کوچک و خوانا شامل **نوع برد + آدرس MAC + تعداد پایه‌های استفاده‌شده از ظرفیت** (مثلاً `ESP8266-01 · AA:BB:CC:DD:EE:01 · 1/4`) نمایش داده شود.
   - دکمه ویرایش (تغییر نام/MAC/ظرفیت که دوباره `0x0F` می‌فرستد) و دکمه حذف برد کمکی روی هدر گروه قرار گیرد.
   - **حذف گروه برد کمکی (`handleRemoveGroup`):** اگر گروه متعلق به یک `AuxNodeConfig` باشد، پس از تأیید کاربر، فریم **`0x10` (`DELETE_AUX_NODE`, `cascadeSegments: true`, همراه با `mac`)** به ESP32 مرکزی ارسال شده و برد + گروه + تمام سگمنت‌های آن از داشبورد حذف شوند.

---

### تغییر ۵: تبدیل Placeholder به سگمنت مجازی و افزودن/حذف سگمنت مجازی

#### الف) `PlaceholderCard.tsx`، `useAddSegmentForm.ts` و `PinSelector.tsx`
1. وقتی کاربر روی یک `PlaceholderCard` کلیک می‌کند که `placeholder.isVirtual && placeholder.nodeId` دارد:
   - فرم افزودن سگمنت به‌صورت خودکار در حالت **«سگمنت مجازی (ESP کمکی)»** و با برد از پیش انتخاب‌شده `nodeId` باز می‌شود.
2. همچنین در حالت عادی باز کردن فرم «افزودن سگمنت»، یک انتخابگر دوحالته (Segmented Control) اضافه شود:
   - **برد مرکزی (ESP32 محلی):** همان انتخابگر GPIO فعلی (`0..39`).
   - **برد کمکی (سگمنت مجازی):** نمایش لیست بردهای ثبت‌شده در `auxNodes` + انتخابگر شماره پایه روی برد کمکی (`remotePin`، با نمایش پایه‌های مناسب همان `chipType` و غیرفعال کردن `remotePin`هایی که قبلاً روی همان `nodeId` اشغال شده‌اند).
3. **عملیات ثبت سگمنت مجازی (`handleAddSegment`):**
   - بررسی سقف کل `48` سگمنت فعال روی هاب مرکزی و ظرفیت `pinCapacity` برد کمکی.
   - بررسی عدم تکرار `(nodeId, remotePin)`.
   - تخصیص خودکار `virtualPin = allocateNextVirtualPin(segments)` (در بازه `40..127`).
   - ساخت شناسه قطعی `id = "vpin_" + virtualPin`.
   - ارسال فریم باینری **`0x11` (`publishAddVirtualSegmentCommand`)** با `(virtualPin, nodeId, remotePin, id, type, ...)`.
   - جایگزینی کارت `Placeholder` (در صورت کلیک از روی Placeholder) یا افزودن کارت جدید به گروه برد کمکی با ذخیره `pin: String(virtualPin)`, `isVirtual: true`, `nodeId`, `remotePin`.
   - روی کارت سگمنت مجازی، نمایش شماره پایه روی برد کمکی (مثلاً `Remote GPIO 2 · vPin 40`) تا کاربر دقیقاً بداند سیم لامپ/کلید را به کدام پایه ESP کمکی وصل کرده است.
4. **حذف سگمنت مجازی (`handleRemoveSegment`):**
   - ارسال همان فریم **`0x03` (`publishDeleteSegmentCommand(segment.id, segment.pin)`)** — زیرا `segment.pin` برابر `virtualPin` (`40..127`) است و فریم‌ور جدید آن را می‌شناسد.
   - اگر سگمنت حذف‌شده متعلق به یک گروه ESP کمکی (`auxNode`) بود، به‌جای خالی کردن کامل ظرفیت، یک کارت `Placeholder` جدید (`isVirtual: true`, `nodeId: segment.nodeId`) جایگزین آن در گروه شود تا تعداد کل اسلات‌های گروه برابر `pinCapacity` باقی بماند.

---

### تغییر ۶: همگام‌سازی Cloudflare (`buildEspConfig.ts` و `mappers.ts`)

1. در `features/iot/services/config/buildEspConfig.ts`:
   - اگر `auxNodes.length > 0` (یا حتی وقتی `0` است برای پاک کردن بردهای قدیمی در sync کامل)، قبل از `C n=...` خطوط زیر را تولید کنید:
     ```ts
     lines.push(`E n=${auxNodes.length}`);
     for (const node of auxNodes) {
       const chipCode = AUX_CHIP_CODE_MAP[node.chipType] ?? 0;
       const safeName = (node.name || `Node_${node.id}`).trim().replace(/\s+/g, "_").slice(0, 31);
       lines.push(`E id=${node.id} mac=${node.mac} cap=${node.pinCapacity} chip=${chipCode} name=${safeName}`);
     }
     ```
   - برای هر سگمنت مجازی در خط `S ...`، سه کلید زیر را به انتهای خط اضافه کنید:
     ```text
     virt=1 node=<segment.nodeId> rpin=<segment.remotePin>
     ```
   - قوانین `RH`، `RL` و `RR` بدون تغییر کار می‌کنند زیرا `id` (`vpin_40`) و `tgt` (`40..127`) مستقیماً توسط پارسر `ESP_CFG_V2` در فریم‌ور پشتیبانی می‌شوند.
2. در `features/iot/config/mappers.ts` (و payload ذخیره در Cloudflare KV):
   - آرایه `auxNodes` و فیلدهای `isVirtual`, `nodeId`, `remotePin` سگمنت‌ها را در JSON حفظ کنید تا با رفرش صفحه یا ورود از دستگاه دیگر، کل ساختار گروه‌های ESP کمکی، MACها و سگمنت‌های مجازی کاملاً بازیابی شوند.

---

## ۴. چک‌لیست تست‌های پیشنهادی در ریپازیتوری داشبورد

1. **`parseAndValidateMac`:**
   - پذیرش `aa:bb:cc:dd:ee:01`، `24-6F-28-11-22-33`، `a4cf12987654` و نرمال‌سازی به فرمت `XX:XX:XX:XX:XX:XX`.
   - رد کردن `00:00:00:00:00:00`، `FF:FF:FF:FF:FF:FF` و آدرس Multicast مثل `01:11:22:33:44:55`.
2. **ساخت فریم‌های باینری MQTT (`0x0F`, `0x10`, `0x11`, `0x03`):**
   - تست دقیق بایت‌به‌بایت `buildUpsertAuxNodeFrame` (طول `10 + utf8(name).length + 1`، ترتیب بایت‌های MAC، `pinCapacity`, `chipType`).
   - تست `buildDeleteAuxNodeFrame(1, { cascadeSegments: true, mac: "AA:BB:CC:DD:EE:01" })` (طول ۹ بایت، بایت ۲ برابر `0x01`).
   - تست `buildAddVirtualSegmentFrame` برای `gpio_toggle`, `analog_output` (با ۵ بایت متادیتای PWM) و `analog_input` (با ۹ بایت متادیتای ADC).
   - تست پذیرش `pin = 40` و `pin = 127` در `buildDeleteSegmentFrame (0x03)` و رد کردن `pin = 128`.
3. **جریان ساخت ESP کمکی و Placeholder:**
   - تعریف یک `ESP8266-01` با نام «باغچه» و ظرفیت `4` -> ساخت گروه «باغچه» + دقیقاً ۴ سگمنت `placeholder` با `isVirtual: true` و `nodeId: 1`.
   - کلیک روی یکی از Placeholderها و تبدیل آن به `gpio_toggle` روی `remotePin = 2` -> تخصیص `virtualPin = 40`، شناسه `vpin_40`، ارسال `0x11`، باقی ماندن ۳ Placeholder + ۱ سگمنت فعال.
   - حذف سگمنت مجازی `vpin_40` -> ارسال `0x03` با بایت fallback `40` و بازگشت اسلات به Placeholder.
4. **پارس پیام‌های `state_sync` و `aux_node_ack` و سریال‌سازی `ESP_CFG_V2`:**
   - پارس موفق `state_sync` شامل `"virtual"` و `"nodes"` و عدم خطا در پیام‌های قدیمی بدون این فیلدها.
   - تولید خطوط `E n=...`, `E id=... mac=...` و `S ... virt=1 node=... rpin=...` در `buildEspConfig`.

---

## ۵. جدول خلاصه فریم‌های باینری فاز ۱ (مرجع سریع)

| Opcode | نام دستور | ساختار بایت‌ها |
| :---: | :--- | :--- |
| **`0x0F`** | `UPSERT_AUX_NODE` | `[0x0F][nodeId:u8 (1..16)][mac:6B][pinCapacity:u8 (1..32)][chipType:u8 (0..5)][name_utf8...][0x00]` |
| **`0x10`** | `DELETE_AUX_NODE` | `[0x10][nodeId:u8 (0..16)][flags:u8 (bit0=cascade)][optional mac:6B]` |
| **`0x11`** | `ADD_VIRTUAL_SEGMENT` | `[0x11][virtualPin:u8 (40..127)][nodeId:u8 (1..16)][remotePin:u8 (0..39)][initState:u8][id...][0x00][type...][0x00][optional PWM 5B / ADC 9B]` |
| **`0x03`** | `DELETE_SEGMENT` v2 | `[0x03][id...][0x00][optional pin:u8 (0..127)]` |
| **`0x01`/`0x05`/`0x06`/`0x08`/`0x0A`/`0x0B`/`0x0C`/`0x0D`/`0x0E`** | دستورات کنترل و Rule | بدون تغییر فرمت فریم — محدوده معتبر `pin` اکنون **`0..127`** است |
