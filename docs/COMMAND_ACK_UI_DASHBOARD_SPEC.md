# راهنمای تغییرات داشبورد (`Home-Control-Dashboard`) برای جداسازی کامل `command_ack` از وضعیت UI سگمنت‌ها

> **هدف این سند:** برطرف کردن باگ برگشت ناخواسته UI سگمنت هنگام تغییر سریع وضعیت خروجی (Rapid Toggle Race Condition). بر اساس این اصلاح، پیام `command_ack` که از ESP32 ارسال می‌شود **هرگز** نباید `pinsState`، `pinsAnalogValue`، تایمر یا وضعیت ظاهری کلید را تغییر دهد و **فقط** باید نشانگر (Indicator) دریافت ACK روی کارت همان سگمنت را فعال کند.

---

## ۱. علت دقیق باگ در کدهای فعلی داشبورد

در حال حاضر وقتی کاربر روی یک خروجی (مثلاً GPIO 5) سریعاً دو بار کلیک می‌کند (مثلاً اول **روشن** و قبل از رسیدن ACK اول، دوباره **خاموش**):

1. کلیک اول `pinsState["5"] = true` را به‌صورت Optimistic ست کرده و فرمان `0x01 (ON)` را می‌فرستد.
2. ESP32 فرمان اول را اجرا می‌کند و پیام `{"type":"command_ack","pin":5,"state":true}` را روی تاپیک `/State` برمی‌گرداند.
3. پیش از رسیدن آن ACK به مرورگر، کاربر دوباره کلیک کرده و `pinsState["5"] = false` (خاموش) را ست کرده و فرمان `0x01 (OFF)` را می‌فرستد.
4. حالا پیام `command_ack` مربوط به فرمان اول (`state: true`) به داشبورد می‌رسد و در ۳ نقطه باعث بازنویسی UI به حالت قبلی می‌شود:
   - در `features/iot/services/mqtt/messageParser.ts` (خطوط ۱۲۴ تا ۱۶۳)، پیام `command_ack` با `kind: "pin_update"` و `isAck: true` برگردانده می‌شود.
   - در `features/iot/services/mqtt/init.ts` (خطوط ۳۸۸ تا ۴۰۳)، `command_ack` مستقیماً به `deps.queueStateUpdate(...)` فرستاده می‌شود که هم `applyPinsState` (و `pinsAnalogValue`) را بازنویسی می‌کند و هم `stateCallbacks` را صدا می‌زند (که در `usePinOperations.ts:402` دوباره `setPinsState` را اجرا می‌کند!).
   - در `features/iot/hooks/achaemenidState/useConnectionStrategy.ts` (خطوط ۱۷۰ تا ۲۱۴) نیز در مسیر Local WebSocket، اگر `data.type === "command_ack"` برسد، `deps.setPinsState` و `deps.setPinsAnalogValue` را بازنویسی می‌کند.

> نکته: در فریم‌ور ESP32 (`firmware/src/events/EventHandlers.cpp:211`) به‌طور شفاف دو نوع پیام مجزا ارسال می‌شود:
> - `type: "command_ack"`: صرفاً تأییدیه دریافت دستور از سمت داشبورد (**نباید وضعیت UI را تغییر دهد**).
> - `type: "pin_update"`: تغییر واقعی وضعیت از منبع دیگر (ورودی فیزیکی، RuleEngine/اتوماسیون، Cloudflare یا تغییر محلی — **باید UI را به‌روزرسانی کند**).

---

## ۲. تغییرات مورد نیاز در داشبورد (گام‌به‌گام)

### گام ۱: جداسازی نوع `command_ack` در پارسر پیام‌های MQTT

در فایل **`features/iot/services/mqtt/messageParser.ts`** (خطوط ۲۵ تا ۴۳ و ۱۲۳ تا ۱۶۴):

۱. نوع `ParsedMqttStateMessage` را با یک variant مستقل به نام `"command_ack"` به‌روزرسانی کنید (و `isAck` را از `pin_update` حذف کنید تا از نظر TypeScript هیچ‌گاه امکان عبور اشتباه ACK به `queueStateUpdate` وجود نداشته باشد):

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
      state?: boolean;
      value?: number;
      resolution?: number;
    }
