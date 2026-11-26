/**
 * @file AsyncEventRing.h
 * @brief Zero-copy two-priority DRAM event ring buffer with TaskNotify wakeups for AsyncTCP.
 * @author uniuno
 *
 * Replaces FreeRTOS xQueue + separate malloc/free pointer pool with a bounded
 * power-of-2 DRAM circular buffer pair and coalesced sleeping task notifications.
 */

#pragma once

#include <cstdint>
#include <cstddef>
#include "esp_heap_caps.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/portmacro.h"
#include "Optimization/CompilerTraits.h"
#include "Optimization/XtensaMemAsm.h"

extern "C" {
#include "lwip/ip_addr.h"
#include "lwip/pbuf.h"
struct tcp_pcb;
}

class AsyncClient;

typedef enum {
    LWIP_TCP_SENT,
    LWIP_TCP_RECV,
    LWIP_TCP_FIN,
    LWIP_TCP_ERROR,
    LWIP_TCP_POLL,
    LWIP_TCP_CLEAR,
    LWIP_TCP_ACCEPT,
    LWIP_TCP_CONNECTED,
    LWIP_TCP_DNS
} lwip_event_t;

typedef struct {
    lwip_event_t event;
    void *arg;
    union {
        struct {
            void *pcb;
            int8_t err;
        } connected;
        struct {
            int8_t err;
        } error;
        struct {
            tcp_pcb *pcb;
            uint16_t len;
        } sent;
        struct {
            tcp_pcb *pcb;
            pbuf *pb;
            int8_t err;
        } recv;
        struct {
            tcp_pcb *pcb;
            int8_t err;
        } fin;
        struct {
            tcp_pcb *pcb;
        } poll;
        struct {
            AsyncClient *client;
        } accept;
        struct {
            const char *name;
            ip_addr_t addr;
        } dns;
    };
} lwip_event_packet_t;

static_assert((sizeof(lwip_event_packet_t) & 3U) == 0U, "lwip_event_packet_t size must be a multiple of 4 bytes");

