/*
  Asynchronous TCP library for Espressif MCUs

  Copyright (c) 2016 Hristo Gochkov. All rights reserved.
  This file is part of the esp8266 core for Arduino environment.

  This library is free software; you can redistribute it and/or
  modify it under the terms of the GNU Lesser General Public
  License as published by the Free Software Foundation; either
  version 2.1 of the License, or (at your option) any later version.

  This library is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
  Lesser General Public License for more details.

  You should have received a copy of the GNU Lesser General Public
  License along with this library; if not, write to the Free Software
  Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 */

#include "Arduino.h"

#include "AsyncTCP.h"
#include <Optimization/CompilerTraits.h>
#include "AsyncTcpAsm.h" // IWYU pragma: keep
#include "AsyncEventRing.h"
#include <Optimization/XtensaMemAsm.h>
#include <Timer/Optimization/TimerAsm.h>

extern "C" {
#include "lwip/opt.h"
#include "lwip/tcp.h"
#include "lwip/inet.h"
#include "lwip/dns.h"
#include "lwip/err.h"
}
#if CONFIG_ASYNC_TCP_USE_WDT
#include "esp_task_wdt.h"
#endif

/*
 * TCP/IP Event Task
 * */

static TaskHandle_t _async_service_task_handle = NULL;

// ============================================================================
// SLOT TABLE & COALESCED NON-BLOCKING RX WINDOW ACK
// Eliminates per-packet LwIP sys_sem_new/free inside tcp_recved IPC calls.
// ============================================================================
struct AsyncSlotEntry {
  volatile uint32_t closed_gen; // 0 = active socket, >0 = closed generation
  tcp_pcb* volatile pcb;        // Bound PCB pointer guarded by s_slots_mux
  uint32_t pending_recved;      // Accumulated RX bytes pending tcp_recved
  bool ack_scheduled;           // True while async callback is queued in LwIP mbox
};

static portMUX_TYPE s_slots_mux = portMUX_INITIALIZER_UNLOCKED;
const int _number_of_closed_slots = CONFIG_LWIP_MAX_ACTIVE_TCP;
static AsyncSlotEntry s_slots[_number_of_closed_slots];
static uint32_t _closed_index = []() {
  for (int i = 0; i < _number_of_closed_slots; ++i) {
    s_slots[i].closed_gen = 1U;
    s_slots[i].pcb = nullptr;
    s_slots[i].pending_recved = 0U;
    s_slots[i].ack_scheduled = false;
  }
  return 1U;
}();

static inline bool _init_async_event_queue() {
  return uniuno::asynctcp_detail::init_event_rings();
}

HOT_PATH static void _handle_async_event(const lwip_event_packet_t* e) {
  if (UNLIKELY(e->arg == NULL)) {
    if (e->event == LWIP_TCP_RECV && e->recv.pb != nullptr) {
      pbuf_free(e->recv.pb);
    }
    return;
  }
  if (LIKELY(e->event == LWIP_TCP_RECV)) {
    AsyncClient::_s_recv(e->arg, e->recv.pcb, e->recv.pb, e->recv.err);
  } else if (LIKELY(e->event == LWIP_TCP_SENT)) {
    AsyncClient::_s_sent(e->arg, e->sent.pcb, e->sent.len);
  } else {
    switch (e->event) {
    case LWIP_TCP_POLL:
      AsyncClient::_s_poll(e->arg, e->poll.pcb);
      break;
    case LWIP_TCP_FIN:
      AsyncClient::_s_fin(e->arg, e->fin.pcb, e->fin.err);
      break;
    case LWIP_TCP_ERROR:
      AsyncClient::_s_error(e->arg, e->error.err);
      break;
    case LWIP_TCP_CONNECTED:
      AsyncClient::_s_connected(e->arg, e->connected.pcb, e->connected.err);
      break;
    case LWIP_TCP_ACCEPT:
      AsyncServer::_s_accepted(e->arg, e->accept.client);
      break;
    case LWIP_TCP_DNS:
      AsyncClient::_s_dns_found(e->dns.name, const_cast<ip_addr_t*>(&e->dns.addr), e->arg);
      break;
    default:
      break;
    }
  }
}

HOT_PATH static void _async_service_task(void* pvParameters) {
  lwip_event_packet_t packet;
#if CONFIG_ASYNC_TCP_USE_WDT
  if (esp_task_wdt_add(NULL) != ESP_OK) {
    log_e("Failed to add async task to WDT");
  }
  uint32_t batch_cnt = 0U;
#endif
  for (;;) {
    // Batch-drain all pending events before sleeping or touching WDT
    if (LIKELY(uniuno::asynctcp_detail::pop_event(packet))) {
      _handle_async_event(&packet);
#if CONFIG_ASYNC_TCP_USE_WDT
      if (UNLIKELY((++batch_cnt & 63U) == 0U)) {
        esp_task_wdt_reset();
      }
#endif
      continue;
    }
    ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(1000));
#if CONFIG_ASYNC_TCP_USE_WDT
    batch_cnt = 0U;
    esp_task_wdt_reset();
#endif
  }
#if CONFIG_ASYNC_TCP_USE_WDT
  esp_task_wdt_delete(NULL);
#endif
  vTaskDelete(NULL);
  _async_service_task_handle = NULL;
}
/*
static void _stop_async_task(){
    if(_async_service_task_handle){
        vTaskDelete(_async_service_task_handle);
        _async_service_task_handle = NULL;
    }
}
*/

static bool customTaskCreateUniversal(TaskFunction_t pxTaskCode, const char* const pcName, const uint32_t usStackDepth,
                                      void* const pvParameters, UBaseType_t uxPriority,
                                      TaskHandle_t* const pxCreatedTask, const BaseType_t xCoreID) {
#ifndef CONFIG_FREERTOS_UNICORE
  if (xCoreID >= 0 && xCoreID < 2) {
    return xTaskCreatePinnedToCore(pxTaskCode, pcName, usStackDepth, pvParameters, uxPriority, pxCreatedTask, xCoreID);
  } else {
#endif
    return xTaskCreate(pxTaskCode, pcName, usStackDepth, pvParameters, uxPriority, pxCreatedTask);
#ifndef CONFIG_FREERTOS_UNICORE
  }
#endif
}

static bool _start_async_task() {
  if (!_init_async_event_queue()) {
    return false;
  }
  if (!_async_service_task_handle) {
    customTaskCreateUniversal(_async_service_task, "async_tcp", CONFIG_ASYNC_TCP_STACK_SIZE, NULL, 3,
                              &_async_service_task_handle, CONFIG_ASYNC_TCP_RUNNING_CORE);
    if (!_async_service_task_handle) {
      return false;
    }
  }
  return true;
}