```

۲. در خطوط ۱۲۳ تا ۱۶۴، شاخه `data.type === "command_ack"` را قبل از `pin_update` به‌صورت مجزا برگردانید:

```ts
      if (data.type === "command_ack" && data.pin !== undefined) {
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

        return {
          kind: "command_ack",
          pinId,
          ...(data.state !== undefined ? { state: toBooleanPinState(data.state) } : {}),
          ...(parsedNumericValue !== undefined ? { value: parsedNumericValue } : {}),
          ...(parsedResolution !== undefined ? { resolution: parsedResolution } : {}),
        };
      }

      if (
        data.type === "pin_update" &&
        data.pin !== undefined &&
        (data.state !== undefined || data.value !== undefined)
      ) {
        // ... همان کد قبلی صرفاً برای pin_update (بدون isAck)
      }
```

---

### گام ۲: ایجاد کانال سبک و اختصاصی برای اعلان ACK به کارت سگمنت (بدون Re-render کل صفحه)

برای اینکه دریافت ACK فقط نشانگر کارت همان پایه را فعال کند و هرگز کل داشبورد یا `pinsState` را تغییر ندهد، یک pub/sub سبک بر پایه `pinId` ایجاد کنید (مثلاً در **`features/iot/services/pinAckBus.ts`**):

```ts
type PinAckListener = (pinId: string) => void;

const pinAckListeners = new Map<string, Set<PinAckListener>>();

/**
 * Subscribe a single segment card to ESP32 command_ack confirmations for its GPIO pin.
 * Does NOT touch Zustand pinsState or re-render unrelated cards.
 */
export function subscribePinCommandAck(pinId: string, listener: PinAckListener): () => void {
  let set = pinAckListeners.get(pinId);
  if (!set) {
    set = new Set<PinAckListener>();
    pinAckListeners.set(pinId, set);
  }
  set.add(listener);

  return () => {
    const current = pinAckListeners.get(pinId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) {
      pinAckListeners.delete(pinId);
    }
  };
}

/**
 * Emit an ESP32 command_ack event for a specific GPIO pin.
 */
export function notifyPinCommandAck(pinId: string): void {
  const listeners = pinAckListeners.get(pinId);
  if (!listeners || listeners.size === 0) return;

  for (const listener of listeners) {
    listener(pinId);
  }
}
```

---

### گام ۳: جلوگیری کامل از تغییر UI در مسیر MQTT (`init.ts`)

در فایل **`features/iot/services/mqtt/init.ts`**:

۱. در `MqttMessageHandlerDeps` (حدود خط ۳۱۲)، یک callback اختیاری `onCommandAck?: (pinId: string) => void;` اضافه کنید (پیش‌فرض: `notifyPinCommandAck`).

۲. در `createMqttMessageHandler` (خطوط ۳۸۸ تا ۴۰۴)، `command_ack` را به‌صورت کامل از `queueStateUpdate` جدا کنید:

```ts
      if (parsedState.kind === "command_ack") {
        logMqttDebug(
          `[MQTT] Received command_ack from ESP32: pin=${parsedState.pinId} (UI state preserved)`,
        );
        // CRITICAL: Never mutate pinsState, pinsAnalogValue, timers, or stateCallbacks on command_ack.
        // Only notify the segment's ACK indicator.
        (deps.onCommandAck ?? notifyPinCommandAck)(parsedState.pinId);
      } else if (parsedState.kind === "pin_update") {
        const label =
          parsedState.source === "binary" ? "state update" : "JSON state update";
        logMqttDebug(
          `[MQTT] Received ${label} from ESP32: pin=${parsedState.pinId} state=${parsedState.state}${parsedState.value !== undefined ? ` value=${parsedState.value}` : ""}`,
        );

        deps.queueStateUpdate(parsedState.pinId, parsedState.state, {
          analogValue: parsedState.value,
          clearAnalogOnOff: parsedState.value === undefined && !parsedState.state,
          resolution: parsedState.resolution,
          clearAutoOffTimer: true,
        });
      }
