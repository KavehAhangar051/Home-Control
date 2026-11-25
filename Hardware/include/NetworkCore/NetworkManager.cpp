/*
 * SPDX-FileCopyrightText: 2023 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

#include "Arduino.h"
#include "NetworkManager.h"
#include "IPAddress.h"
#include "esp_netif.h"
#include "lwip/dns.h"
#include "esp_mac.h"
#include "netdb.h"
#include <freertos/FreeRTOS.h>
#include <freertos/portmacro.h>

// Memory-for-Speed: Compact 4-slot IPv4 DNS cache (60s TTL) eliminates repeated
// blocking lwip_getaddrinfo() UDP lookups during WSS/MQTT/HTTP reconnect bursts.
static constexpr size_t kDnsCacheSlots = 4;
static constexpr uint32_t kDnsCacheTtlMs = 60000UL;
struct DnsCacheEntry {
  char host[64];
  uint32_t ipv4;
  uint32_t timestampMs;
  bool valid;
};
static DnsCacheEntry s_dnsCache[kDnsCacheSlots] = {};
static uint8_t s_dnsCacheNext = 0;
static portMUX_TYPE s_dnsCacheMux = portMUX_INITIALIZER_UNLOCKED;

NetworkManager::NetworkManager() {}

NetworkInterface *getNetifByID(Network_Interface_ID id);

bool NetworkManager::begin() {
  static bool initialized = false;
  if (!initialized) {
    initialized = true;
#if CONFIG_IDF_TARGET_ESP32
    uint8_t mac[8];
    if (esp_base_mac_addr_get(mac) != ESP_OK && esp_efuse_mac_get_default(mac) == ESP_OK) {
      esp_base_mac_addr_set(mac);
    }
#endif
    initialized = esp_netif_init() == ESP_OK;
    if (!initialized) {
      log_e("esp_netif_init failed!");
    }
  }
  if (initialized) {
    initNetworkEvents();
  }
  return initialized;
}

/**
 * Resolve the given hostname to an IP address.
 * @param aHostname     Name to be resolved
 * @param aResult       IPAddress structure to store the returned IP address
 * @return 1 if aIPAddrString was successfully converted to an IP address,
 *          else error code
 */
int NetworkManager::hostByName(const char *aHostname, IPAddress &aResult) {
  static bool hasGlobalV6 = false;
  static bool hasGlobalV4 = false;
  err_t err = ERR_OK;
  const char *servname = "0";
  struct addrinfo *res;

  aResult = static_cast<uint32_t>(0);

  // First check if the host parses as a literal address
  if (aResult.fromString(aHostname)) {
    return 1;
  }

  // This should generally check if we have a global address assigned to one of the interfaces.
  // If such address is not assigned, there is no point in trying to get V6 from DNS as we will not be able to reach it.
  bool hasGlobalV6Now = false;
  bool hasGlobalV4Now = false;
  for (int i = 0; i < ESP_NETIF_ID_MAX; ++i) {
    NetworkInterface *iface = getNetifByID((Network_Interface_ID)i);
    if (iface != NULL) {
      if (iface->hasGlobalIPv6()) {
        hasGlobalV6Now = true;
      }
      if (iface->hasIP()) {
        hasGlobalV4Now = true;
      }
    }
    if (hasGlobalV6Now && hasGlobalV4Now) {
      break;
    }
  }

  // If the state of IP addresses has changed, clear the DNS cache
  if (hasGlobalV6 != hasGlobalV6Now || hasGlobalV4 != hasGlobalV4Now) {
    hasGlobalV6 = hasGlobalV6Now;
    hasGlobalV4 = hasGlobalV4Now;
    dns_clear_cache();
    portENTER_CRITICAL(&s_dnsCacheMux);
    for (size_t i = 0; i < kDnsCacheSlots; ++i) {
      s_dnsCache[i].valid = false;
    }
    portEXIT_CRITICAL(&s_dnsCacheMux);
    log_d("Clearing DNS cache");
  }

  const size_t hostLen = (aHostname != nullptr) ? strlen(aHostname) : 0;
  const uint32_t nowMs = millis();
  if (!hasGlobalV6Now && hostLen > 0 && hostLen < sizeof(s_dnsCache[0].host)) {
    portENTER_CRITICAL(&s_dnsCacheMux);
    for (size_t i = 0; i < kDnsCacheSlots; ++i) {
      if (s_dnsCache[i].valid &&
          static_cast<uint32_t>(nowMs - s_dnsCache[i].timestampMs) < kDnsCacheTtlMs &&
          strcmp(s_dnsCache[i].host, aHostname) == 0) {
        aResult = IPAddress(s_dnsCache[i].ipv4);
        portEXIT_CRITICAL(&s_dnsCacheMux);
        return 1;
      }
    }
    portEXIT_CRITICAL(&s_dnsCacheMux);
  }

  struct addrinfo hints;
  memset(&hints, 0, sizeof(hints));
  hints.ai_socktype = SOCK_STREAM;

#if CONFIG_LWIP_IPV6
  // **Workaround**
  // LWIP AF_UNSPEC always prefers IPv4 and doesn't check what network is
  // available. See https://github.com/espressif/esp-idf/issues/13255
  // Until that is fixed, as a work around if we have a global scope IPv6,
  // then we check IPv6 only first.
  if (hasGlobalV6) {
    hints.ai_family = AF_INET6;
    err = lwip_getaddrinfo(aHostname, servname, &hints, &res);

    if (err == ERR_OK) {
      struct sockaddr_in6 *ipv6 = (struct sockaddr_in6 *)res->ai_addr;
      // As an array of u8_t
      aResult = IPAddress(IPv6, ipv6->sin6_addr.s6_addr);
      log_d("DNS found IPv6 first %s", aResult.toString().c_str());
      lwip_freeaddrinfo(res);
      return 1;
    }
  }
  // **End Workaround**
#endif

  hints.ai_family = AF_UNSPEC;
  err = lwip_getaddrinfo(aHostname, servname, &hints, &res);

  if (err == ERR_OK) {
#if CONFIG_LWIP_IPV6
    if (res->ai_family == AF_INET6) {
      struct sockaddr_in6 *ipv6 = (struct sockaddr_in6 *)res->ai_addr;
      // As an array of u8_t
      aResult = IPAddress(IPv6, ipv6->sin6_addr.s6_addr);
      log_d("DNS found IPv6 %s", aResult.toString().c_str());
    } else {
#endif
      struct sockaddr_in *ipv4 = (struct sockaddr_in *)res->ai_addr;
      // As a single u32_t
      const uint32_t resolvedAddr = ipv4->sin_addr.s_addr;
      aResult = IPAddress(resolvedAddr);
      if (hostLen > 0 && hostLen < sizeof(s_dnsCache[0].host) && resolvedAddr != 0) {
        portENTER_CRITICAL(&s_dnsCacheMux);
        size_t slot = s_dnsCacheNext;
        for (size_t i = 0; i < kDnsCacheSlots; ++i) {
          if (!s_dnsCache[i].valid || strcmp(s_dnsCache[i].host, aHostname) == 0) {
            slot = i;
            break;
          }
        }
        memcpy(s_dnsCache[slot].host, aHostname, hostLen + 1);
        s_dnsCache[slot].ipv4 = resolvedAddr;
        s_dnsCache[slot].timestampMs = millis();
        s_dnsCache[slot].valid = true;
        if (slot == s_dnsCacheNext) {
          s_dnsCacheNext = (s_dnsCacheNext + 1) % kDnsCacheSlots;
        }
        portEXIT_CRITICAL(&s_dnsCacheMux);
      }
      log_d("DNS found IPv4 %s", aResult.toString().c_str());
#if CONFIG_LWIP_IPV6
    }
#endif

    lwip_freeaddrinfo(res);
    return 1;
  }

  log_e("DNS Failed for '%s' with error '%d'", aHostname, err);
  return err;
}

