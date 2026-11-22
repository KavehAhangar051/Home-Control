# راهنمای تغییرات داشبورد (`Home-Control-Dashboard`) برای جداسازی کامل `command_ack` از وضعیت UI سگمنت

> **هدف این سند:** این فایل دقیقاً تمام تغییرات مورد نیاز در ریپازیتوری `Home-Control-Dashboard` را مشخص می‌کند تا پیام `command_ack` ارسالی از ESP32 **هرگز** وضعیت روشن/خاموش یا مقدار آنالوگ UI سگمنت را بازنویسی نکند (رفع کامل باگ پرش به حالت قبلی هنگام کلیک سریع پیاپی) و **فقط نشانگر (Indicator) سگمنت** را برای اعلان دریافت ACK از ESP32 فعال کند.

---

## ۱. ریشه باگ (چرا UI به حالت قبلی برمی‌گشت؟)

در وضعیت فعلی داشبورد، وقتی کاربر روی یک سگمنت خروجی کلیک می‌کند:
1. کلیک اول (مثلاً روشن کردن پین ۲): `executeSinglePinUpdate` بلافاصله به صورت Optimistic مقدار `pinsState["2"] = true` را ست می‌کند و فرمان باینری MQTT را به ESP32 می‌فرستد.
2. ESP32 فرمان اول را دریافت کرده و پیام `{"type":"command_ack","pin":2,"state":true}` را روی تاپیک `/State` برمی‌گرداند.
3. در همین فاصله زمانی (قبل از رسیدن ACK اول)، کاربر دوباره کلیک می‌کند و پین ۲ را **خاموش** (`false`) می‌کند. UI بلافاصله خاموش می‌شود.
4. لحظه‌ای بعد، `command_ack` مربوط به فرمان اول (`state: true`) به داشبورد می‌رسد و در **سه نقطه** به‌اشتباه وضعیت UI را به حالت قبلی (`true`) برمی‌گرداند:
   - **`features/iot/services/mqtt/messageParser.ts` (خطوط ۱۲۴ تا ۱۶۴):** هر دو پیام `"pin_update"` و `"command_ack"` را به یک نوع واحد `kind: "pin_update"` (فقط با پرچم `isAck: true`) تبدیل می‌کند.
   - **`features/iot/services/mqtt/init.ts` (خطوط ۳۸۸ تا ۴۰۳):** پیام `isAck: true` را مستقیماً به `deps.queueStateUpdate(...)` می‌فرستد که هم `setPinsState` / `setPinsAnalogValue` را صدا می‌زند و هم `onMqttStateChange` (خط ۴۰۲ در `usePinOperations.ts`) را اجرا کرده و `pinsState["2"]` را دوباره به `true` برمی‌گرداند!
   - **`features/iot/hooks/achaemenidState/useConnectionStrategy.ts` (خطوط ۱۷۰ تا ۲۱۴):** در مسیر Local WebSocket نیز پیام `data.type === "command_ack"` بدون تفکیک وارد خط ۱۸۶ (`deps.setPinsState`) و `setPinsAnalogValue` و `dispatchLocalStateFn` می‌شود.

---

## ۲. قانون معماری جدید (Contract بین ESP32 و داشبورد)

- **`command_ack`** صرفاً تأییدیه دریافت دستور توسط ESP32 است:
  - **ممنوع:** تغییر `pinsState`، `pinsAnalogValue`، `pinsLastNonZeroValue`، `pinsPwmResolution`، `autoOffRemaining` یا فراخوانی `onMqttStateChange` / `dispatchLocalState`.
  - **مجاز و کافی:** ثبت یک سیگنال سبک برای همان پین (`recordPinCommandAck(pinId)`) تا **نشانگر سگمنت (Status Dot / ACK Pulse)** یک پالس کوتاه تأییدیه نمایش دهد.
- **`pin_update`** (از کلید فیزیکی، RuleEngine/Automation یا Cloudflare) و **`state_sync`** (همگام‌سازی کامل هنگام اتصال) همچنان مانند قبل وضعیت واقعی `pinsState` و `pinsAnalogValue` را به‌روزرسانی می‌کنند.

---

## ۳. تغییرات دقیق فایل‌به‌فایل در `Home-Control-Dashboard`

### تغییر ۱: جداسازی کامل `command_ack` در `features/iot/services/mqtt/messageParser.ts`

1. در تعریف نوع `ParsedMqttStateMessage` (خطوط ۲۵ تا ۴۳)، فیلد `isAck` را از `pin_update` حذف کرده و یک شاخه مستقل `command_ack` اضافه کنید:

```ts
  | {
      kind: "pin_update";
      pinId: string;
      state: boolean;
      source: "binary" | "json";
      value?: number;
      resolution?: number;
    }
  | {
      kind: "command_ack";
      pinId: string;
      state: boolean;
      value?: number;
      resolution?: number;
    }
```