/*
 * LwIP Callbacks
 * */

static inline int8_t _tcp_clear_events(void* arg) {
  uniuno::asynctcp_detail::clear_events_for_arg(arg, _async_service_task_handle);
  return ERR_OK;
}

static int8_t _tcp_connected(void* arg, tcp_pcb* pcb, int8_t err) {
  lwip_event_packet_t e;
  e.event = LWIP_TCP_CONNECTED;
  e.arg = arg;
  e.connected.pcb = pcb;
  e.connected.err = err;
  uniuno::asynctcp_detail::push_event(e, true, _async_service_task_handle);
  return ERR_OK;
}

HOT_PATH static int8_t _tcp_poll(void* arg, struct tcp_pcb* pcb) {
  AsyncClient* client = reinterpret_cast<AsyncClient*>(arg);
  if (UNLIKELY(!client || client->pcb() != pcb)) {
    return ERR_OK;
  }
  if (!client->hasPollInterest()) {
    return ERR_OK;
  }
  lwip_event_packet_t e;
  e.event = LWIP_TCP_POLL;
  e.arg = arg;
  e.poll.pcb = pcb;
  uniuno::asynctcp_detail::push_event(e, false, _async_service_task_handle);
  return ERR_OK;
}

HOT_PATH static int8_t _tcp_recv(void* arg, struct tcp_pcb* pcb, struct pbuf* pb, int8_t err) {
  lwip_event_packet_t e;
  e.arg = arg;
  if (LIKELY(pb != NULL)) {
    e.event = LWIP_TCP_RECV;
    e.recv.pcb = pcb;
    e.recv.pb = pb;
    e.recv.err = err;
    if (UNLIKELY(!uniuno::asynctcp_detail::push_event(e, false, _async_service_task_handle))) {
      // Return ERR_MEM so LwIP retains pbuf in refused_data instead of leaking/dropping
      return ERR_MEM;
    }
  } else {
    e.event = LWIP_TCP_FIN;
    e.fin.pcb = pcb;
    e.fin.err = err;
    AsyncClient::_s_lwip_fin(e.arg, e.fin.pcb, e.fin.err);
    uniuno::asynctcp_detail::push_event(e, false, _async_service_task_handle);
  }
  return ERR_OK;
}

HOT_PATH static int8_t _tcp_sent(void* arg, struct tcp_pcb* pcb, uint16_t len) {
  lwip_event_packet_t e;
  e.event = LWIP_TCP_SENT;
  e.arg = arg;
  e.sent.pcb = pcb;
  e.sent.len = len;
  uniuno::asynctcp_detail::push_event(e, false, _async_service_task_handle);
  return ERR_OK;
}

static void _tcp_error(void* arg, int8_t err) {
  lwip_event_packet_t e;
  e.event = LWIP_TCP_ERROR;
  e.arg = arg;
  e.error.err = err;
  uniuno::asynctcp_detail::push_event(e, false, _async_service_task_handle);
}

static void _tcp_dns_found(const char* name, struct ip_addr* ipaddr, void* arg) {
  lwip_event_packet_t e;
  e.event = LWIP_TCP_DNS;
  e.arg = arg;
  e.dns.name = name;
  if (LIKELY(ipaddr != nullptr)) {
    uniuno::xtensa_asm::asm_copy_words(reinterpret_cast<uint32_t*>(&e.dns.addr),
                                       reinterpret_cast<const uint32_t*>(ipaddr),
                                       sizeof(struct ip_addr) / sizeof(uint32_t));
  } else {
    uniuno::xtensa_asm::asm_zero_words(reinterpret_cast<uint32_t*>(&e.dns.addr), sizeof(e.dns.addr) / sizeof(uint32_t));
  }
  uniuno::asynctcp_detail::push_event(e, false, _async_service_task_handle);
}

// Used to switch out from LwIP thread
static int8_t _tcp_accept(void* arg, AsyncClient* client) {
  lwip_event_packet_t e;
  e.event = LWIP_TCP_ACCEPT;
  e.arg = arg;
  e.accept.client = client;
  uniuno::asynctcp_detail::push_event(e, true, _async_service_task_handle);
  return ERR_OK;
}

/*
 * TCP/IP API Calls
 * */

#include "lwip/priv/tcpip_priv.h"

typedef struct {
  struct tcpip_api_call_data call;
  tcp_pcb* pcb;
  int8_t closed_slot;
  int8_t err;
  union {
    struct {
      const char* data;
      size_t size;
      uint8_t apiflags;
    } write;
    size_t received;
    struct {
      ip_addr_t* addr;
      uint16_t port;
      tcp_connected_fn cb;
    } connect;
    struct {
      ip_addr_t* addr;
      uint16_t port;
    } bind;
    uint8_t backlog;
  };
} tcp_api_call_t;

static err_t _tcp_output_api(struct tcpip_api_call_data* api_call_msg) {
  tcp_api_call_t* msg = (tcp_api_call_t*)api_call_msg;
  msg->err = ERR_CONN;
  if (msg->closed_slot == -1 || s_slots[msg->closed_slot].closed_gen == 0U) {
    msg->err = tcp_output(msg->pcb);
  }
  return msg->err;
}

static esp_err_t _tcp_output(tcp_pcb* pcb, int8_t closed_slot) {
  if (!pcb) {
    return ERR_CONN;
  }
  tcp_api_call_t msg;
  msg.pcb = pcb;
  msg.closed_slot = closed_slot;
  tcpip_api_call(_tcp_output_api, (struct tcpip_api_call_data*)&msg);
  return msg.err;
}

static err_t _tcp_write_api(struct tcpip_api_call_data* api_call_msg) {
  tcp_api_call_t* msg = (tcp_api_call_t*)api_call_msg;
  msg->err = ERR_CONN;
  if (msg->closed_slot == -1 || s_slots[msg->closed_slot].closed_gen == 0U) {
    msg->err = tcp_write(msg->pcb, msg->write.data, msg->write.size, msg->write.apiflags);
  }
  return msg->err;
}

static esp_err_t _tcp_write(tcp_pcb* pcb, int8_t closed_slot, const char* data, size_t size, uint8_t apiflags) {
  if (!pcb) {
    return ERR_CONN;
  }
  tcp_api_call_t msg;
  msg.pcb = pcb;
  msg.closed_slot = closed_slot;
  msg.write.data = data;
  msg.write.size = size;
  msg.write.apiflags = apiflags;
  tcpip_api_call(_tcp_write_api, (struct tcpip_api_call_data*)&msg);
  return msg.err;
}

