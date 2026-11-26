# High-Performance Custom AsyncTCP (ESP32)

Ultra-optimized, zero-heap asynchronous TCP library for Espressif ESP32 dual-core microcontrollers, engineered across 5 specialized optimization phases.

---

## 🚀 5-Stage Hot-Path Optimization Architecture (Pass 2 Deepening)

### 1. Zero-Heap Two-Priority DRAM Event Ring & TaskNotify ([`AsyncEventRing.h`](AsyncEventRing.h))
- Replaced the dual overhead of `s_event_packet_pool`/`s_pool_stack` + FreeRTOS `xQueueSend`/`xQueueReceive` with a bounded power-of-2 DRAM ring buffer pair (`kNormRingCap = 256`, `kHighRingCap = 32`) in `MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT`.
- Added **sleeping-state coalesced wakeups** (`xTaskNotifyGive` / `ulTaskNotifyTake`): producer callbacks on Core 0 only notify `async_tcp` when it is asleep; during packet bursts, zero FreeRTOS kernel wakeup calls occur.
- Added **Batch Drain loop** inside `_async_service_task` to drain all ready queued packets continuously before sleeping.
- Fixed null-pointer crash risks on extreme queue bursts (`ERR_MEM` returned cleanly to LwIP `_tcp_recv` so `refused_data` retains the `pbuf` without dropping/leaking data) and fixed `pbuf` leaks during `clear_events_for_arg()`.

### 2. Coalesced Non-Blocking RX Window ACK (`_tcp_recved` without `sys_sem` allocation)
- Because Arduino-ESP32 `sdkconfig.h` compiles `liblwip.a` with `LWIP_NETCONN_SEM_PER_THREAD = 0` and `LWIP_TCPIP_CORE_LOCKING = 0`, every `tcpip_api_call` allocates and deletes a FreeRTOS semaphore inside LwIP and blocks Core 1.
- Added `AsyncSlotEntry s_slots[CONFIG_LWIP_MAX_ACTIVE_TCP]` tracking generation IDs, active `pcb`, and `pending_recved` bytes; `_tcp_recved` coalesces multiple RX ACKs and schedules a single non-blocking `tcpip_try_callback` (`_tcp_recved_async_cb`), allocating closed slots on both outgoing `_connect()` and incoming server `_accept()`.
- Fixed `ackPacket()` to use `pb->tot_len` for multi-segment `pbuf` chains.

### 3. Division-Free Hot-Path Timestamps & Single-Shot Loop Timing ([`AsyncTcpAsm.h`](AsyncTcpAsm.h))
- Replaced `millis()` (which performs 64-bit software division `__udivdi3` on Xtensa LX6) in RX/TX/write/send/poll hot paths with `fast_millis()` reading `xTaskGetTickCount()` directly (`CONFIG_FREERTOS_HZ == 1000`).
- Moved timestamp capture out of the inner chained-`pbuf` loop in `AsyncClient::_recv`.

### 4. Low-Level Xtensa LX6 ASM & Cache-Line Packing ([`AsyncTcpAsm.h`](AsyncTcpAsm.h), [`AsyncTCP.h`](AsyncTCP.h))
- Added 4-byte aligned `asm_strlen()` (Mycroft zero-byte word detection) for `AsyncClient::write(const char*)` alongside `asm_min()` (`movltz`), `asm_in_range()`, and `uniuno::xtensa_asm::asm_copy_words` (`loopnez`) for 32-byte event ring transfers.
- Packed `AsyncClient` hot scalar fields (`_pcb`, `_closed_slot`, `_ack_pcb`, `_tx_last_packet`, `_rx_ack_len`, `_rx_last_packet`, `_rx_timeout`, `_rx_last_ack`, `_ack_timeout`) into the first 32-byte cache line ahead of cold callbacks.

### 5. Hot-Path Inlining (`AsyncTCP.h`) & Build Verification
- Removed unused `<functional>` header and moved hot queries (`canSend()`, `space()`, `state()`, `connected()`, `freeable()`, `hasPollInterest()`, `getMss()`) to `FORCE_INLINE` definitions inside `AsyncTCP.h` (requires `#include "lwip/tcp.h"`).
- **Verified Build (`esp32dev`, PlatformIO):** `[SUCCESS]` — zero warnings in `AsyncTCP` files; `RAM: 36.3% (119,028 B)`, `Flash: 62.2% (1,223,597 B)`. Note: runtime on physical ESP32 hardware was not executed here.

---

## 📦 How to Port to Another Project

1. Copy the folder `Hardware/include/AsyncTCP/` into your target project's `include/` directory.
2. In `platformio.ini`, add:
   ```ini
   build_flags = -I include/AsyncTCP
   lib_ignore = ESPAsyncTCP, AsyncTCP-esphome
   ```
3. Add a compilation bridge in your source tree (e.g. `src/AsyncTCP_impl.cpp`):
   ```cpp
   #include <AsyncTCP.cpp>
   ```

