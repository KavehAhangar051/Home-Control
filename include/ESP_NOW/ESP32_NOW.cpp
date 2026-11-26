#include "sdkconfig.h"
#if CONFIG_ESP_HOSTED_ENABLED
#warning "ESP-NOW is only supported in SoCs with native Wi-Fi support"
#else

#include "Arduino.h"
#include "ESP32_NOW.h"
#include "EspNowAsm.h"
#include <string.h>
#include <freertos/portmacro.h>
#include "esp_err.h"
#include "esp_system.h"
#include "esp32-hal.h"
#include "esp_wifi.h"

#ifndef ESP_NOW_MAX_DATA_LEN_V2
#define ESP_NOW_MAX_DATA_LEN_V2 1470
#endif

static ESP_NOW_NewPeerCb _new_peer_cb;
static bool _esp_now_has_begun = false;
static uniuno::SmallVector<ESP_NOW_Peer*, ESP_NOW_MAX_TOTAL_PEER_NUM> _esp_now_peers;
static portMUX_TYPE _peers_mux = portMUX_INITIALIZER_UNLOCKED;

/**
 * @brief Logs a human-readable ESP-NOW driver error code in a single shared path.
 */
static void _esp_now_log_error(const char* op, esp_err_t result) {
  log_e("%s failed: %s (0x%x)", op, esp_err_to_name(result), result);
}

static esp_err_t _esp_now_add_peer(const uint8_t* mac_addr, uint8_t channel, wifi_interface_t iface, const uint8_t* lmk,
#if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 0, 0)
                                   esp_now_rate_config_t* rate_config,
#endif
                                   ESP_NOW_Peer* _peer = nullptr) {
  log_i("Adding peer " MACSTR, MAC2STR(mac_addr));
  if (esp_now_is_peer_exist(mac_addr)) {
    log_e("Peer Already Exists");
    return ESP_ERR_ESPNOW_EXIST;
  }

  esp_now_peer_info_t peer;
  memset(&peer, 0, sizeof(esp_now_peer_info_t));
  memcpy(peer.peer_addr, mac_addr, ESP_NOW_ETH_ALEN);
  peer.channel = channel;
  peer.ifidx = iface;
  peer.encrypt = lmk != nullptr;
  if (lmk) {
    memcpy(peer.lmk, lmk, ESP_NOW_KEY_LEN);
  }

  esp_err_t result = esp_now_add_peer(&peer);
  if (result == ESP_OK) {
    if (_peer != nullptr) {
      portENTER_CRITICAL(&_peers_mux);
      const bool has_space = (_esp_now_peers.size() < ESP_NOW_MAX_TOTAL_PEER_NUM);
      if (has_space) {
        _esp_now_peers.push_back(_peer);
      }
      portEXIT_CRITICAL(&_peers_mux);
      if (!has_space) {
        esp_now_del_peer(mac_addr);
        log_e("Library Peer list full");
        return ESP_FAIL;
      }
#if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 0, 0)
      if (_esp_now_has_begun && rate_config != nullptr) {
        log_i("ESP-NOW already running. Setting PHY rate for peer " MACSTR, MAC2STR(_peer->addr()));
        result = esp_now_set_peer_rate_config(_peer->addr(), rate_config);
        if (result != ESP_OK) {
          log_w("Could not set the ESP-NOW PHY rate for peer " MACSTR, MAC2STR(_peer->addr()));
        }
      }
#endif
      return ESP_OK;
    }
  } else {
    _esp_now_log_error("Add peer", result);
  }
  return result;
}

static esp_err_t _esp_now_del_peer(const uint8_t* mac_addr) {
  esp_err_t result = esp_now_del_peer(mac_addr);
  if (result != ESP_OK) {
    _esp_now_log_error("Delete peer", result);
  }

  portENTER_CRITICAL(&_peers_mux);
  for (size_t i = 0; i < _esp_now_peers.size(); i++) {
    if (espnow_asm::macEqual(mac_addr, _esp_now_peers[i]->addr())) {
      _esp_now_peers.erase_unordered(i);
      break;
    }
  }
  portEXIT_CRITICAL(&_peers_mux);
  return result;
}

