#pragma once
#include <cstdint>

using esp_timer_handle_t = void*;
using esp_err_t = int;

#ifndef ESP_OK
#define ESP_OK 0
#endif

enum esp_timer_dispatch_t {
    ESP_TIMER_TASK = 0,
    ESP_TIMER_ISR = 1
};

struct esp_timer_create_args_t {
    void (*callback)(void* arg);
    void* arg;
    esp_timer_dispatch_t dispatch_method;
    const char* name;
    bool skip_unhandled_events;
};

inline esp_err_t esp_timer_create(const esp_timer_create_args_t*, esp_timer_handle_t* out) {
    static int dummy = 1;
    if (out) *out = &dummy;
    return ESP_OK;
}
inline esp_err_t esp_timer_start_periodic(esp_timer_handle_t, uint64_t) { return ESP_OK; }
inline esp_err_t esp_timer_stop(esp_timer_handle_t) { return ESP_OK; }
inline esp_err_t esp_timer_delete(esp_timer_handle_t) { return ESP_OK; }
