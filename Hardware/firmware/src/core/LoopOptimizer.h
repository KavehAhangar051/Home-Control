/**
 * @file LoopOptimizer.h
 * @brief بهینه‌سازی‌های Memory-for-Speed برای تابع loop() اصلی ESP32
 *
 * ایدئولوژی: RAM و Flash قربانی می‌شوند — تنها معیار سرعت loop() است.
 *
 * ۶ روش پیاده‌سازی‌شده:
 *  1. IRAM_ATTR  — loop() و توابع hot از Flash Cache خارج می‌شوند
 *  2. LoopFn Table — سه null-check pointer حذف می‌شوند (dispatch table)
 *  3. Pre-cached Callbacks — StaticFunction::bind() از hot path حذف می‌شود
 *  4. CCOUNT Throttle — wsServer/wsClient از هر iteration به 1ms کاهش پیدا می‌کنند
 *  5. GPIO Shadow Bitmask — یک REG_READ مستقیم به جای چند function call
 *  6. Pin Dispatch LUT — O(1) direct function pointer به جای RuleEngine search
 */

#pragma once

#include <Arduino.h>
#include <Optimization/CompilerTraits.h>
#include <Optimization/StaticFunction.h>
#include <Timer/Optimization/TimerAsm.h>
#include <AchaemenidConfigProtocol.h>

// ============================================================================
// روش ۱: IRAM_ATTR
// تعریف LOOP_IRAM_ATTR برای استفاده روی loop() و توابع hot
// ============================================================================
#define LOOP_IRAM_ATTR IRAM_ATTR

// ============================================================================
// روش ۲: Loop Function Dispatch Table
// آرایه‌ای از function pointer که یکبار در setup() پر می‌شه
// و در loop() بدون هیچ null-check یا branch miss فراخوانی می‌شه
// ============================================================================
namespace uniuno {

typedef void (*LoopFn)();

/**
 * @brief ثابت: حداکثر تعداد سرویس‌های قابل ثبت در dispatch table
 * 8 عدد کافیه: bootManager, wsServer, wsClient + ظرفیت آینده
 */
static constexpr uint8_t LOOP_DISPATCH_MAX = 8;

/**
 * @brief آرایه از function pointer‌ها در DRAM — نه Flash
 * DRAM_ATTR: تضمین می‌کنه این آرایه همیشه سریع قابل دسترسه،
 * حتی وقتی Flash Cache توسط WiFi/BT interrupt شده
 */
DRAM_ATTR static LoopFn s_loopTable[LOOP_DISPATCH_MAX];
DRAM_ATTR static uint8_t s_loopTableSize = 0;

/**
 * @brief ثبت یک سرویس در dispatch table (یکبار در setup() فراخوانی می‌شه)
 * @param fn تابع void() که در هر iteration از loop() فراخوانی می‌شه
 */
inline void registerLoopService(LoopFn fn) {
    if (s_loopTableSize < LOOP_DISPATCH_MAX) {
        s_loopTable[s_loopTableSize++] = fn;
    }
}

// ============================================================================
// روش ۳: Pre-cached Callbacks
// StaticFunction از قبل bind شده — صفر overhead در loop()
// ============================================================================
using InputCb  = StaticFunction<void, int, bool, unsigned long, const RuleConfig&>;
using AnalogCb = StaticFunction<void, const AnalogInputChange&, const RuleConfig&>;

/**
 * @brief کش از قبل آماده‌شده برای digital input callback
 * DRAM_ATTR: دسترسی سریع بدون flash cache miss
 */
DRAM_ATTR static InputCb  s_cachedInputCb;
DRAM_ATTR static AnalogCb s_cachedAnalogCb;
DRAM_ATTR static bool     s_callbacksCached = false;

// ============================================================================
// روش ۴: CCOUNT Throttle برای wsServer و wsClient
// به جای فراخوانی هر iteration، دقیقاً هر 1ms یکبار
// از همان مکانیزم CCOUNT که Executor و PinStateManager استفاده می‌کنند
// ============================================================================
DRAM_ATTR static uint32_t s_lastWsCycle = 0;

/**
 * @brief بازه زمانی فراخوانی wsServer/wsClient: هر 1ms
 * محاسبه در compile-time: 240MHz × 1ms = 240000 cycle
 */
static constexpr uint32_t WS_POLL_INTERVAL_CYCLES = asm_opt::ms_to_cycles(1);

/**
 * @brief بررسی آیا زمان poll کردن WebSocket رسیده (بدون millis())
 * @return true اگر 1ms از آخرین poll گذشته باشه
 */
FORCE_INLINE bool isWsPollDue() {
    const uint32_t now = asm_opt::get_cpu_cycle_count();
    if (LIKELY(static_cast<uint32_t>(now - s_lastWsCycle) < WS_POLL_INTERVAL_CYCLES)) {
        return false;
    }
    s_lastWsCycle = now;
    return true;
}

// ============================================================================
// روش ۵: GPIO Shadow Bitmask
// یک REG_READ مستقیم به جای چند function call برای بررسی تغییر GPIO
// ============================================================================
#if defined(ESP32)
#include <soc/gpio_struct.h>

DRAM_ATTR static uint32_t s_shadowGpio0_31 = 0;
DRAM_ATTR static uint32_t s_shadowGpio32_39 = 0;

/**
 * @brief خواندن مستقیم GPIO registers و ذخیره در shadow بدون هیچ function call
 * این shadow توسط PinStateManager هم استفاده می‌شه (hasInputsChanged)
 * اما اینجا یه read اضافه برای LUT dispatch داریم — قابل ادغام با PinStateManager
 */
FORCE_INLINE void updateGpioShadow() {
    s_shadowGpio0_31  = GPIO.in;
    s_shadowGpio32_39 = GPIO.in1.val;
}

#endif // ESP32

// ============================================================================
// روش ۶: Pin Dispatch LUT
// آرایه ثابت indexed by GPIO pin number — O(1) direct dispatch
// ============================================================================

/** تعداد GPIO pins در ESP32 */
static constexpr uint8_t ESP32_GPIO_COUNT = 40;

/**
 * @brief یک entry در LUT به ازای هر GPIO pin
 * اگر pin فعال نباشه، active = false و function pointer‌ها nullptr هستند
 */
struct PinDispatchEntry {
    /** callback برای digital input (Input segment) */
    void (*onDigitalChange)(int pin, bool state, unsigned long dur, const RuleConfig& r) = nullptr;
    /** callback برای analog input (AnalogInput segment) */
    void (*onAnalogChange)(const AnalogInputChange& ch, const RuleConfig& r) = nullptr;
    /** آیا این pin در LUT فعاله */
    bool active = false;
};

/**
 * @brief LUT اصلی — indexed by GPIO pin (0-39)
 * DRAM_ATTR: تضمین دسترسی سریع در hot path
 * هر entry 10 byte → آرایه 400 byte در DRAM
 */
DRAM_ATTR static PinDispatchEntry s_pinDispatchLUT[ESP32_GPIO_COUNT];
DRAM_ATTR static bool s_lutBuilt = false;

} // namespace uniuno