// Combined Atomic Write & Output API (Cuts 50% of IPC round-trips)
static err_t _tcp_write_and_output_api(struct tcpip_api_call_data* api_call_msg) {
  tcp_api_call_t* msg = (tcp_api_call_t*)api_call_msg;
  msg->err = ERR_CONN;
  if (msg->closed_slot == -1 || s_slots[msg->closed_slot].closed_gen == 0U) {
    msg->err = tcp_write(msg->pcb, msg->write.data, msg->write.size, msg->write.apiflags);
    if (LIKELY(msg->err == ERR_OK)) {
      msg->err = tcp_output(msg->pcb);
    }
  }
  return msg->err;
}

static esp_err_t _tcp_write_and_output(tcp_pcb* pcb, int8_t closed_slot, const char* data, size_t size,
                                       uint8_t apiflags) {
  if (UNLIKELY(!pcb)) {
    return ERR_CONN;
  }
  tcp_api_call_t msg;
  msg.pcb = pcb;
  msg.closed_slot = closed_slot;
  msg.write.data = data;
  msg.write.size = size;
  msg.write.apiflags = apiflags;
  tcpip_api_call(_tcp_write_and_output_api, (struct tcpip_api_call_data*)&msg);
  return msg.err;
}

static void _tcp_recved_async_cb(void* ctx) {
  AsyncSlotEntry* slot = reinterpret_cast<AsyncSlotEntry*>(ctx);
  portENTER_CRITICAL(&s_slots_mux);
  slot->ack_scheduled = false;
  if (UNLIKELY(slot->closed_gen != 0U || slot->pcb == nullptr || slot->pending_recved == 0U)) {
    slot->pending_recved = 0U;
    portEXIT_CRITICAL(&s_slots_mux);
    return;
  }
  tcp_pcb* pcb = slot->pcb;
  uint32_t bytes = slot->pending_recved;
  slot->pending_recved = 0U;
  portEXIT_CRITICAL(&s_slots_mux);

  while (bytes > 0U) {
    const uint16_t chunk = (bytes > 0xFFFFU) ? 0xFFFFU : static_cast<uint16_t>(bytes);
    tcp_recved(pcb, chunk);
    bytes -= chunk;
  }
}

static err_t _tcp_recved_api(struct tcpip_api_call_data* api_call_msg) {
  tcp_api_call_t* msg = (tcp_api_call_t*)api_call_msg;
  msg->err = ERR_CONN;
  if (msg->closed_slot == -1 || s_slots[msg->closed_slot].closed_gen == 0U) {
    msg->err = 0;
    tcp_recved(msg->pcb, msg->received);
  }
  return msg->err;
}

/**
 * @brief Coalesced non-blocking RX window acknowledgment on Core 0 without sys_sem allocation.
 *        Falls back to synchronous tcpip_api_call only when no slot is bound or LwIP mbox is full.
 */
HOT_PATH static esp_err_t _tcp_recved(tcp_pcb* pcb, int8_t closed_slot, size_t len) {
  if (UNLIKELY(!pcb)) {
    return ERR_CONN;
  }
  if (UNLIKELY(len == 0U)) {
    return ERR_OK;
  }
  if (LIKELY(closed_slot >= 0 && closed_slot < _number_of_closed_slots)) {
    AsyncSlotEntry& slot = s_slots[closed_slot];
    portENTER_CRITICAL(&s_slots_mux);
    if (UNLIKELY(slot.closed_gen != 0U || slot.pcb != pcb)) {
      portEXIT_CRITICAL(&s_slots_mux);
      return ERR_CONN;
    }
    slot.pending_recved += static_cast<uint32_t>(len);
    const bool need_schedule = !slot.ack_scheduled;
    if (need_schedule) {
      slot.ack_scheduled = true;
    }
    portEXIT_CRITICAL(&s_slots_mux);

    if (need_schedule) {
      if (UNLIKELY(tcpip_try_callback(_tcp_recved_async_cb, &slot) != ERR_OK)) {
        portENTER_CRITICAL(&s_slots_mux);
        const uint32_t flush_bytes = slot.pending_recved;
        slot.pending_recved = 0U;
        slot.ack_scheduled = false;
        portEXIT_CRITICAL(&s_slots_mux);
        if (flush_bytes > 0U) {
          tcp_api_call_t msg;
          msg.pcb = pcb;
          msg.closed_slot = closed_slot;
          msg.received = flush_bytes;
          tcpip_api_call(_tcp_recved_api, (struct tcpip_api_call_data*)&msg);
          return msg.err;
        }
      }
    }
    return ERR_OK;
  }
  tcp_api_call_t msg;
  msg.pcb = pcb;
  msg.closed_slot = closed_slot;
  msg.received = len;
  tcpip_api_call(_tcp_recved_api, (struct tcpip_api_call_data*)&msg);
  return msg.err;
}

static err_t _tcp_close_api(struct tcpip_api_call_data* api_call_msg) {
  tcp_api_call_t* msg = (tcp_api_call_t*)api_call_msg;
  msg->err = ERR_CONN;
  if (msg->closed_slot == -1 || s_slots[msg->closed_slot].closed_gen == 0U) {
    uint32_t rem = 0U;
    if (msg->closed_slot >= 0 && msg->closed_slot < _number_of_closed_slots) {
      portENTER_CRITICAL(&s_slots_mux);
      if (s_slots[msg->closed_slot].closed_gen == 0U) {
        rem = s_slots[msg->closed_slot].pending_recved;
        s_slots[msg->closed_slot].pending_recved = 0U;
        s_slots[msg->closed_slot].pcb = nullptr;
      }
      portEXIT_CRITICAL(&s_slots_mux);
    }
    while (rem > 0U) {
      const uint16_t chunk = (rem > 0xFFFFU) ? 0xFFFFU : static_cast<uint16_t>(rem);
      tcp_recved(msg->pcb, chunk);
      rem -= chunk;
    }
    msg->err = tcp_close(msg->pcb);
  }
  return msg->err;
}

static esp_err_t _tcp_close(tcp_pcb* pcb, int8_t closed_slot) {
  if (!pcb) {
    return ERR_CONN;
  }
  tcp_api_call_t msg;
  msg.pcb = pcb;
  msg.closed_slot = closed_slot;
  tcpip_api_call(_tcp_close_api, (struct tcpip_api_call_data*)&msg);
  return msg.err;
}

