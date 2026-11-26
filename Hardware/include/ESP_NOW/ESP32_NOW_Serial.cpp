#include "sdkconfig.h"
#if CONFIG_ESP_HOSTED_ENABLED
#warning "ESP-NOW is only supported in SoCs with native Wi-Fi support"
#else

#include "ESP32_NOW_Serial.h"
#include "EspNowAsm.h"
#include <string.h>
#include "esp_heap_caps.h"
#include "esp_now.h"
#include "esp_system.h"
#include "esp32-hal.h"
#include "esp_mac.h"

/*
 *
 *    Serial Port Implementation Class
 *
 */

ESP_NOW_Serial_Class::ESP_NOW_Serial_Class(const uint8_t* mac_addr, uint8_t channel, wifi_interface_t iface,
                                           const uint8_t* lmk, bool remove_on_fail)
    : ESP_NOW_Peer(mac_addr, channel, iface, lmk) {
  tx_ring_buf = nullptr;
  rx_buf_ = nullptr;
  rx_cap_ = 0;
  rx_mask_ = 0;
  rx_head_ = 0;
  rx_tail_ = 0;
  rx_mux_ = portMUX_INITIALIZER_UNLOCKED;
  tx_sem = nullptr;
  queued_size = 0;
  queued_buff = nullptr;
  resend_count = 0;
  _remove_on_fail = remove_on_fail;
}

ESP_NOW_Serial_Class::~ESP_NOW_Serial_Class() {
  end();
}

size_t ESP_NOW_Serial_Class::setTxBufferSize(size_t tx_queue_len) {
  if (tx_ring_buf) {
    vRingbufferDelete(tx_ring_buf);
    tx_ring_buf = nullptr;
  }
  if (!tx_queue_len) {
    return 0;
  }
  tx_ring_buf = xRingbufferCreate(tx_queue_len, RINGBUF_TYPE_BYTEBUF);
  if (!tx_ring_buf) {
    return 0;
  }
  return tx_queue_len;
}

size_t ESP_NOW_Serial_Class::setRxBufferSize(size_t rx_queue_len) {
  portENTER_CRITICAL(&rx_mux_);
  uint8_t* old_buf = rx_buf_;
  rx_buf_ = nullptr;
  rx_cap_ = 0;
  rx_mask_ = 0;
  rx_head_ = 0;
  rx_tail_ = 0;
  portEXIT_CRITICAL(&rx_mux_);

  if (old_buf != nullptr) {
    heap_caps_free(old_buf);
  }
  if (!rx_queue_len) {
    return 0;
  }

  const size_t cap = espnow_asm::nextPow2Size(rx_queue_len);
  uint8_t* new_buf = static_cast<uint8_t*>(heap_caps_malloc(cap, MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT));
  if (new_buf == nullptr) {
    log_e("Failed to allocate %u bytes for RX ring buffer", (unsigned)cap);
    return 0;
  }

  portENTER_CRITICAL(&rx_mux_);
  rx_buf_ = new_buf;
  rx_cap_ = cap;
  rx_mask_ = cap - 1;
  rx_head_ = 0;
  rx_tail_ = 0;
  portEXIT_CRITICAL(&rx_mux_);
  return cap;
}

bool ESP_NOW_Serial_Class::begin(unsigned long baud) {
  if (!ESP_NOW.begin() || !add()) {
    return false;
  }
  if (tx_sem == nullptr) {
    tx_sem = xSemaphoreCreateBinary();
    // xSemaphoreTake(tx_sem, 0);
    xSemaphoreGive(tx_sem);
  }

  size_t buf_size = 0;
  if (ESP_NOW.getVersion() == 2) {
    // ESP-NOW v2.0 has a larger maximum data length, so we need to increase the buffer sizes
    // to hold around 3-4 packets
    buf_size = setRxBufferSize(4096);
    buf_size &= setTxBufferSize(4096);
  } else {
    // ESP-NOW v1.0 has a smaller maximum data length, so we can use the default buffer sizes
    // to hold around 3-4 packets
    buf_size = setRxBufferSize(1024);
    buf_size &= setTxBufferSize(1024);
  }

  if (buf_size == 0) {
    log_e("Failed to set buffer size");
    return false;
  }

  return true;
}

void ESP_NOW_Serial_Class::end() {
  remove();
  setRxBufferSize(0);
  setTxBufferSize(0);
  if (tx_sem != nullptr) {
    vSemaphoreDelete(tx_sem);
    tx_sem = nullptr;
  }
}

