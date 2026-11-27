/**
 * @file ProjectConfig.h
 * @brief Single Source of Truth for Achaemenid IoT Node compile-time flags and tokens.
 *
 * Edit any repeated or project-wide setting in this single header instead of hunting across
 * multiple source files. Every token is a zero-overhead compile-time macro (0 extra RAM, Flash,
 * or CPU cycles) guarded by #ifndef, so you can also override any value via `-D ACHAEMENID_...=...`
 * in `platformio.ini` build_flags.
 */

#ifndef ACHAEMENID_PROJECT_CONFIG_H
#define ACHAEMENID_PROJECT_CONFIG_H

// ============================================================================
// 1. FEATURE FLAGS (0 overhead when disabled)
// ============================================================================

/// Compile and link ESP_NOW runtime (keep 0 when unused to save Flash & DRAM)
#ifndef ACHAEMENID_ENABLE_ESP_NOW
#define ACHAEMENID_ENABLE_ESP_NOW 0
#endif

/// Use hardware-accelerated mbedtls_sha1 for WebSocket handshake on ESP32
#ifndef ACHAEMENID_ENABLE_HW_SHA1
#define ACHAEMENID_ENABLE_HW_SHA1 1
#endif

/// Optional Timer library extensions (enable only if needed to save DRAM/Flash)
#ifndef ACHAEMENID_ENABLE_TIMER_IMMEDIATE
#define ACHAEMENID_ENABLE_TIMER_IMMEDIATE 0
#endif

#ifndef ACHAEMENID_ENABLE_TIMER_INTERVAL_UNTIL
#define ACHAEMENID_ENABLE_TIMER_INTERVAL_UNTIL 0
#endif

#ifndef ACHAEMENID_ENABLE_TIMER_GROUPS
#define ACHAEMENID_ENABLE_TIMER_GROUPS 0
#endif

// ============================================================================
// 2. LOGGING & DIAGNOSTICS TOKENS
// ============================================================================

/// Default log level: 0=TRACE, 100=DEBUG, 200=INFO, 300=WARNING, 400=ERROR, 999=OFF
#ifndef ACHAEMENID_LOG_LEVEL
#define ACHAEMENID_LOG_LEVEL 200
#endif

/// Include __FILE__:__LINE__ in logs (set to 0 to strip file path strings from Flash)
#ifndef ACHAEMENID_LOG_INCLUDE_FILE_LINE
#define ACHAEMENID_LOG_INCLUDE_FILE_LINE 1
#endif

/// Temporary stack buffer size for formatting a single log line (only allocated during log calls)
#ifndef ACHAEMENID_LOG_LINE_BUF_SIZE
#define ACHAEMENID_LOG_LINE_BUF_SIZE 256
#endif

/// Serial baud rate and initial boot stabilization delay
#ifndef ACHAEMENID_SERIAL_BAUD
#define ACHAEMENID_SERIAL_BAUD 115200
#endif

#ifndef ACHAEMENID_BOOT_DELAY_MS
#define ACHAEMENID_BOOT_DELAY_MS 1000
#endif

/// Throttle window (ms) for repetitive HTTP / MQTT error log messages
#ifndef ACHAEMENID_ERROR_THROTTLE_MS
#define ACHAEMENID_ERROR_THROTTLE_MS 5000
#endif

// ============================================================================
// 3. NETWORK, CLOUD WEBSOCKET, MQTT & CAPTIVE PORTAL TOKENS
// ============================================================================

/// Default cloud WebSocket (WSS) endpoint URL
#ifndef ACHAEMENID_DEFAULT_WS_URL
#define ACHAEMENID_DEFAULT_WS_URL "wss://db.home-control.enddev.ir/ws"
#endif

/// Fallback MQTT settings (used only when NVS has no stored broker configuration)
#ifndef ACHAEMENID_FALLBACK_MQTT_HOST
#define ACHAEMENID_FALLBACK_MQTT_HOST "broker.emqx.io"
#endif

