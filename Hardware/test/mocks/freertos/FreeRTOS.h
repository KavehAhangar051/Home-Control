#pragma once
#include <cstdint>

using BaseType_t = int;
using UBaseType_t = unsigned int;
using TickType_t = uint32_t;
using SemaphoreHandle_t = void*;
using TaskHandle_t = void*;

struct portMUX_TYPE {
    int lock = 0;
};
#define portMUX_INITIALIZER_UNLOCKED {0}
#define portMAX_DELAY 0xFFFFFFFFUL
#define pdMS_TO_TICKS(ms) (ms)
#define pdTRUE 1
#define pdPASS 1
#define pdFALSE 0
#define portENTER_CRITICAL(mux) do { (void)(mux); } while (0)
#define portEXIT_CRITICAL(mux) do { (void)(mux); } while (0)
#define vTaskDelay(ticks) do { (void)(ticks); } while (0)
#define vTaskDelete(h) do { (void)(h); } while (0)
#define xTaskCreatePinnedToCore(fn, name, stack, param, prio, handle, core) 1