// Stream
HOT_PATH int ESP_NOW_Serial_Class::available(void) {
  if (UNLIKELY(rx_buf_ == nullptr)) {
    return 0;
  }
  portENTER_CRITICAL(&rx_mux_);
  const size_t avail = rx_head_ - rx_tail_;
  portEXIT_CRITICAL(&rx_mux_);
  return static_cast<int>(avail);
}

int ESP_NOW_Serial_Class::peek(void) {
  if (UNLIKELY(rx_buf_ == nullptr)) {
    return -1;
  }
  int c = -1;
  portENTER_CRITICAL(&rx_mux_);
  if (rx_head_ != rx_tail_) {
    c = rx_buf_[rx_tail_ & rx_mask_];
  }
  portEXIT_CRITICAL(&rx_mux_);
  return c;
}

int ESP_NOW_Serial_Class::read(void) {
  if (UNLIKELY(rx_buf_ == nullptr)) {
    return -1;
  }
  int c = -1;
  portENTER_CRITICAL(&rx_mux_);
  if (rx_head_ != rx_tail_) {
    c = rx_buf_[rx_tail_ & rx_mask_];
    rx_tail_++;
  }
  portEXIT_CRITICAL(&rx_mux_);
  return c;
}

HOT_PATH size_t ESP_NOW_Serial_Class::read(uint8_t* buffer, size_t size) {
  if (UNLIKELY(rx_buf_ == nullptr || buffer == nullptr || size == 0)) {
    return 0;
  }
  portENTER_CRITICAL(&rx_mux_);
  const size_t avail = rx_head_ - rx_tail_;
  const size_t to_read = (size < avail) ? size : avail;
  if (to_read > 0) {
    const size_t rd_idx = rx_tail_ & rx_mask_;
    const size_t first = rx_cap_ - rd_idx;
    if (to_read <= first) {
      espnow_asm::copyAlignedOrByte(buffer, rx_buf_ + rd_idx, to_read);
    } else {
      espnow_asm::copyAlignedOrByte(buffer, rx_buf_ + rd_idx, first);
      espnow_asm::copyAlignedOrByte(buffer + first, rx_buf_, to_read - first);
    }
    rx_tail_ += to_read;
  }
  portEXIT_CRITICAL(&rx_mux_);
  return to_read;
}

void ESP_NOW_Serial_Class::flush() {
  if (tx_ring_buf == nullptr) {
    return;
  }
  UBaseType_t uxItemsWaiting = 0;
  vRingbufferGetInfo(tx_ring_buf, nullptr, nullptr, nullptr, nullptr, &uxItemsWaiting);
  if (uxItemsWaiting) {
    // Now trigger the ISR to read data from the ring buffer.
    if (xSemaphoreTake(tx_sem, 0) == pdTRUE) {
      checkForTxData();
    }
  }
  while (uxItemsWaiting) {
    delay(5);
    vRingbufferGetInfo(tx_ring_buf, nullptr, nullptr, nullptr, nullptr, &uxItemsWaiting);
  }
}

// RX callback
HOT_PATH void ESP_NOW_Serial_Class::onReceive(const uint8_t* data, size_t len, bool broadcast) {
  if (UNLIKELY(rx_buf_ == nullptr || data == nullptr || len == 0)) {
    return;
  }
  bool overflow = false;
  portENTER_CRITICAL(&rx_mux_);
  if (LIKELY(rx_buf_ != nullptr)) {
    const size_t free_space = rx_cap_ - (rx_head_ - rx_tail_);
    const size_t to_write = (len <= free_space) ? len : free_space;
    overflow = (to_write < len);
    if (to_write > 0) {
      const size_t wr_idx = rx_head_ & rx_mask_;
      const size_t first = rx_cap_ - wr_idx;
      if (to_write <= first) {
        espnow_asm::copyAlignedOrByte(rx_buf_ + wr_idx, data, to_write);
      } else {
        espnow_asm::copyAlignedOrByte(rx_buf_ + wr_idx, data, first);
        espnow_asm::copyAlignedOrByte(rx_buf_, data + first, to_write - first);
      }
      rx_head_ += to_write;
    }
  }
  portEXIT_CRITICAL(&rx_mux_);
  if (UNLIKELY(overflow)) {
    log_e("RX Overflow!");
  }
  // Now trigger TX drain if idle.
  if (tx_sem != nullptr && xSemaphoreTake(tx_sem, 0) == pdTRUE) {
    checkForTxData();
  }
}