#ifndef ACHAEMENID_FALLBACK_MQTT_PORT
#define ACHAEMENID_FALLBACK_MQTT_PORT 1883
#endif

#ifndef ACHAEMENID_FALLBACK_MQTT_TOPIC
#define ACHAEMENID_FALLBACK_MQTT_TOPIC "KamyarIoT/Achaemenid"
#endif

#ifndef ACHAEMENID_FALLBACK_MQTT_COMMAND_SUFFIX
#define ACHAEMENID_FALLBACK_MQTT_COMMAND_SUFFIX "/Command"
#endif

#ifndef ACHAEMENID_FALLBACK_MQTT_QOS
#define ACHAEMENID_FALLBACK_MQTT_QOS 1
#endif

#ifndef ACHAEMENID_FALLBACK_MQTT_USER
#define ACHAEMENID_FALLBACK_MQTT_USER ""
#endif

#ifndef ACHAEMENID_FALLBACK_MQTT_PASS
#define ACHAEMENID_FALLBACK_MQTT_PASS ""
#endif

/// Captive Portal and mDNS defaults
#ifndef ACHAEMENID_MDNS_HOSTNAME
#define ACHAEMENID_MDNS_HOSTNAME "achaemenid"
#endif

#ifndef ACHAEMENID_AP_IP
#define ACHAEMENID_AP_IP "192.168.4.1"
#endif

#ifndef ACHAEMENID_DNS_PORT
#define ACHAEMENID_DNS_PORT 53
#endif

#ifndef ACHAEMENID_DNS_TTL_SECONDS
#define ACHAEMENID_DNS_TTL_SECONDS 60
#endif

#ifndef ACHAEMENID_PROVISIONING_IDLE_RETRY_MS
#define ACHAEMENID_PROVISIONING_IDLE_RETRY_MS 180000UL
#endif

/// Maximum number of saved Wi-Fi networks stored in NVS
#ifndef ACHAEMENID_MAX_SAVED_WIFI_NETWORKS
#define ACHAEMENID_MAX_SAVED_WIFI_NETWORKS 5
#endif

// ============================================================================
// 4. WATCHDOG, OTA, TIMER & HOT-PATH LOOP TIMING TOKENS
// ============================================================================

/// Task Watchdog timeout (seconds) and OTA rollback confirmation delay (ms)
#ifndef ACHAEMENID_WDT_TIMEOUT_SEC
#define ACHAEMENID_WDT_TIMEOUT_SEC 15
#endif

#ifndef ACHAEMENID_OTA_CONFIRM_DELAY_MS
#define ACHAEMENID_OTA_CONFIRM_DELAY_MS 30000UL
#endif

/// Hardware timer resolution (microseconds)
#ifndef ACHAEMENID_HW_TIMER_RESOLUTION_US
#define ACHAEMENID_HW_TIMER_RESOLUTION_US 1000
#endif

/// Hot-path CCOUNT intervals in loop() for WebSocket polling and Watchdog feeding (ms)
#ifndef ACHAEMENID_WS_POLL_INTERVAL_MS
#define ACHAEMENID_WS_POLL_INTERVAL_MS 1
#endif

#ifndef ACHAEMENID_WDT_FEED_INTERVAL_MS
#define ACHAEMENID_WDT_FEED_INTERVAL_MS 500
#endif

/// Digital input switch mechanical debounce threshold (ms)
#ifndef ACHAEMENID_DEBOUNCE_THRESHOLD_MS
#define ACHAEMENID_DEBOUNCE_THRESHOLD_MS 35UL
#endif

// ============================================================================
// 5. RTOS TASK STACK SIZES
// ============================================================================

#ifndef ACHAEMENID_LOOP_TASK_STACK_SIZE
#define ACHAEMENID_LOOP_TASK_STACK_SIZE 10240
#endif

#ifndef ACHAEMENID_ASYNC_TCP_STACK_SIZE
#define ACHAEMENID_ASYNC_TCP_STACK_SIZE 8192
#endif

// ============================================================================
// 6. MEMORY, CAPACITY & SBO BUDGET TOKENS
// ============================================================================