2. در تابع `parseMqttStateMessage` (خطوط ۱۲۳ تا ۱۶۴)، هنگام `data.type === "command_ack"` خروجی را با `kind: "command_ack"` برگردانید:

```ts
      if (
        (data.type === "pin_update" || data.type === "command_ack") &&
        data.pin !== undefined &&
        (data.state !== undefined || data.value !== undefined)
      ) {
        const rawPin = data.pin;
        const pinId =
          Number.isInteger(rawPin) && Number(rawPin) >= 0 && Number(rawPin) < 256
            ? PIN_ID_STRINGS[Number(rawPin)]
            : String(rawPin);

        const parsedNumericValue =
          typeof data.value === "number" && Number.isFinite(data.value)
            ? Math.min(4095, Math.max(0, Math.round(data.value)))
            : undefined;

        const parsedResolution =
          typeof data.resolution === "number" &&
          Number.isFinite(data.resolution) &&
          data.resolution >= 8 &&
          data.resolution <= 12
            ? Math.round(data.resolution)
            : undefined;

        const resolvedState =
          data.state !== undefined
            ? toBooleanPinState(data.state)
            : parsedNumericValue !== undefined
              ? parsedNumericValue > 0
              : false;

        if (data.type === "command_ack") {
          return {
            kind: "command_ack",
            pinId,
            state: resolvedState,
            ...(parsedNumericValue !== undefined ? { value: parsedNumericValue } : {}),
            ...(parsedResolution !== undefined ? { resolution: parsedResolution } : {}),
          };
        }

        return {
          kind: "pin_update",
          pinId,
          state: resolvedState,
          source: "json",
          ...(parsedNumericValue !== undefined ? { value: parsedNumericValue } : {}),
          ...(parsedResolution !== undefined ? { resolution: parsedResolution } : {}),
        };
      }
```

---

### تغییر ۲: افزودن شمارنده سبک ACK برای هر پین در Store و StoreBridge (بدون لمس `pinsState`)

#### الف) `features/iot/hooks/store/types.ts` (بخش `SegmentsSlice`)
```ts
  /** Monotonic per-pin counter incremented exclusively on ESP32 command_ack (never mutates pinsState). */
  pinsAckSeq: Record<string, number>;
  recordPinCommandAck: (pinId: string) => void;
```

#### ب) `features/iot/hooks/store/slices/createSegmentsSlice.ts`
```ts
  pinsAckSeq: {},

  recordPinCommandAck: (pinId) => {
    set((state) => ({
      pinsAckSeq: {
        ...state.pinsAckSeq,
        [pinId]: (state.pinsAckSeq[pinId] ?? 0) + 1,
      },
    }));
  },
```

#### ج) `features/iot/services/storeBridge.ts`
در رابط `IoTStoreBridge` و مقدار پیش‌فرض آن (و اتصالش به `useIoTStore`):
```ts
  recordPinCommandAck: (pinId: string) => void;
```
*(مقدار پیش‌فرض no-op: `recordPinCommandAck: () => {}`)*

---

### تغییر ۳: جلوگیری کامل از تغییر وضعیت UI در `features/iot/services/mqtt/init.ts` (خطوط ۳۸۵ تا ۴۰۵)

در `handleMqttMessage`، شاخه `command_ack` را **جدا از `pin_update`** هندل کنید تا هرگز به `deps.queueStateUpdate` یا `onMqttStateChange` نرسد:

```ts
    } else if (topic === deps.stateTopic) {
      const parsedState = parseMqttStateMessage(payload);

      if (parsedState.kind === "command_ack") {
        logMqttDebug(
          `[MQTT] Received command_ack from ESP32 (indicator only, UI state preserved): pin=${parsedState.pinId}`,
        );
        deps.getSnapshot().recordPinCommandAck(parsedState.pinId);
      } else if (parsedState.kind === "pin_update") {
        const label = parsedState.source === "binary" ? "state update" : "JSON state update";
        logMqttDebug(
          `[MQTT] Received ${label} from ESP32: pin=${parsedState.pinId} state=${parsedState.state}${parsedState.value !== undefined ? ` value=${parsedState.value}` : ""}`,
        );

        deps.queueStateUpdate(parsedState.pinId, parsedState.state, {
          analogValue: parsedState.value,
          clearAnalogOnOff: parsedState.value === undefined && !parsedState.state,
          resolution: parsedState.resolution,
          clearAutoOffTimer: true,
        });
      } else if (parsedState.kind === "state_sync") {
        // بدون تغییر
```

---

### تغییر ۴: اعمال دقیق همین قانون در مسیر Local WebSocket (`features/iot/hooks/achaemenidState/useConnectionStrategy.ts`)

1. به `ConnectionStrategyDeps` (حدود خط ۳۰) اضافه کنید:
```ts
  recordPinCommandAck?: (pinId: string) => void;
```
و هنگام فراخوانی از `useIoTStore` مقدار `recordPinCommandAck` را پاس بدهید.