// Print
int ESP_NOW_Serial_Class::availableForWrite() {
  if (tx_ring_buf == nullptr) {
    return 0;
  }
  return xRingbufferGetCurFreeSize(tx_ring_buf);
}

size_t ESP_NOW_Serial_Class::tryToSend() {
  // log_d(MACSTR ": %u", MAC2STR(addr()), queued_size);
  size_t sent = send(queued_buff, queued_size);
  if (!sent) {
    //_onSent will not be called anymore
    // the data is lost in this case
    vRingbufferReturnItem(tx_ring_buf, queued_buff);
    queued_buff = nullptr;
    xSemaphoreGive(tx_sem);
    end();
  }
  return sent;
}

bool ESP_NOW_Serial_Class::checkForTxData() {
  // do we have something that failed the last time?
  resend_count = 0;
  if (queued_buff == nullptr) {
    queued_buff = (uint8_t*)xRingbufferReceiveUpTo(tx_ring_buf, &queued_size, 0, ESP_NOW.getMaxDataLen());
  } else {
    log_d(MACSTR " : PREVIOUS", MAC2STR(addr()));
  }
  if (queued_buff != nullptr) {
    return tryToSend() > 0;
  }
  // log_d(MACSTR ": EMPTY", MAC2STR(addr()));
  xSemaphoreGive(tx_sem);
  return false;
}

size_t ESP_NOW_Serial_Class::write(const uint8_t* buffer, size_t size, uint32_t timeout) {
  log_v(MACSTR ", size %u", MAC2STR(addr()), size);
  if (tx_sem == nullptr || tx_ring_buf == nullptr || !added) {
    return 0;
  }
  size_t space = availableForWrite();
  size_t left = size;

  if (space) {
    if (left < space) {
      space = left;
    }
    if (xRingbufferSend(tx_ring_buf, (void*)(buffer), space, 0) == pdTRUE) {
      buffer += space;
      left -= space;
      if (xSemaphoreTake(tx_sem, 0) == pdTRUE) {
        if (checkForTxData()) {
          if (!left) {
            // we are done
            return size;
          }
        } else {
          // send failed
          return 0;
        }
      }
    } else {
      log_e("RingbufferFastSend Failed");
      return 0;
    }
  } else if (xSemaphoreTake(tx_sem, pdMS_TO_TICKS(timeout)) == pdTRUE) {
    checkForTxData();
  }
  // Blocking method, Sending data to ringbuffer, and handle the data in ISR.
  if (xRingbufferSend(tx_ring_buf, (void*)(buffer), left, pdMS_TO_TICKS(timeout)) != pdTRUE) {
    log_e("RingbufferSend Failed");
    return size - left;
  }
  // Now trigger the ISR to read data from the ring buffer.
  if (xSemaphoreTake(tx_sem, 0) == pdTRUE) {
    checkForTxData();
  }

  return size;
}
// TX Done Callback
void ESP_NOW_Serial_Class::onSent(bool success) {
  log_v(MACSTR " : %s", MAC2STR(addr()), success ? "OK" : "FAIL");
  if (tx_sem == nullptr || tx_ring_buf == nullptr || !added) {
    return;
  }
  if (success) {
    vRingbufferReturnItem(tx_ring_buf, queued_buff);
    queued_buff = nullptr;
    // send next packet?
    // log_d(MACSTR ": NEXT", MAC2STR(addr()));
    checkForTxData();
  } else {
    // send failed
    // resend
    if (resend_count < 5) {
      resend_count++;
      // log_d(MACSTR ": RE-SENDING[%u]", MAC2STR(addr()), resend_count);
      tryToSend();
    } else {
      // resend limit reached
      // the data is lost in this case
      vRingbufferReturnItem(tx_ring_buf, queued_buff);
      queued_buff = nullptr;
      log_e(MACSTR " : RE-SEND_MAX[%u]", MAC2STR(addr()), resend_count);
      // if we are not able to send the data and remove_on_fail is set, remove the peer
      if (_remove_on_fail) {
        xSemaphoreGive(tx_sem);
        end();
        return;
      }
      // log_d(MACSTR ": NEXT", MAC2STR(addr()));
      checkForTxData();
    }
  }
}

#endif