uint8_t *NetworkManager::macAddress(uint8_t *mac) {
  esp_base_mac_addr_get(mac);
  return mac;
}

String NetworkManager::macAddress(void) {
  uint8_t mac[6];
  char macStr[18] = {0};
  macAddress(mac);
  snprintf(macStr, sizeof(macStr), "%02X:%02X:%02X:%02X:%02X:%02X", mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  return String(macStr);
}

static char default_hostname[32] = {
  0,
};

const char *NetworkManager::getHostname() {
  if (default_hostname[0] == 0) {
    uint8_t eth_mac[6];
    esp_base_mac_addr_get(eth_mac);
    snprintf(default_hostname, 32, "%s%02X%02X%02X", CONFIG_IDF_TARGET "-", eth_mac[3], eth_mac[4], eth_mac[5]);
  }
  return (const char *)default_hostname;
}

bool NetworkManager::setHostname(const char *name) {
  if (name) {
    snprintf(default_hostname, 32, "%s", name);
  }
  return true;
}

bool NetworkManager::setDefaultInterface(NetworkInterface &ifc) {
  return ifc.setDefault();
}

NetworkInterface *NetworkManager::getDefaultInterface() {
  #if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 0, 0)
  esp_netif_t *netif = esp_netif_get_default_netif();
#else
  esp_netif_t *netif = esp_netif_get_handle_from_ifkey("WIFI_STA_DEF");
#endif
  for (int i = 0; i < ESP_NETIF_ID_MAX; ++i) {
    NetworkInterface *iface = getNetifByID((Network_Interface_ID)i);
    if (iface != NULL && iface->netif() == netif) {
      return iface;
    }
  }
  return NULL;
}

bool NetworkManager::isOnline() {
  for (int i = 0; i < ESP_NETIF_ID_MAX; ++i) {
    if (i != ESP_NETIF_ID_AP) {
      NetworkInterface *iface = getNetifByID((Network_Interface_ID)i);
      if (iface != NULL && iface->connected() && (iface->hasIP() || iface->hasGlobalIPv6())) {
        return true;
      }
    }
  }
  return false;
}

size_t NetworkManager::printTo(Print &out) const {
  size_t bytes = 0;

  for (int i = 0; i < ESP_NETIF_ID_MAX; ++i) {
    NetworkInterface *iface = getNetifByID((Network_Interface_ID)i);
    if (iface != NULL && iface->netif() != NULL) {
      bytes += out.println(*iface);
    }
  }
  return bytes;
}

NetworkManager Network;
