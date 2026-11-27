#pragma once

#include <ProjectConfig.h>
#include <Optimization/StaticString.h>
#include <Optimization/FastFunction.h>
#include <Arduino.h>

namespace uniuno {

// Owns the callable while keeping the small state-provider lambda inline.
using StateProvider = FastFunction<String(), 16>;

// Cloudflare Workers close idle connections after ~100s.
// Send a ping every 45s to keep the connection alive.
static constexpr unsigned long WS_PING_INTERVAL_MS = 45000UL;
static constexpr unsigned long WS_RETRY_DELAY_MS = 5000UL;
static constexpr uint8_t WS_MAX_FAST_RETRIES = 5;
static constexpr unsigned long WS_RETRY_DELAY_AFTER_MAX_FAILURES_MS = 60000UL;
static constexpr unsigned long WS_NO_NETWORK_DELAY_MS = 1000UL;

// Adaptive Polling Intervals (Eliminates continuous unthrottled socket queries and yield())
static constexpr unsigned long WS_CLIENT_POLL_INTERVAL_MS = 15UL;   // 15ms (~66 Hz) for cloud socket
static constexpr unsigned long WS_SERVER_ACCEPT_INTERVAL_MS = 50UL; // 50ms (~20 Hz) for server accept
static constexpr unsigned long WS_SERVER_POLL_INTERVAL_MS = 15UL;   // 15ms (~66 Hz) for client poll

// FreeRTOS task parameters
static constexpr uint32_t WS_CONNECT_TASK_STACK = 8192;
static constexpr UBaseType_t WS_CONNECT_TASK_PRIO = 1;
static constexpr BaseType_t WS_CONNECT_TASK_CORE = ACHAEMENID_WS_CONNECT_CORE; // Core 0 — away from Arduino loop

/**
 * @brief WebSocket Configuration container using stack/bss-friendly StaticString.
 */
struct WebSocketConfig {
  uniuno::StaticString<128> serverUrl;

  bool isValid() const { return !serverUrl.empty(); }
};

} // namespace uniuno