static err_t _tcp_abort_api(struct tcpip_api_call_data* api_call_msg) {
  tcp_api_call_t* msg = (tcp_api_call_t*)api_call_msg;
  msg->err = ERR_CONN;
  if (msg->closed_slot == -1 || s_slots[msg->closed_slot].closed_gen == 0U) {
    if (msg->closed_slot >= 0 && msg->closed_slot < _number_of_closed_slots) {
      portENTER_CRITICAL(&s_slots_mux);
      s_slots[msg->closed_slot].pending_recved = 0U;
      s_slots[msg->closed_slot].pcb = nullptr;
      portEXIT_CRITICAL(&s_slots_mux);
    }
    tcp_abort(msg->pcb);
  }
  return msg->err;
}

static esp_err_t _tcp_abort(tcp_pcb* pcb, int8_t closed_slot) {
  if (!pcb) {
    return ERR_CONN;
  }
  tcp_api_call_t msg;
  msg.pcb = pcb;
  msg.closed_slot = closed_slot;
  tcpip_api_call(_tcp_abort_api, (struct tcpip_api_call_data*)&msg);
  return msg.err;
}

static err_t _tcp_connect_api(struct tcpip_api_call_data* api_call_msg) {
  tcp_api_call_t* msg = (tcp_api_call_t*)api_call_msg;
  msg->err = tcp_connect(msg->pcb, msg->connect.addr, msg->connect.port, msg->connect.cb);
  return msg->err;
}

static esp_err_t _tcp_connect(tcp_pcb* pcb, int8_t closed_slot, ip_addr_t* addr, uint16_t port, tcp_connected_fn cb) {
  if (!pcb) {
    return ESP_FAIL;
  }
  tcp_api_call_t msg;
  msg.pcb = pcb;
  msg.closed_slot = closed_slot;
  msg.connect.addr = addr;
  msg.connect.port = port;
  msg.connect.cb = cb;
  tcpip_api_call(_tcp_connect_api, (struct tcpip_api_call_data*)&msg);
  return msg.err;
}

static err_t _tcp_bind_api(struct tcpip_api_call_data* api_call_msg) {
  tcp_api_call_t* msg = (tcp_api_call_t*)api_call_msg;
  msg->err = tcp_bind(msg->pcb, msg->bind.addr, msg->bind.port);
  return msg->err;
}

static esp_err_t _tcp_bind(tcp_pcb* pcb, ip_addr_t* addr, uint16_t port) {
  if (!pcb) {
    return ESP_FAIL;
  }
  tcp_api_call_t msg;
  msg.pcb = pcb;
  msg.closed_slot = -1;
  msg.bind.addr = addr;
  msg.bind.port = port;
  tcpip_api_call(_tcp_bind_api, (struct tcpip_api_call_data*)&msg);
  return msg.err;
}

static err_t _tcp_listen_api(struct tcpip_api_call_data* api_call_msg) {
  tcp_api_call_t* msg = (tcp_api_call_t*)api_call_msg;
  msg->err = 0;
  msg->pcb = tcp_listen_with_backlog(msg->pcb, msg->backlog);
  return msg->err;
}

static tcp_pcb* _tcp_listen_with_backlog(tcp_pcb* pcb, uint8_t backlog) {
  if (!pcb) {
    return NULL;
  }
  tcp_api_call_t msg;
  msg.pcb = pcb;
  msg.closed_slot = -1;
  msg.backlog = backlog ? backlog : 0xFF;
  tcpip_api_call(_tcp_listen_api, (struct tcpip_api_call_data*)&msg);
  return msg.pcb;
}

/*
  Async TCP Client
 */

AsyncClient::AsyncClient(tcp_pcb* pcb)
    : _pcb(pcb), _closed_slot(-1), _ack_pcb(true), _connect_port(0), _tx_last_packet(0), _rx_ack_len(0),
      _rx_last_packet(0), _rx_timeout(0), _rx_last_ack(0), _ack_timeout(ASYNC_MAX_ACK_TIME), _recv_cb(nullptr),
      _recv_cb_arg(0), _sent_cb(nullptr), _sent_cb_arg(0), _poll_cb(nullptr), _poll_cb_arg(0), _pb_cb(nullptr),
      _pb_cb_arg(0), _connect_cb(nullptr), _connect_cb_arg(0), _discard_cb(nullptr), _discard_cb_arg(0),
      _error_cb(nullptr), _error_cb_arg(0), _timeout_cb(nullptr), _timeout_cb_arg(0), prev(NULL), next(NULL) {
  if (_pcb) {
    _allocate_closed_slot();
    _rx_last_packet = uniuno::asynctcp_asm::fast_millis();
    tcp_arg(_pcb, this);
    tcp_recv(_pcb, &_tcp_recv);
    tcp_sent(_pcb, &_tcp_sent);
    tcp_err(_pcb, &_tcp_error);
    tcp_poll(_pcb, &_tcp_poll, 1);
  }
}

AsyncClient::~AsyncClient() {
  if (_pcb) {
    _close();
  }
  _free_closed_slot();
}

/*
 * Operators
 * */

AsyncClient& AsyncClient::operator=(const AsyncClient& other) {
  if (_pcb) {
    _close();
  }

  _pcb = other._pcb;
  _closed_slot = other._closed_slot;
  if (_pcb) {
    _rx_last_packet = uniuno::asynctcp_asm::fast_millis();
    tcp_arg(_pcb, this);
    tcp_recv(_pcb, &_tcp_recv);
    tcp_sent(_pcb, &_tcp_sent);
    tcp_err(_pcb, &_tcp_error);
    tcp_poll(_pcb, &_tcp_poll, 1);
  }
  return *this;
}

bool AsyncClient::operator==(const AsyncClient& other) {
  return _pcb == other._pcb;
}

AsyncClient& AsyncClient::operator+=(const AsyncClient& other) {
  if (next == NULL) {
    next = (AsyncClient*)(&other);
    next->prev = this;
  } else {
    AsyncClient* c = next;
    while (c->next != NULL) {
      c = c->next;
    }
    c->next = (AsyncClient*)(&other);
    c->next->prev = c;
  }
  return *this;
}

/*
 * Callback Setters
 * */

void AsyncClient::onConnect(AcConnectHandler cb, void* arg) {
  _connect_cb = cb;
  _connect_cb_arg = arg;
}

void AsyncClient::onDisconnect(AcConnectHandler cb, void* arg) {
  _discard_cb = cb;
  _discard_cb_arg = arg;
}

void AsyncClient::onAck(AcAckHandler cb, void* arg) {
  _sent_cb = cb;
  _sent_cb_arg = arg;
}

void AsyncClient::onError(AcErrorHandler cb, void* arg) {
  _error_cb = cb;
  _error_cb_arg = arg;
}

void AsyncClient::onData(AcDataHandler cb, void* arg) {
  _recv_cb = cb;
  _recv_cb_arg = arg;
}

