#pragma once
#include "FreeRTOS.h"

inline SemaphoreHandle_t xSemaphoreCreateMutex() {
    static int dummy = 1;
    return &dummy;
}
inline BaseType_t xSemaphoreTake(SemaphoreHandle_t, TickType_t) { return pdTRUE; }
inline BaseType_t xSemaphoreGive(SemaphoreHandle_t) { return pdTRUE; }
inline void vSemaphoreDelete(SemaphoreHandle_t) {}