```

---

### گام ۴: جلوگیری کامل از تغییر UI در مسیر Local WebSocket (`useConnectionStrategy.ts`)

در فایل **`features/iot/hooks/achaemenidState/useConnectionStrategy.ts`** (خطوط ۱۷۰ تا ۲۱۴):

در `ws.onmessage`، پیش از بلوک `else if (data.pin !== undefined ...)` یک شاخه صریح برای `data.type === "command_ack"` قرار دهید تا هیچ‌گاه `deps.setPinsState`، `deps.setPinsAnalogValue`، `deps.setPinsPwmResolution`، `deps.setAutoOffRemaining` یا `dispatchLocalStateFn` را صدا نزند:

```ts
        } else if (data.type === "command_ack" && data.pin !== undefined) {
          const pinKey = data.pin.toString();
          (deps.onCommandAck ?? notifyPinCommandAck)(pinKey);
        } else if (
          data.pin !== undefined &&
          (data.state !== undefined || data.value !== undefined)
        ) {
          // ... همان منطق موجود برای pin_update واقعی
          // (و دیگر نیازی به شرط data.type !== "command_ack" در خط 209 نیست)
```

---

### گام ۵: اتصال نشانگر ACK روی کارت سگمنت (بدون اثر روی حالت کلید)

۱. یک هوک کوچک در **`features/iot/components/sortable-segment-card/hooks/usePinCommandAck.ts`** بسازید:

```ts
"use client";

import { useEffect, useRef, useState } from "react";
import { subscribePinCommandAck } from "@/features/iot/services/pinAckBus";

const ACK_INDICATOR_DURATION_MS = 700;

/**
 * Returns `true` briefly when ESP32 confirms command delivery via `command_ack`
 * for this segment's GPIO pin, without altering switch or analog state.
 */
export function usePinCommandAck(pin: string | undefined): boolean {
  const [ackReceived, setAckReceived] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!pin) return;

    const unsubscribe = subscribePinCommandAck(String(pin), () => {
      setAckReceived(true);
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        setAckReceived(false);
        timerRef.current = null;
      }, ACK_INDICATOR_DURATION_MS);
    });

    return () => {
      unsubscribe();
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [pin]);

  return ackReceived;
}
```

۲. در **`features/iot/components/sortable-segment-card/components/CardFooter.tsx`** (خطوط ۴ تا ۳۸ و ۱۲۸ تا ۱۳۰):
   - پراپ اختیاری `isAckFlashing?: boolean;` را به `CardFooterProps` اضافه کنید و از `ActiveCard.tsx` (و در صورت استفاده از فوتر مشابه در `TrellisSegmentTile.tsx`، `TrellisSegmentView.tsx` و `CanvasSegmentNode.tsx`) مقدار `usePinCommandAck(segment.pin)` را به آن پاس دهید.
   - در `getStatusDotClass` (خطوط ۳۲ تا ۳۸)، فقط روی همان نقطه وضعیت (نشانگر سگمنت) افکت تایید دریافت ACK را نمایش دهید:

```ts
function getStatusDotClass(
  isPinOn: boolean,
  mode: "switch" | "push",
  isPending = false,
  isAckFlashing = false,
): string {
  if (isAckFlashing) {
    return "bg-success ring-4 ring-success/35 scale-125 transform-gpu";
  }

  if (isPending) return "bg-accent3 animate-pulse transform-gpu";

  if (!isPinOn) return "bg-text-muted opacity-45";

  return mode === "push" ? "bg-accent3 animate-ping transform-gpu" : "bg-success";
}
```

---

## ۳. تست‌های واحد پیشنهادی برای افزودن در داشبورد

در `tests/mqtt-state-sync.test.mjs` و `tests/mqtt-resilience.test.mjs` موارد زیر را اضافه کنید:

1. **`parseMqttStateMessage` برای `command_ack`:**
   - پیام `{"type":"command_ack","pin":5,"state":true}` باید `{ kind: "command_ack", pinId: "5", state: true }` برگرداند (نه `kind: "pin_update"`).
2. **سناریوی دقیق Race Condition (دو کلیک سریع):**
   - `pinsState["5"]` را روی `false` (نتیجه کلیک دوم کاربر) قرار دهید.
   - یک پیام `{"type":"command_ack","pin":5,"state":true}` (ACK تاخیری کلیک اول) به `createMqttMessageHandler` ارسال کنید.
   - بررسی شود:
     - `queueStateUpdate` **صفر بار** فراخوانی شود.
     - `pinsState["5"]` همچنان **`false`** باقی بماند (به `true` برنگردد).
     - `onCommandAck` دقیقاً یک‌بار با `"5"` صدا زده شود.
3. **اطمینان از کارکرد صحیح `pin_update` واقعی:**
   - پیام `{"type":"pin_update","pin":5,"state":true,"source":"physical_input"}` همچنان باید `queueStateUpdate("5", true, ...)` را صدا بزند و UI را به‌روزرسانی کند.