void AsyncClient::onPacket(AcPacketHandler cb, void* arg) {
  _pb_cb = cb;
  _pb_cb_arg = arg;
}

void AsyncClient::onTimeout(AcTimeoutHandler cb, void* arg) {
  _timeout_cb = cb;
  _timeout_cb_arg = arg;
}

void AsyncClient::onPoll(AcConnectHandler cb, void* arg) {
  _poll_cb = cb;
  _poll_cb_arg = arg;
}

/*
 * Main Public Methods
 * */

bool AsyncClient::_connect(ip_addr_t addr, uint16_t port) {
  if (_pcb) {
    log_w("already connected, state %d", _pcb->state);
    return false;
  }
  if (!_start_async_task()) {
    log_e("failed to start task");
    return false;
  }

  tcp_pcb* pcb = tcp_new_ip_type(IPADDR_TYPE_ANY);
  if (!pcb) {
    log_e("pcb == NULL");
    return false;
  }

  _pcb = pcb;
  _allocate_closed_slot();
  _rx_last_packet = uniuno::asynctcp_asm::fast_millis();
  tcp_arg(pcb, this);
  tcp_err(pcb, &_tcp_error);
  tcp_recv(pcb, &_tcp_recv);
  tcp_sent(pcb, &_tcp_sent);
  tcp_poll(pcb, &_tcp_poll, 1);
  _tcp_connect(pcb, _closed_slot, &addr, port, (tcp_connected_fn)&_tcp_connected);
  return true;
}

bool AsyncClient::connect(IPAddress ip, uint16_t port) {
  ip_addr_t addr;
  ip_addr_set_ip4_u32(&addr, ip);

  return _connect(addr, port);
}

#if LWIP_IPV6 && ASYNCTCP_HAS_IPV6_ADDRESS
bool AsyncClient::connect(IPv6Address ip, uint16_t port) {
  auto ipaddr = static_cast<const uint32_t*>(ip);
  ip_addr_t addr = IPADDR6_INIT(ipaddr[0], ipaddr[1], ipaddr[2], ipaddr[3]);

  return _connect(addr, port);
}
#endif

bool AsyncClient::connect(const char* host, uint16_t port) {
  ip_addr_t addr;

  if (!_start_async_task()) {
    log_e("failed to start task");
    return false;
  }

  err_t err = dns_gethostbyname(host, &addr, (dns_found_callback)&_tcp_dns_found, this);
  if (err == ERR_OK) {
#if LWIP_IPV6
    if (addr.type == IPADDR_TYPE_V6) {
#if ASYNCTCP_HAS_IPV6_ADDRESS
      return connect(IPv6Address(addr.u_addr.ip6.addr), port);
#else
      return _connect(addr, port);
#endif
    }
    return connect(IPAddress(addr.u_addr.ip4.addr), port);
#else
    return connect(IPAddress(addr.addr), port);
#endif
  } else if (err == ERR_INPROGRESS) {
    _connect_port = port;
    return true;
  }
  log_e("error: %d", err);
  return false;
}

void AsyncClient::close(bool now) {
  if (_pcb) {
    _tcp_recved(_pcb, _closed_slot, _rx_ack_len);
  }
  _close();
}

int8_t AsyncClient::abort() {
  if (_pcb) {
    _tcp_abort(_pcb, _closed_slot);
    _pcb = NULL;
  }
  return ERR_ABRT;
}

// hasPollInterest() and space() are FORCE_INLINE in AsyncTCP.h

size_t AsyncClient::add(const char* data, size_t size, uint8_t apiflags) {
  if (!_pcb || size == 0 || data == NULL) {
    return 0;
  }
  size_t room = space();
  if (!room) {
    return 0;
  }
  size_t will_send = uniuno::asynctcp_asm::asm_min(room, size);
  int8_t err = ERR_OK;
  err = _tcp_write(_pcb, _closed_slot, data, will_send, apiflags);
  if (err != ERR_OK) {
    return 0;
  }
  return will_send;
}

bool AsyncClient::send() {
  auto backup = _tx_last_packet;
  _tx_last_packet = uniuno::asynctcp_asm::fast_millis();
  if (_tcp_output(_pcb, _closed_slot) == ERR_OK) {
    return true;
  }
  _tx_last_packet = backup;
  return false;
}

size_t AsyncClient::ack(size_t len) {
  len = uniuno::asynctcp_asm::asm_min(len, _rx_ack_len);
  if (len) {
    _tcp_recved(_pcb, _closed_slot, len);
  }
  _rx_ack_len -= len;
  return len;
}

void AsyncClient::ackPacket(struct pbuf* pb) {
  if (!pb) {
    return;
  }
  _tcp_recved(_pcb, _closed_slot, pb->tot_len);
  pbuf_free(pb);
}

/*
 * Main Private Methods
 * */

int8_t AsyncClient::_close() {
  // ets_printf("X: 0x%08x\n", (uint32_t)this);
  int8_t err = ERR_OK;
  if (_pcb) {
    // log_i("");
    tcp_arg(_pcb, NULL);
    tcp_sent(_pcb, NULL);
    tcp_recv(_pcb, NULL);
    tcp_err(_pcb, NULL);
    tcp_poll(_pcb, NULL, 0);
    _tcp_clear_events(this);
    err = _tcp_close(_pcb, _closed_slot);
    if (err != ERR_OK) {
      err = abort();
    }
    _free_closed_slot();
    _pcb = NULL;
    if (_discard_cb) {
      _discard_cb(_discard_cb_arg, this);
    }
  }
  return err;
}

void AsyncClient::_allocate_closed_slot() {
  portENTER_CRITICAL(&s_slots_mux);
  if (_closed_slot >= 0 && _closed_slot < _number_of_closed_slots && s_slots[_closed_slot].closed_gen == 0U) {
    s_slots[_closed_slot].pcb = _pcb;
    portEXIT_CRITICAL(&s_slots_mux);
    return;
  }
  _closed_slot = -1;
  uint32_t closed_slot_min_index = 0U;
  for (int i = 0; i < _number_of_closed_slots; ++i) {
    const AsyncSlotEntry& entry = s_slots[i];
    if (entry.closed_gen != 0U && !entry.ack_scheduled &&
        (_closed_slot == -1 || entry.closed_gen <= closed_slot_min_index)) {
      closed_slot_min_index = entry.closed_gen;
      _closed_slot = i;
    }
  }
  if (_closed_slot != -1) {
    s_slots[_closed_slot].closed_gen = 0U;
    s_slots[_closed_slot].pcb = _pcb;
    s_slots[_closed_slot].pending_recved = 0U;
  }
  portEXIT_CRITICAL(&s_slots_mux);
}