/// FastFunction inline SBO buffer (16B on ESP32 => 32B total = 1 L1 cache line, zero heap)
#ifndef ACHAEMENID_CALLBACK_SBO_BYTES
#define ACHAEMENID_CALLBACK_SBO_BYTES 16
#endif

/// Inline capacity for AsyncMqttClient user callback vectors
#ifndef ACHAEMENID_MQTT_USER_CB_INLINE_CAP
#define ACHAEMENID_MQTT_USER_CB_INLINE_CAP 1
#endif

/// Maximum concurrent tasks in the async Executor (1-cycle Xtensa bitmask)
#ifndef ACHAEMENID_EXECUTOR_MAX_TASKS
#define ACHAEMENID_EXECUTOR_MAX_TASKS 8
#endif

/// EventBus capacity (max distinct event types and max listeners per event)
#ifndef ACHAEMENID_EVENT_BUS_MAX_EVENTS
#define ACHAEMENID_EVENT_BUS_MAX_EVENTS 20
#endif

#ifndef ACHAEMENID_EVENT_BUS_MAX_LISTENERS
#define ACHAEMENID_EVENT_BUS_MAX_LISTENERS 4
#endif

/// Max concurrent analog input slots in PinStateManager (ESP32 has 6 Wi-Fi-safe ADC1 channels)
#ifndef ACHAEMENID_MAX_ANALOG_SLOTS
#define ACHAEMENID_MAX_ANALOG_SLOTS 8
#endif

/// Temporary JSON buffer size for full State Sync export
#ifndef ACHAEMENID_STATE_SYNC_BUF_SIZE
#define ACHAEMENID_STATE_SYNC_BUF_SIZE 3072
#endif

/// ErrorHandler internal fixed capacities
#ifndef ACHAEMENID_ERROR_HISTORY_SIZE
#define ACHAEMENID_ERROR_HISTORY_SIZE 4
#endif

#ifndef ACHAEMENID_ERROR_CONTEXT_DEPTH
#define ACHAEMENID_ERROR_CONTEXT_DEPTH 6
#endif

#ifndef ACHAEMENID_ERROR_MAP_CAPACITY
#define ACHAEMENID_ERROR_MAP_CAPACITY 8
#endif

// ============================================================================
// 7. DUAL-CORE CONCURRENCY & OBJECT POOLING TOKENS
// ============================================================================

/// FreeRTOS core affinity for AsyncTCP (MQTT TCP I/O) and WebSocket TLS connect task.
/// Core 0 (PRO_CPU) hosts Wi-Fi + LwIP + MQTT/TLS I/O while Core 1 (APP_CPU) runs real-time loop().
#ifndef ACHAEMENID_ASYNC_TCP_CORE
#define ACHAEMENID_ASYNC_TCP_CORE 0
#endif

#ifndef ACHAEMENID_WS_CONNECT_CORE
#define ACHAEMENID_WS_CONNECT_CORE 0
#endif

/// Enable lock-free Core 0 -> Core 1 SPSC command queue in AchaemenidMQTT on ESP32
#ifndef ACHAEMENID_MQTT_DUAL_CORE_QUEUE
#ifdef ESP32
#define ACHAEMENID_MQTT_DUAL_CORE_QUEUE 1
#else
#define ACHAEMENID_MQTT_DUAL_CORE_QUEUE 0
#endif
#endif

/// Power-of-2 byte capacity for the lock-free Core 0 -> Core 1 MQTT command ring buffer
#ifndef ACHAEMENID_MQTT_RX_RING_BYTES
#define ACHAEMENID_MQTT_RX_RING_BYTES 2048
#endif

/// Pre-allocated StaticObjectPool slot count for SegmentUpdateRuleRequestEvent (~724 B/slot)
#ifndef ACHAEMENID_RULE_EVENT_POOL_SLOTS
#define ACHAEMENID_RULE_EVENT_POOL_SLOTS 1
#endif

#endif // ACHAEMENID_PROJECT_CONFIG_H