static esp_err_t _esp_now_modify_peer(const uint8_t* mac_addr, uint8_t channel, wifi_interface_t iface,
                                      const uint8_t* lmk) {
  log_v(MACSTR, MAC2STR(mac_addr));
  if (!esp_now_is_peer_exist(mac_addr)) {
    log_e("Peer not found");
    return ESP_ERR_ESPNOW_NOT_FOUND;
  }

  esp_now_peer_info_t peer;
  memset(&peer, 0, sizeof(esp_now_peer_info_t));
  memcpy(peer.peer_addr, mac_addr, ESP_NOW_ETH_ALEN);
  peer.channel = channel;
  peer.ifidx = iface;
  peer.encrypt = lmk != nullptr;
  if (lmk) {
    memcpy(peer.lmk, lmk, ESP_NOW_KEY_LEN);
  }

  esp_err_t result = esp_now_mod_peer(&peer);
  if (result != ESP_OK) {
    _esp_now_log_error("Modify peer", result);
  }
  return result;
}

#if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 0, 0)
HOT_PATH static void _esp_now_rx_cb(const esp_now_recv_info_t* info, const uint8_t* data, int len) {
  const uint8_t* src_addr = info->src_addr;
  const bool broadcast = espnow_asm::isBroadcastMac(info->des_addr);
#else
HOT_PATH static void _esp_now_rx_cb(const uint8_t* src_addr, const uint8_t* data, int len) {
  esp_now_recv_info_t compat_info{const_cast<uint8_t*>(src_addr), nullptr};
  const esp_now_recv_info_t* info = &compat_info;
  const bool broadcast = false;
#endif
  log_v("%s from " MACSTR ", data length : %u", broadcast ? "Broadcast" : "Unicast", MAC2STR(src_addr), len);
  log_buf_v(data, len);

  // Fast path: scan registered local peers without calling IDF esp_now_is_peer_exist() first.
  // Snapshot pointer inside critical section and release before invoking virtual callback.
  ESP_NOW_Peer* matched = nullptr;
  portENTER_CRITICAL(&_peers_mux);
  const size_t n = _esp_now_peers.size();
  for (size_t i = 0; i < n; i++) {
    ESP_NOW_Peer* peer = _esp_now_peers[i];
    if (espnow_asm::macEqual(src_addr, peer->addr())) {
      matched = peer;
      break;
    }
  }
  portEXIT_CRITICAL(&_peers_mux);

  if (LIKELY(matched != nullptr)) {
    log_v("Calling onReceive");
    matched->onReceive(data, len, broadcast);
    return;
  }

  if (!esp_now_is_peer_exist(src_addr) && _new_peer_cb) {
    log_v("Calling new_cb, peer not found.");
    _new_peer_cb(info, data, len);
  }
}

#if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 5, 0)
HOT_PATH static void _esp_now_tx_cb(const esp_now_send_info_t* tx_info, esp_now_send_status_t status) {
  const uint8_t* mac_addr = tx_info->des_addr;
#else
HOT_PATH static void _esp_now_tx_cb(const uint8_t* mac_addr, esp_now_send_status_t status) {
#endif
  log_v(MACSTR " : %s", MAC2STR(mac_addr), (status == ESP_NOW_SEND_SUCCESS) ? "SUCCESS" : "FAILED");
  ESP_NOW_Peer* matched = nullptr;
  portENTER_CRITICAL(&_peers_mux);
  const size_t n = _esp_now_peers.size();
  for (size_t i = 0; i < n; i++) {
    ESP_NOW_Peer* peer = _esp_now_peers[i];
    if (espnow_asm::macEqual(mac_addr, peer->addr())) {
      matched = peer;
      break;
    }
  }
  portEXIT_CRITICAL(&_peers_mux);

  if (LIKELY(matched != nullptr)) {
    matched->onSent(status == ESP_NOW_SEND_SUCCESS);
  }
}

#if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 0, 0)
esp_err_t _esp_now_set_all_peers_rate() {
  for (size_t i = 0; i < _esp_now_peers.size(); i++) {
    ESP_NOW_Peer* peer = _esp_now_peers[i];
    log_v("Setting PHY rate for peer " MACSTR, MAC2STR(peer->addr()));
    esp_now_rate_config_t rate = peer->getRate();
    esp_err_t err = esp_now_set_peer_rate_config(peer->addr(), &rate);
    if (err != ESP_OK) {
      log_e("Failed to set rate for peer " MACSTR, MAC2STR(peer->addr()));
      return err;
    }
  }
  return ESP_OK;
}
#else
esp_err_t _esp_now_set_all_peers_rate() {
  return ESP_OK;
}
#endif

ESP_NOW_Class::ESP_NOW_Class() {
  max_data_len = 0;
  version = 0;
}

ESP_NOW_Class::~ESP_NOW_Class() {}

bool ESP_NOW_Class::begin(const uint8_t* pmk) {
  if (_esp_now_has_begun) {
    return true;
  }

  esp_err_t err = esp_wifi_start();
  if (err != ESP_OK) {
    log_e("WiFi not started! 0x%x)", err);
    return false;
  }

  // Unfortunately we can't get the ESP-NOW version before initializing the Wi-Fi
  uint32_t esp_now_version;
  err = esp_now_get_version(&esp_now_version);
  if (err != ESP_OK) {
    log_w("esp_now_get_version failed! Assuming ESP-NOW v1.0");
    esp_now_version = 1;
  }

  if (esp_now_version == 1) {
    max_data_len = ESP_NOW_MAX_DATA_LEN;
  } else {
    max_data_len = ESP_NOW_MAX_DATA_LEN_V2;
  }

  version = esp_now_version;
  log_i("ESP-NOW version: %" PRIu32 ", max_data_len: %lu", (unsigned long)version, max_data_len);

  _esp_now_has_begun = true;

  portENTER_CRITICAL(&_peers_mux);
  _esp_now_peers.clear();
  portEXIT_CRITICAL(&_peers_mux);

  err = esp_now_init();
  if (err != ESP_OK) {
    log_e("esp_now_init failed! 0x%x", err);
    _esp_now_has_begun = false;
    return false;
  }

  // Set the peers PHY rate after initializing ESP-NOW.
  err = _esp_now_set_all_peers_rate();
  if (err != ESP_OK) {
    log_e("Failed to set PHY rate for peers! 0x%x", err);
    _esp_now_has_begun = false;
    return false;
  }

  if (pmk) {
    err = esp_now_set_pmk(pmk);
    if (err != ESP_OK) {
      log_e("esp_now_set_pmk failed! 0x%x", err);
      _esp_now_has_begun = false;
      return false;
    }
  }

  err = esp_now_register_recv_cb(_esp_now_rx_cb);
  if (err != ESP_OK) {
    log_e("esp_now_register_recv_cb failed! 0x%x", err);
    _esp_now_has_begun = false;
    return false;
  }

  err = esp_now_register_send_cb(_esp_now_tx_cb);
  if (err != ESP_OK) {
    log_e("esp_now_register_send_cb failed! 0x%x", err);
    _esp_now_has_begun = false;
    return false;
  }
  return true;
}

bool ESP_NOW_Class::end() {
  if (!_esp_now_has_begun) {
    return true;
  }
  // remove all peers safely while erase_unordered shrinks _esp_now_peers
  while (!_esp_now_peers.empty()) {
    ESP_NOW_Peer* peer = _esp_now_peers.back();
    if (!removePeer(*peer)) {
      portENTER_CRITICAL(&_peers_mux);
      _esp_now_peers.pop_back();
      portEXIT_CRITICAL(&_peers_mux);
    }
  }
  esp_err_t err = esp_now_deinit();
  if (err != ESP_OK) {
    log_e("esp_now_deinit failed! 0x%x", err);
    return false;
  }
  _esp_now_has_begun = false;
  portENTER_CRITICAL(&_peers_mux);
  _esp_now_peers.clear();
  portEXIT_CRITICAL(&_peers_mux);
  return true;
}

int ESP_NOW_Class::getTotalPeerCount() const {
  if (!_esp_now_has_begun) {
    log_e("ESP-NOW not initialized");
    return -1;
  }
  esp_now_peer_num_t num;
  esp_err_t err = esp_now_get_peer_num(&num);
  if (err != ESP_OK) {
    log_e("esp_now_get_peer_num failed! 0x%x", err);
    return -1;
  }
  return num.total_num;
}

int ESP_NOW_Class::getEncryptedPeerCount() const {
  if (!_esp_now_has_begun) {
    log_e("ESP-NOW not initialized");
    return -1;
  }
  esp_now_peer_num_t num;
  esp_err_t err = esp_now_get_peer_num(&num);
  if (err != ESP_OK) {
    log_e("esp_now_get_peer_num failed! 0x%x", err);
    return -1;
  }
  return num.encrypt_num;
}

// getMaxDataLen(), getVersion(), availableForWrite() are FORCE_INLINE in ESP32_NOW.h

HOT_PATH size_t ESP_NOW_Class::write(const uint8_t* data, size_t len) {
  if (UNLIKELY(!_esp_now_has_begun)) {
    log_e("ESP-NOW not initialized. Please call begin() first to send data.");
    return 0;
  }
  if (len > max_data_len) {
    len = max_data_len;
  }
  esp_err_t result = esp_now_send(nullptr, data, len);
  if (LIKELY(result == ESP_OK)) {
    return len;
  }
  _esp_now_log_error("Broadcast send", result);
  return 0;
}

void ESP_NOW_Class::onNewPeer(ESP_NOW_NewPeerCb cb) {
  _new_peer_cb = cb;
}

void ESP_NOW_Class::onNewPeer(void (*cb)(const esp_now_recv_info_t* info, const uint8_t* data, int len, void* arg),
                              void* arg) {
  if (cb != nullptr) {
    _new_peer_cb = [cb, arg](const esp_now_recv_info_t* info, const uint8_t* data, int len) {
      cb(info, data, len, arg);
    };
  } else {
    _new_peer_cb = nullptr;
  }
}

bool ESP_NOW_Class::removePeer(ESP_NOW_Peer& peer) {
  return peer.remove();
}

ESP_NOW_Class ESP_NOW;

/*
 *
 *    Inheritable Peer Class
 *
 */

#if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 0, 0)
ESP_NOW_Peer::ESP_NOW_Peer(const uint8_t* mac_addr, uint8_t channel, wifi_interface_t iface, const uint8_t* lmk,
                           esp_now_rate_config_t* rate_config) {
#else
ESP_NOW_Peer::ESP_NOW_Peer(const uint8_t* mac_addr, uint8_t channel, wifi_interface_t iface, const uint8_t* lmk) {
#endif
  added = false;
  if (mac_addr) {
    memcpy(mac, mac_addr, 6);
  }
  chan = channel;
  ifc = iface;
  encrypt = lmk != nullptr;
  if (encrypt) {
    memcpy(key, lmk, 16);
  }
#if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 0, 0)
  if (rate_config) {
    rate = *rate_config;
  } else {
    rate = DEFAULT_ESPNOW_RATE_CONFIG;
  }
#endif
}

bool ESP_NOW_Peer::add() {
  if (!_esp_now_has_begun) {
    return false;
  }
  if (added) {
    return true;
  }
#if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 0, 0)
  if (_esp_now_add_peer(mac, chan, ifc, encrypt ? key : nullptr, &rate, this) != ESP_OK) {
#else
  if (_esp_now_add_peer(mac, chan, ifc, encrypt ? key : nullptr, this) != ESP_OK) {
#endif
    log_e("Failed to add peer " MACSTR, MAC2STR(mac));
    return false;
  }
  log_v("Peer added - " MACSTR, MAC2STR(mac));
  added = true;
  return true;
}

bool ESP_NOW_Peer::remove() {
  if (!_esp_now_has_begun) {
    return false;
  }
  if (!added) {
    return true;
  }
  log_i("Removing peer - " MACSTR, MAC2STR(mac));
  esp_err_t err = _esp_now_del_peer(mac);
  if (err == ESP_OK) {
    added = false;
    log_i("Peer removed - " MACSTR, MAC2STR(mac));
    return true;
  }

  log_e("Failed to remove peer " MACSTR, MAC2STR(mac));
  return false;
}

// ESP_NOW_Peer::addr() const, getChannel(), getInterface(), isEncrypted(), operator bool() are FORCE_INLINE in
// ESP32_NOW.h

bool ESP_NOW_Peer::addr(const uint8_t* mac_addr) {
  if (!_esp_now_has_begun || !added) {
    memcpy(mac, mac_addr, 6);
    return true;
  }
  log_e("Peer already added and ESP-NOW is already running. Cannot change the MAC address.");
  log_e("Please call addr() before adding the peer or before starting ESP-NOW.");
  return false;
}

bool ESP_NOW_Peer::setChannel(uint8_t channel) {
  chan = channel;
  if (!_esp_now_has_begun || !added) {
    return true;
  }
  return _esp_now_modify_peer(mac, chan, ifc, encrypt ? key : nullptr) == ESP_OK;
}

bool ESP_NOW_Peer::setInterface(wifi_interface_t iface) {
  ifc = iface;
  if (!_esp_now_has_begun || !added) {
    return true;
  }
  return _esp_now_modify_peer(mac, chan, ifc, encrypt ? key : nullptr) == ESP_OK;
}

#if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 0, 0)
/**
 * @brief Set the rate configuration for the peer.
 *
 * @param rate_config Pointer to the rate configuration to set. Nullptr to reset to default rate configuration.
 * @return true if the rate configuration was set successfully, false otherwise.
 */
bool ESP_NOW_Peer::setRate(const esp_now_rate_config_t* rate_config) {
  if (added && _esp_now_has_begun) {
    log_e("Peer already added and ESP-NOW is already running. Cannot set rate configuration.");
    log_e("Please call setRate() before adding the peer or before starting ESP-NOW.");
    return false;
  }

  if (rate_config == nullptr) {
    log_i("Resetting rate configuration to default.");
    rate = DEFAULT_ESPNOW_RATE_CONFIG;
  } else {
    rate = *rate_config;
  }

  return true;
}

/**
 * @brief Get the rate configuration for the peer.
 *
 * @return esp_now_rate_config_t The rate configuration for the peer.
 */
esp_now_rate_config_t ESP_NOW_Peer::getRate() const {
  return rate;
}
#endif

bool ESP_NOW_Peer::setKey(const uint8_t* lmk) {
  encrypt = lmk != nullptr;
  if (encrypt) {
    memcpy(key, lmk, 16);
  }
  if (!_esp_now_has_begun || !added) {
    return true;
  }
  return _esp_now_modify_peer(mac, chan, ifc, encrypt ? key : nullptr) == ESP_OK;
}

HOT_PATH size_t ESP_NOW_Peer::send(const uint8_t* data, int len) {
  log_v(MACSTR ", data length %d", MAC2STR(mac), len);
  if (UNLIKELY(!_esp_now_has_begun || !added)) {
    log_e("Peer not added.");
    return 0;
  }

  int max_data_len = ESP_NOW.getMaxDataLen();
  if (UNLIKELY(max_data_len < 0)) {
    log_e("Error getting max data length.");
    return 0;
  }

  if (len > max_data_len) {
    len = max_data_len;
  }
  esp_err_t result = esp_now_send(mac, data, len);
  if (LIKELY(result == ESP_OK)) {
    return len;
  }
  _esp_now_log_error("Send", result);
  return 0;
}

#endif