void AsyncClient::_free_closed_slot() {
  if (_closed_slot != -1) {
    portENTER_CRITICAL(&s_slots_mux);
    s_slots[_closed_slot].closed_gen = _closed_index++;
    if (UNLIKELY(_closed_index == 0U)) {
      _closed_index = 1U;
    }
    s_slots[_closed_slot].pcb = nullptr;
    s_slots[_closed_slot].pending_recved = 0U;
    _closed_slot = -1;
    portEXIT_CRITICAL(&s_slots_mux);
  }
}

/*
 * Private Callbacks
 * */

int8_t AsyncClient::_connected(void* pcb, int8_t err) {
  _pcb = reinterpret_cast<tcp_pcb*>(pcb);
  if (_pcb) {
    _allocate_closed_slot();
    _rx_last_packet = uniuno::asynctcp_asm::fast_millis();
    //        tcp_recv(_pcb, &_tcp_recv);
    //        tcp_sent(_pcb, &_tcp_sent);
    //        tcp_poll(_pcb, &_tcp_poll, 1);
  }
  if (_connect_cb) {
    _connect_cb(_connect_cb_arg, this);
  }
  return ERR_OK;
}

void AsyncClient::_error(int8_t err) {
  if (_pcb) {
    tcp_arg(_pcb, NULL);
    if (_pcb->state == LISTEN) {
      tcp_sent(_pcb, NULL);
      tcp_recv(_pcb, NULL);
      tcp_err(_pcb, NULL);
      tcp_poll(_pcb, NULL, 0);
    }
    _free_closed_slot();
    _pcb = NULL;
  }
  if (_error_cb) {
    _error_cb(_error_cb_arg, this, err);
  }
  if (_discard_cb) {
    _discard_cb(_discard_cb_arg, this);
  }
}

// In LwIP Thread
int8_t AsyncClient::_lwip_fin(tcp_pcb* pcb, int8_t err) {
  if (!_pcb || pcb != _pcb) {
    log_e("0x%08x != 0x%08x", (uint32_t)pcb, (uint32_t)_pcb);
    return ERR_OK;
  }
  tcp_arg(_pcb, NULL);
  if (_pcb->state == LISTEN) {
    tcp_sent(_pcb, NULL);
    tcp_recv(_pcb, NULL);
    tcp_err(_pcb, NULL);
    tcp_poll(_pcb, NULL, 0);
  }
  if (tcp_close(_pcb) != ERR_OK) {
    tcp_abort(_pcb);
  }
  _free_closed_slot();
  _pcb = NULL;
  return ERR_OK;
}

// In Async Thread
int8_t AsyncClient::_fin(tcp_pcb* pcb, int8_t err) {
  _tcp_clear_events(this);
  if (_discard_cb) {
    _discard_cb(_discard_cb_arg, this);
  }
  return ERR_OK;
}

HOT_PATH int8_t AsyncClient::_sent(tcp_pcb* pcb, uint16_t len) {
  const uint32_t now = uniuno::asynctcp_asm::fast_millis();
  _rx_last_packet = now;
  _rx_last_ack = now;
  if (LIKELY(static_cast<bool>(_sent_cb))) {
    _sent_cb(_sent_cb_arg, this, len, (now - _tx_last_packet));
  }
  return ERR_OK;
}

HOT_PATH int8_t AsyncClient::_recv(tcp_pcb* pcb, pbuf* pb, int8_t err) {
  size_t total_recved = 0;
  if (LIKELY(pb != NULL)) {
    _rx_last_packet = uniuno::asynctcp_asm::fast_millis();
  }
  while (LIKELY(pb != NULL)) {
    // we should not ack before we assimilate the data
    _ack_pcb = true;
    pbuf* b = pb;
    pb = b->next;
    b->next = NULL;
    if (UNLIKELY(static_cast<bool>(_pb_cb))) {
      _pb_cb(_pb_cb_arg, this, b);
    } else {
      if (LIKELY(static_cast<bool>(_recv_cb))) {
        _recv_cb(_recv_cb_arg, this, b->payload, b->len);
      }
      if (UNLIKELY(!_ack_pcb)) {
        _rx_ack_len += b->len;
      } else {
        total_recved += b->len;
      }
      pbuf_free(b);
    }
  }
  if (LIKELY(total_recved > 0 && _pcb != nullptr)) {
    _tcp_recved(_pcb, _closed_slot, total_recved);
  }
  return ERR_OK;
}

int8_t AsyncClient::_poll(tcp_pcb* pcb) {
  if (!_pcb) {
    log_w("pcb is NULL");
    return ERR_OK;
  }
  if (pcb != _pcb) {
    log_e("0x%08x != 0x%08x", (uint32_t)pcb, (uint32_t)_pcb);
    return ERR_OK;
  }

  uint32_t now = uniuno::asynctcp_asm::fast_millis();

  // ACK Timeout (Branchless Xtensa hardware timer expiration)
  if (UNLIKELY(_ack_timeout != 0)) {
    const uint32_t one_day = 86400000;
    bool last_tx_is_after_last_ack = (_rx_last_ack - _tx_last_packet + one_day) < one_day;
    if (last_tx_is_after_last_ack && uniuno::asm_opt::is_timer_expired(now, _tx_last_packet + _ack_timeout)) {
      log_w("ack timeout %d", pcb->state);
      if (LIKELY(static_cast<bool>(_timeout_cb))) _timeout_cb(_timeout_cb_arg, this, (now - _tx_last_packet));
      return ERR_OK;
    }
  }
  // RX Timeout (Branchless Xtensa hardware timer expiration)
  if (UNLIKELY(_rx_timeout != 0 && uniuno::asm_opt::is_timer_expired(now, _rx_last_packet + (_rx_timeout * 1000)))) {
    log_w("rx timeout %d", pcb->state);
    _close();
    return ERR_OK;
  }
  // Everything is fine
  if (_poll_cb) {
    _poll_cb(_poll_cb_arg, this);
  }
  return ERR_OK;
}

void AsyncClient::_dns_found(struct ip_addr* ipaddr) {
  if (ipaddr && IP_IS_V4(ipaddr)) {
    connect(IPAddress(ip_addr_get_ip4_u32(ipaddr)), _connect_port);
#if LWIP_IPV6
  } else if (ipaddr && IP_IS_V6(ipaddr)) {
#if ASYNCTCP_HAS_IPV6_ADDRESS
    connect(IPv6Address(ipaddr->u_addr.ip6.addr), _connect_port);
#else
    _connect(*ipaddr, _connect_port);
#endif
#endif
  } else {
    if (_error_cb) {
      _error_cb(_error_cb_arg, this, -55);
    }
    if (_discard_cb) {
      _discard_cb(_discard_cb_arg, this);
    }
  }
}