2. در `ws.onmessage` (خطوط ۱۷۰ تا ۲۱۵)، **قبل از** هرگونه تغییر `setPinsState` یا `setPinsAnalogValue` یا `dispatchLocalStateFn`:

```ts
        } else if (data.type === "command_ack" && data.pin !== undefined) {
          const pinKey = data.pin.toString();
          deps.recordPinCommandAck?.(pinKey);
        } else if (
          data.pin !== undefined &&
          (data.state !== undefined || data.value !== undefined)
        ) {
          // این بخش اکنون فقط برای pin_update واقعی (تغییر فیزیکی/اتوماسیون) اجرا می‌شود
          const pinKey = data.pin.toString();
          // ... بقیه منطق pin_update بدون تغییر (و شرط data.type !== "command_ack" دیگر لازم نیست)
```

---

### تغییر ۵: نمایش اعلان دریافت ACK روی نشانگر همان سگمنت (بدون تغییر حالت روشن/خاموش)

یک هوک سبک برای پالس نشانگر بسازید (`features/iot/components/sortable-segment-card/hooks/usePinAckIndicator.ts`):

```ts
"use client";

import { useEffect, useRef, useState } from "react";
import { useIoTStore } from "@/features/iot/hooks/store";

const ACK_FLASH_DURATION_MS = 550;

/**
 * Triggers a brief visual confirmation pulse on the segment indicator dot
 * whenever ESP32 acknowledges a command for `pin`, without mutating pin state.
 */
export function usePinAckIndicator(pin: string): boolean {
  const ackSeq = useIoTStore((state) => state.pinsAckSeq[pin] ?? 0);
  const lastSeenRef = useRef(ackSeq);
  const [ackFlashing, setAckFlashing] = useState(false);

  useEffect(() => {
    if (ackSeq === lastSeenRef.current) return;
    lastSeenRef.current = ackSeq;
    setAckFlashing(true);

    const timer = globalThis.setTimeout(() => {
      setAckFlashing(false);
    }, ACK_FLASH_DURATION_MS);

    return () => globalThis.clearTimeout(timer);
  }, [ackSeq]);

  return ackFlashing;
}
```

سپس در `ActiveCard.tsx` (و در صورت نیاز `TrellisSegmentTile.tsx` و `CanvasSegmentNode.tsx`):
- `const isAckConfirmed = usePinAckIndicator(segment.pin);` را خوانده و به `CardBody` -> `CardFooter` پاس دهید.
- در `CardFooter.tsx` (`getStatusDotClass`, خطوط ۳۲ تا ۳۸):
```ts
function getStatusDotClass(
  isPinOn: boolean,
  mode: "switch" | "push",
  isPending = false,
  isAckConfirmed = false,
): string {
  if (isAckConfirmed) {
    return "bg-emerald-400 ring-4 ring-emerald-400/35 scale-110 transform-gpu";
  }
  if (isPending) return "bg-accent3 animate-pulse transform-gpu";
  if (!isPinOn) return "bg-text-muted opacity-45";
  return mode === "push" ? "bg-accent3 animate-ping transform-gpu" : "bg-success";
}
```
> **مزیت کلیدی پرفورمنس:** هر کارت سگمنت فقط به `state.pinsAckSeq[segment.pin]` خودش subscribe است، بنابراین با رسیدن ACK برای پین ۲، **فقط نشانگر کارت پین ۲** پالس تأییدیه می‌زند و هیچ کارت دیگری در داشبورد re-render نمی‌شود.

---

## ۴. تست‌های واحد پیشنهادی در داشبورد (`tests/mqtt-state-sync.test.mjs`)

1. **`parseMqttStateMessage` برای `command_ack`:**
   - ورودی `{"type":"command_ack","pin":2,"state":true}` باید دقیقاً `{ kind: "command_ack", pinId: "2", state: true }` برگرداند و `kind` آن `"pin_update"` نباشد.
2. **سناریوی دقیق باگ (Rapid Toggle + Late ACK):**
   - وضعیت `pinsState["2"]` ابتدا `true` شده و بلافاصله توسط کاربر به `false` تغییر داده می‌شود.
   - سپس پیام دیررس `{"type":"command_ack","pin":2,"state":true}` وارد `handleMqttMessage` می‌شود.
   - **انتظار تست:**
     - `pinsState["2"]` همچنان `false` باقی بماند (تحت هیچ شرایطی به `true` برنگردد!).
     - `pinsAnalogValue` و `autoOffRemaining` تغییر نکنند و `onMqttStateChange` صدا زده نشود.
     - `recordPinCommandAck("2")` دقیقاً یک‌بار فراخوانی شود (`pinsAckSeq["2"] === 1`).
3. **حفظ عملکرد واقعی `pin_update`:**
   - پیام `{"type":"pin_update","pin":2,"state":true,"source":"physical_input"}` همچنان `kind: "pin_update"` برگرداند و `pinsState["2"]` را به `true` به‌روزرسانی کند.