namespace uniuno {
namespace asynctcp_detail {

constexpr size_t kNormRingCap  = 256U;
constexpr size_t kNormRingMask = kNormRingCap - 1U;
constexpr size_t kHighRingCap  = 32U;
constexpr size_t kHighRingMask = kHighRingCap - 1U;
constexpr uint32_t kPacketWords = static_cast<uint32_t>(sizeof(lwip_event_packet_t) / sizeof(uint32_t));

struct AsyncEventRingState {
    lwip_event_packet_t *norm_ring;
    lwip_event_packet_t *high_ring;
    uint32_t norm_head;
    uint32_t norm_tail;
    uint32_t high_head;
    uint32_t high_tail;
    bool task_sleeping;
    portMUX_TYPE mux;
};

static AsyncEventRingState s_ring = {
    nullptr, nullptr, 0U, 0U, 0U, 0U, false, portMUX_INITIALIZER_UNLOCKED
};

/**
 * @brief Lazily allocates normal (256) and high-priority (32) event rings in internal 8-bit DRAM.
 * @return true if both rings are ready for use.
 */
inline bool init_event_rings() {
    if (LIKELY(s_ring.norm_ring != nullptr && s_ring.high_ring != nullptr)) {
        return true;
    }
    lwip_event_packet_t *norm = nullptr;
    lwip_event_packet_t *high = nullptr;

    portENTER_CRITICAL(&s_ring.mux);
    const bool need_norm = (s_ring.norm_ring == nullptr);
    const bool need_high = (s_ring.high_ring == nullptr);
    portEXIT_CRITICAL(&s_ring.mux);

    if (need_norm) {
        norm = static_cast<lwip_event_packet_t *>(
            heap_caps_malloc(sizeof(lwip_event_packet_t) * kNormRingCap, MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT)
        );
    }
    if (need_high) {
        high = static_cast<lwip_event_packet_t *>(
            heap_caps_malloc(sizeof(lwip_event_packet_t) * kHighRingCap, MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT)
        );
    }

    portENTER_CRITICAL(&s_ring.mux);
    if (s_ring.norm_ring == nullptr && norm != nullptr) {
        s_ring.norm_ring = norm;
        norm = nullptr;
    }
    if (s_ring.high_ring == nullptr && high != nullptr) {
        s_ring.high_ring = high;
        high = nullptr;
    }
    const bool ready = (s_ring.norm_ring != nullptr && s_ring.high_ring != nullptr);
    portEXIT_CRITICAL(&s_ring.mux);

    if (UNLIKELY(norm != nullptr)) heap_caps_free(norm);
    if (UNLIKELY(high != nullptr)) heap_caps_free(high);
    return ready;
}

/**
 * @brief Enqueues an event packet directly into the selected DRAM ring and wakes the service task if asleep.
 * @param ev Event payload copied via Xtensa loopnez asm_copy_words.
 * @param high_prio True for control/lifecycle events (CONNECTED, ACCEPT).
 * @param service_task Handle of the async_tcp worker task.
 * @return true on success, false if ring remains full after bounded wait.
 */
HOT_PATH inline bool push_event(const lwip_event_packet_t &ev, bool high_prio, TaskHandle_t service_task) {
    if (UNLIKELY(s_ring.norm_ring == nullptr || s_ring.high_ring == nullptr)) {
        if (!init_event_rings()) {
            return false;
        }
    }

    const uint32_t max_attempts = (xTaskGetCurrentTaskHandle() != service_task) ? 100U : 1U;
    for (uint32_t attempt = 0U; attempt < max_attempts; ++attempt) {
        bool pushed = false;
        bool wake = false;

        portENTER_CRITICAL(&s_ring.mux);
        if (high_prio) {
            if (LIKELY((s_ring.high_head - s_ring.high_tail) < kHighRingCap)) {
                xtensa_asm::asm_copy_words(
                    reinterpret_cast<uint32_t *>(&s_ring.high_ring[s_ring.high_head & kHighRingMask]),
                    reinterpret_cast<const uint32_t *>(&ev),
                    kPacketWords
                );
                s_ring.high_head++;
                pushed = true;
            }
        } else {
            if (LIKELY((s_ring.norm_head - s_ring.norm_tail) < kNormRingCap)) {
                xtensa_asm::asm_copy_words(
                    reinterpret_cast<uint32_t *>(&s_ring.norm_ring[s_ring.norm_head & kNormRingMask]),
                    reinterpret_cast<const uint32_t *>(&ev),
                    kPacketWords
                );
                s_ring.norm_head++;
                pushed = true;
            }
        }
        if (LIKELY(pushed) && s_ring.task_sleeping) {
            s_ring.task_sleeping = false;
            wake = true;
        }
        portEXIT_CRITICAL(&s_ring.mux);

        if (LIKELY(pushed)) {
            if (wake && LIKELY(service_task != nullptr)) {
                xTaskNotifyGive(service_task);
            }
            return true;
        }
        if (max_attempts > 1U) {
            vTaskDelay(1);
        }
    }
    return false;
}

/**
 * @brief Pops the next pending event (high priority first) or marks the worker task as sleeping.
 * @param out_ev Destination event struct populated on success.
 * @return true if an event was popped, false if both rings are empty.
 */
HOT_PATH FORCE_INLINE bool pop_event(lwip_event_packet_t &out_ev) {
    portENTER_CRITICAL(&s_ring.mux);
    if (UNLIKELY(s_ring.high_head != s_ring.high_tail)) {
        xtensa_asm::asm_copy_words(
            reinterpret_cast<uint32_t *>(&out_ev),
            reinterpret_cast<const uint32_t *>(&s_ring.high_ring[s_ring.high_tail & kHighRingMask]),
            kPacketWords
        );
        s_ring.high_tail++;
        portEXIT_CRITICAL(&s_ring.mux);
        return true;
    }
    if (LIKELY(s_ring.norm_head != s_ring.norm_tail)) {
        xtensa_asm::asm_copy_words(
            reinterpret_cast<uint32_t *>(&out_ev),
            reinterpret_cast<const uint32_t *>(&s_ring.norm_ring[s_ring.norm_tail & kNormRingMask]),
            kPacketWords
        );
        s_ring.norm_tail++;
        portEXIT_CRITICAL(&s_ring.mux);
        return true;
    }
    s_ring.task_sleeping = true;
    portEXIT_CRITICAL(&s_ring.mux);
    return false;
}

/**
 * @brief Invalidates all queued events belonging to a closing AsyncClient in O(active_queue_len) time.
 * @param arg Client pointer to match against queued events.
 * @param service_task Worker task handle to wake if invalidated RECV pbufs need freeing.
 * @note Sets arg=nullptr inside the spinlock so pbuf_free() happens safely in worker context.
 */
inline void clear_events_for_arg(void *arg, TaskHandle_t service_task) {
    if (UNLIKELY(arg == nullptr || s_ring.norm_ring == nullptr)) {
        return;
    }
    bool wake_for_pbuf = false;

    portENTER_CRITICAL(&s_ring.mux);
    for (uint32_t i = s_ring.high_tail; i != s_ring.high_head; ++i) {
        lwip_event_packet_t &pkt = s_ring.high_ring[i & kHighRingMask];
        if (pkt.arg == arg) {
            pkt.arg = nullptr;
        }
    }
    for (uint32_t i = s_ring.norm_tail; i != s_ring.norm_head; ++i) {
        lwip_event_packet_t &pkt = s_ring.norm_ring[i & kNormRingMask];
        if (pkt.arg == arg) {
            pkt.arg = nullptr;
            if (pkt.event == LWIP_TCP_RECV && pkt.recv.pb != nullptr && s_ring.task_sleeping) {
                s_ring.task_sleeping = false;
                wake_for_pbuf = true;
            }
        }
    }
    portEXIT_CRITICAL(&s_ring.mux);

    if (wake_for_pbuf && service_task != nullptr) {
        xTaskNotifyGive(service_task);
    }
}

} // namespace asynctcp_detail
} // namespace uniuno