/*
 * Public Helper Methods
 * */

void AsyncClient::stop() {
  close(false);
}

bool AsyncClient::free() {
  if (!_pcb) {
    return true;
  }
  if (_pcb->state == 0 || _pcb->state > 4) {
    return true;
  }
  return false;
}

size_t AsyncClient::write(const char* data) {
  if (data == NULL) {
    return 0;
  }
  return write(data, uniuno::asynctcp_asm::asm_strlen(data));
}

HOT_PATH size_t AsyncClient::write(const char* data, size_t size, uint8_t apiflags) {
  if (UNLIKELY(!_pcb || size == 0 || data == NULL)) {
    return 0;
  }
  size_t room = space();
  if (UNLIKELY(!room)) {
    return 0;
  }
  size_t will_send = uniuno::asynctcp_asm::asm_min(room, size);
  auto backup = _tx_last_packet;
  _tx_last_packet = uniuno::asynctcp_asm::fast_millis();
  int8_t err = _tcp_write_and_output(_pcb, _closed_slot, data, will_send, apiflags);
  if (UNLIKELY(err != ERR_OK)) {
    _tx_last_packet = backup;
    return 0;
  }
  return will_send;
}

void AsyncClient::setRxTimeout(uint32_t timeout) {
  _rx_timeout = timeout;
}

uint32_t AsyncClient::getRxTimeout() {
  return _rx_timeout;
}

uint32_t AsyncClient::getAckTimeout() {
  return _ack_timeout;
}

void AsyncClient::setAckTimeout(uint32_t timeout) {
  _ack_timeout = timeout;
}

void AsyncClient::setNoDelay(bool nodelay) {
  if (!_pcb) {
    return;
  }
  if (nodelay) {
    tcp_nagle_disable(_pcb);
  } else {
    tcp_nagle_enable(_pcb);
  }
}

bool AsyncClient::getNoDelay() {
  if (!_pcb) {
    return false;
  }
  return tcp_nagle_disabled(_pcb);
}

// getMss() is FORCE_INLINE in AsyncTCP.h

uint32_t AsyncClient::getRemoteAddress() {
  if (!_pcb) {
    return 0;
  }
#if LWIP_IPV4 && LWIP_IPV6
  return _pcb->remote_ip.u_addr.ip4.addr;
#else
  return _pcb->remote_ip.addr;
#endif
}

#if LWIP_IPV6
ip6_addr_t AsyncClient::getRemoteAddress6() {
  if (!_pcb) {
    ip6_addr_t nulladdr;
    ip6_addr_set_zero(&nulladdr);
    return nulladdr;
  }
  return _pcb->remote_ip.u_addr.ip6;
}

ip6_addr_t AsyncClient::getLocalAddress6() {
  if (!_pcb) {
    ip6_addr_t nulladdr;
    ip6_addr_set_zero(&nulladdr);
    return nulladdr;
  }
  return _pcb->local_ip.u_addr.ip6;
}

#if ASYNCTCP_HAS_IPV6_ADDRESS
IPv6Address AsyncClient::remoteIP6() {
  return IPv6Address(getRemoteAddress6().addr);
}

IPv6Address AsyncClient::localIP6() {
  return IPv6Address(getLocalAddress6().addr);
}
#endif
#endif

uint16_t AsyncClient::getRemotePort() {
  if (!_pcb) {
    return 0;
  }
  return _pcb->remote_port;
}

uint32_t AsyncClient::getLocalAddress() {
  if (!_pcb) {
    return 0;
  }
#if LWIP_IPV4 && LWIP_IPV6
  return _pcb->local_ip.u_addr.ip4.addr;
#else
  return _pcb->local_ip.addr;
#endif
}

uint16_t AsyncClient::getLocalPort() {
  if (!_pcb) {
    return 0;
  }
  return _pcb->local_port;
}

IPAddress AsyncClient::remoteIP() {
  return IPAddress(getRemoteAddress());
}

uint16_t AsyncClient::remotePort() {
  return getRemotePort();
}

IPAddress AsyncClient::localIP() {
  return IPAddress(getLocalAddress());
}

uint16_t AsyncClient::localPort() {
  return getLocalPort();
}

// state(), connected(), freeable(), canSend() are FORCE_INLINE in AsyncTCP.h

bool AsyncClient::connecting() {
  if (!_pcb) {
    return false;
  }
  return _pcb->state > 0 && _pcb->state < 4;
}

bool AsyncClient::disconnecting() {
  if (!_pcb) {
    return false;
  }
  return _pcb->state > 4 && _pcb->state < 10;
}

bool AsyncClient::disconnected() {
  if (!_pcb) {
    return true;
  }
  return _pcb->state == 0 || _pcb->state == 10;
}

// Static Look-Up Table for instantaneous O(1) LwIP error code translation
static const char* const s_tcp_err_lut[] = {
    "OK",                    //  0: ERR_OK
    "Out of memory error",   // -1: ERR_MEM
    "Buffer error",          // -2: ERR_BUF
    "Timeout",               // -3: ERR_TIMEOUT
    "Routing problem",       // -4: ERR_RTE
    "Operation in progress", // -5: ERR_INPROGRESS
    "Illegal value",         // -6: ERR_VAL
    "Operation would block", // -7: ERR_WOULDBLOCK
    "Address in use",        // -8: ERR_USE
    "Already connected",     // -9: ERR_ALREADY
    "Not connected",         // -10: ERR_CONN
    "Low-level netif error", // -11: ERR_IF
    "Connection aborted",    // -12: ERR_ABRT
    "Connection reset",      // -13: ERR_RST
    "Connection closed",     // -14: ERR_CLSD
    "Illegal argument"       // -15: ERR_ARG
};

const char* AsyncClient::errorToString(int8_t error) {
  int idx = -error;
  if (idx >= 0 && idx < (int)(sizeof(s_tcp_err_lut) / sizeof(s_tcp_err_lut[0]))) {
    return s_tcp_err_lut[idx];
  }
  if (UNLIKELY(error == -55)) {
    return "DNS failed";
  }
  return "UNKNOWN";
}

