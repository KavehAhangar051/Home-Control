#pragma once

#include "sdkconfig.h"
#if CONFIG_ESP_HOSTED_ENABLED
#warning "ESP-NOW is only supported in SoCs with native Wi-Fi support"
#else

#include "esp_wifi_types.h"
#include "Print.h"
#include "esp_now.h"
#include "esp32-hal-log.h"
#include "esp_mac.h"
#include "esp_idf_version.h"
#include <Optimization/FastFunction.h>
#include <Optimization/SmallVector.h>
#include <Optimization/CompilerTraits.h>

#if ESP_IDF_VERSION < ESP_IDF_VERSION_VAL(5, 0, 0)
typedef struct {
  uint8_t *src_addr;
  uint8_t *des_addr;
} esp_now_recv_info_t;
#else
// clang-format off
#define DEFAULT_ESPNOW_RATE_CONFIG { \
  .phymode = WIFI_PHY_MODE_11G,      \
  .rate = WIFI_PHY_RATE_1M_L,        \
  .ersu = false,                     \
  .dcm = false                       \
}
// clang-format on
#endif

class ESP_NOW_Peer;  //forward declaration for friend function

/**
 * @brief Zero-heap SBO callback type for newly discovered peers (48B inline SBO / 64B struct).
 */
typedef uniuno::FastFunction<void(const esp_now_recv_info_t *info, const uint8_t *data, int len), 48> ESP_NOW_NewPeerCb;

class ESP_NOW_Class : public Print {
public:
  const uint8_t BROADCAST_ADDR[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

  ESP_NOW_Class();
  ~ESP_NOW_Class();

  bool begin(const uint8_t *pmk = nullptr /* 16 bytes */);
  bool end();

  int getTotalPeerCount() const;
  int getEncryptedPeerCount() const;
  FORCE_INLINE int getMaxDataLen() const {
    return LIKELY(max_data_len > 0) ? static_cast<int>(max_data_len) : -1;
  }
  FORCE_INLINE int getVersion() const {
    return LIKELY(version > 0) ? static_cast<int>(version) : -1;
  }

  FORCE_INLINE int availableForWrite() {
    return static_cast<int>(max_data_len);
  }

  // You can directly send data to all peers without broadcasting using ESP_NOW.write(data, len)
  size_t write(const uint8_t *data, size_t len);
  size_t write(uint8_t data) {
    return write(&data, 1);
  }

  void onNewPeer(void (*cb)(const esp_now_recv_info_t *info, const uint8_t *data, int len, void *arg), void *arg);
  void onNewPeer(ESP_NOW_NewPeerCb cb);
  bool removePeer(ESP_NOW_Peer &peer);

protected:
  size_t max_data_len;
  uint32_t version;
};

class ESP_NOW_Peer {
private:
  uint8_t mac[6];
  uint8_t chan;
  wifi_interface_t ifc;
#if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 0, 0)
  esp_now_rate_config_t rate;
#endif
  bool encrypt;
  uint8_t key[16];

protected:
  bool added;
  bool add();
  bool remove();
  size_t send(const uint8_t *data, int len);

#if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 0, 0)
  ESP_NOW_Peer(
    const uint8_t *mac_addr, uint8_t channel = 0, wifi_interface_t iface = WIFI_IF_AP, const uint8_t *lmk = nullptr,
    esp_now_rate_config_t *rate_config = nullptr
  );
#else
  ESP_NOW_Peer(
    const uint8_t *mac_addr, uint8_t channel = 0, wifi_interface_t iface = WIFI_IF_AP, const uint8_t *lmk = nullptr
  );
#endif

public:
  virtual ~ESP_NOW_Peer() {}

  FORCE_INLINE const uint8_t *addr() const { return mac; }
  bool addr(const uint8_t *mac_addr);

  FORCE_INLINE uint8_t getChannel() const { return chan; }
  bool setChannel(uint8_t channel);

  FORCE_INLINE wifi_interface_t getInterface() const { return ifc; }
  bool setInterface(wifi_interface_t iface);

#if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 0, 0)
  bool setRate(const esp_now_rate_config_t *rate_config);
  esp_now_rate_config_t getRate() const;
#endif

  FORCE_INLINE bool isEncrypted() const { return encrypt; }
  bool setKey(const uint8_t *lmk);

  FORCE_INLINE operator bool() const { return added; }

  //optional callbacks to be implemented by the upper class
  virtual void onReceive(const uint8_t *data, size_t len, bool broadcast) {
    log_i("Received %lu bytes from " MACSTR " %s", (unsigned long)len, MAC2STR(mac), broadcast ? "(broadcast)" : "");
  }

  virtual void onSent(bool success) {
    log_i("Message transmission to peer " MACSTR " %s", MAC2STR(mac), success ? "successful" : "failed");
  }

  friend bool ESP_NOW_Class::removePeer(ESP_NOW_Peer &);
};

#if !defined(NO_GLOBAL_INSTANCES) && !defined(NO_GLOBAL_ESP_NOW)
extern ESP_NOW_Class ESP_NOW;
#endif

#endif