// Static Look-Up Table for instantaneous O(1) TCP PCB state translation
static const char* const s_tcp_state_lut[] = {
    "Closed",       // 0: CLOSED
    "Listen",       // 1: LISTEN
    "SYN Sent",     // 2: SYN_SENT
    "SYN Received", // 3: SYN_RCVD
    "Established",  // 4: ESTABLISHED
    "FIN Wait 1",   // 5: FIN_WAIT_1
    "FIN Wait 2",   // 6: FIN_WAIT_2
    "Close Wait",   // 7: CLOSE_WAIT
    "Closing",      // 8: CLOSING
    "Last ACK",     // 9: LAST_ACK
    "Time Wait"     // 10: TIME_WAIT
};

const char* AsyncClient::stateToString() {
  uint8_t s = state();
  if (LIKELY(s < sizeof(s_tcp_state_lut) / sizeof(s_tcp_state_lut[0]))) {
    return s_tcp_state_lut[s];
  }
  return "UNKNOWN";
}

/*
 * Static Callbacks (LwIP C2C++ interconnect)
 * */

void AsyncClient::_s_dns_found(const char* name, struct ip_addr* ipaddr, void* arg) {
  reinterpret_cast<AsyncClient*>(arg)->_dns_found(ipaddr);
}

int8_t AsyncClient::_s_poll(void* arg, struct tcp_pcb* pcb) {
  return reinterpret_cast<AsyncClient*>(arg)->_poll(pcb);
}

int8_t AsyncClient::_s_recv(void* arg, struct tcp_pcb* pcb, struct pbuf* pb, int8_t err) {
  return reinterpret_cast<AsyncClient*>(arg)->_recv(pcb, pb, err);
}

int8_t AsyncClient::_s_fin(void* arg, struct tcp_pcb* pcb, int8_t err) {
  return reinterpret_cast<AsyncClient*>(arg)->_fin(pcb, err);
}

int8_t AsyncClient::_s_lwip_fin(void* arg, struct tcp_pcb* pcb, int8_t err) {
  return reinterpret_cast<AsyncClient*>(arg)->_lwip_fin(pcb, err);
}

int8_t AsyncClient::_s_sent(void* arg, struct tcp_pcb* pcb, uint16_t len) {
  return reinterpret_cast<AsyncClient*>(arg)->_sent(pcb, len);
}

void AsyncClient::_s_error(void* arg, int8_t err) {
  reinterpret_cast<AsyncClient*>(arg)->_error(err);
}

int8_t AsyncClient::_s_connected(void* arg, void* pcb, int8_t err) {
  return reinterpret_cast<AsyncClient*>(arg)->_connected(pcb, err);
}

/*
  Async TCP Server
 */

AsyncServer::AsyncServer(IPAddress addr, uint16_t port)
    : _port(port), _bind4(true), _addr(addr), _noDelay(false), _pcb(0), _connect_cb(nullptr), _connect_cb_arg(0) {}

#if ASYNCTCP_HAS_IPV6_ADDRESS
AsyncServer::AsyncServer(IPv6Address addr, uint16_t port)
    : _port(port), _bind6(true), _addr6(addr), _noDelay(false), _pcb(0), _connect_cb(nullptr), _connect_cb_arg(0) {}
#endif

AsyncServer::AsyncServer(uint16_t port)
    : _port(port), _bind4(true), _bind6(true), _addr((uint32_t)IPADDR_ANY),
#if ASYNCTCP_HAS_IPV6_ADDRESS
      _addr6(),
#endif
      _noDelay(false), _pcb(0), _connect_cb(nullptr), _connect_cb_arg(0) {
}

AsyncServer::~AsyncServer() {
  end();
}

void AsyncServer::onClient(AcConnectHandler cb, void* arg) {
  _connect_cb = cb;
  _connect_cb_arg = arg;
}

void AsyncServer::begin() {
  if (_pcb) {
    return;
  }

  if (!_start_async_task()) {
    log_e("failed to start task");
    return;
  }
  int8_t err, bind_type;

  if (_bind4 && _bind6) {
    bind_type = IPADDR_TYPE_ANY;
  } else if (_bind6) {
    bind_type = IPADDR_TYPE_V6;
  } else {
    bind_type = IPADDR_TYPE_V4;
  }

  _pcb = tcp_new_ip_type(bind_type);
  if (!_pcb) {
    log_e("_pcb == NULL");
    return;
  }

  ip_addr_t local_addr;
  ip_addr_set_ip4_u32(&local_addr, _addr);
  /*    local_addr.type = bind_type;
      local_addr.u_addr.ip4.addr = (uint32_t) _addr;
      memcpy(local_addr.u_addr.ip6.addr, static_cast<const uint32_t*>(_addr6), sizeof(uint32_t) * 4); */
  err = _tcp_bind(_pcb, &local_addr, _port);

  if (err != ERR_OK) {
    _tcp_close(_pcb, -1);
    log_e("bind error: %d", err);
    return;
  }

  static uint8_t backlog = 5;
  _pcb = _tcp_listen_with_backlog(_pcb, backlog);
  if (!_pcb) {
    log_e("listen_pcb == NULL");
    return;
  }
  tcp_arg(_pcb, (void*)this);
  tcp_accept(_pcb, &_s_accept);
}

void AsyncServer::end() {
  if (_pcb) {
    tcp_arg(_pcb, NULL);
    tcp_accept(_pcb, NULL);
    if (tcp_close(_pcb) != ERR_OK) {
      _tcp_abort(_pcb, -1);
    }
    _pcb = NULL;
  }
}

// runs on LwIP thread
int8_t AsyncServer::_accept(tcp_pcb* pcb, int8_t err) {
  // ets_printf("+A: 0x%08x\n", pcb);
  if (_connect_cb) {
    AsyncClient* c = new AsyncClient(pcb);
    if (c) {
      c->setNoDelay(_noDelay);
      return _tcp_accept(this, c);
    }
  }
  if (tcp_close(pcb) != ERR_OK) {
    tcp_abort(pcb);
  }
  log_e("FAIL");
  return ERR_OK;
}

int8_t AsyncServer::_accepted(AsyncClient* client) {
  if (_connect_cb) {
    _connect_cb(_connect_cb_arg, client);
  }
  return ERR_OK;
}

void AsyncServer::setNoDelay(bool nodelay) {
  _noDelay = nodelay;
}

bool AsyncServer::getNoDelay() {
  return _noDelay;
}

uint8_t AsyncServer::status() {
  if (!_pcb) {
    return 0;
  }
  return _pcb->state;
}

int8_t AsyncServer::_s_accept(void* arg, tcp_pcb* pcb, int8_t err) {
  return reinterpret_cast<AsyncServer*>(arg)->_accept(pcb, err);
}

int8_t AsyncServer::_s_accepted(void* arg, AsyncClient* client) {
  return reinterpret_cast<AsyncServer*>(arg)->_accepted(client);
}
