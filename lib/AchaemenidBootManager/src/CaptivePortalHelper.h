#ifndef CAPTIVE_PORTAL_HELPER_H
#define CAPTIVE_PORTAL_HELPER_H

#include <ProjectConfig.h>
#include <stddef.h>
#include <stdint.h>
#include <string.h>

namespace uniuno {
namespace captive_portal {

constexpr const char* kDefaultMdnsHostname = ACHAEMENID_MDNS_HOSTNAME;
constexpr const char* kDefaultMdnsFqdn = ACHAEMENID_MDNS_HOSTNAME ".local";
constexpr const char* kDefaultPortalUrl = "http://" ACHAEMENID_MDNS_HOSTNAME ".local/";
constexpr const char* kDefaultApIp = ACHAEMENID_AP_IP;
constexpr uint16_t kDnsPort = ACHAEMENID_DNS_PORT;
constexpr uint32_t kDnsTtlSeconds = ACHAEMENID_DNS_TTL_SECONDS;
constexpr unsigned long kDefaultProvisioningIdleRetryMs = ACHAEMENID_PROVISIONING_IDLE_RETRY_MS;

inline char toLowerAscii(char c) {
  return (c >= 'A' && c <= 'Z') ? static_cast<char>(c - 'A' + 'a') : c;
}

inline bool equalsIgnoreCaseN(const char* a, size_t aLen, const char* b) {
  if (a == nullptr || b == nullptr) return false;
  size_t bLen = strlen(b);
  if (aLen != bLen) return false;
  for (size_t i = 0; i < aLen; ++i) {
    if (toLowerAscii(a[i]) != toLowerAscii(b[i])) return false;
  }
  return true;
}

inline bool equalsIgnoreCase(const char* a, const char* b) {
  if (a == nullptr || b == nullptr) return false;
  return equalsIgnoreCaseN(a, strlen(a), b);
}

/**
 * @brief Normalizes a raw hostname into a valid RFC-1123 lowercase mDNS label (without ".local").
 * Falls back to kDefaultMdnsHostname ("achaemenid") if input is empty or invalid.
 */
inline size_t normalizeMdnsHostname(const char* raw, char* out, size_t outSize) {
  if (out == nullptr || outSize == 0) return 0;

  auto writeFallback = [&]() -> size_t {
    size_t len = strlen(kDefaultMdnsHostname);
    if (len >= outSize) len = outSize - 1;
    memcpy(out, kDefaultMdnsHostname, len);
    out[len] = '\0';
    return len;
  };

  if (raw == nullptr) {
    return writeFallback();
  }

  // Trim leading/trailing whitespace
  const char* start = raw;
  while (*start == ' ' || *start == '\t' || *start == '\r' || *start == '\n') {
    ++start;
  }
  size_t rawLen = strlen(start);
  while (rawLen > 0 && (start[rawLen - 1] == ' ' || start[rawLen - 1] == '\t' || start[rawLen - 1] == '\r' ||
                        start[rawLen - 1] == '\n' || start[rawLen - 1] == '.')) {
    --rawLen;
  }

  // Strip optional ".local" suffix (case-insensitive)
  if (rawLen >= 6 && equalsIgnoreCaseN(start + rawLen - 6, 6, ".local")) {
    rawLen -= 6;
  }

  size_t maxLabel = outSize - 1;
  if (maxLabel > 63) maxLabel = 63;

  size_t pos = 0;
  bool lastWasHyphen = false;
  for (size_t i = 0; i < rawLen && pos < maxLabel; ++i) {
    char c = toLowerAscii(start[i]);
    bool isAlnum = (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9');
    if (isAlnum) {
      out[pos++] = c;
      lastWasHyphen = false;
    } else if ((c == '-' || c == '_' || c == ' ') && pos > 0 && !lastWasHyphen) {
      out[pos++] = '-';
      lastWasHyphen = true;
    }
  }

  while (pos > 0 && out[pos - 1] == '-') {
    --pos;
  }

  if (pos == 0) {
    return writeFallback();
  }

  out[pos] = '\0';
  return pos;
}

/**
 * @brief Builds "<hostname>.local" from a normalized mDNS hostname.
 */
inline size_t buildMdnsFqdn(const char* hostname, char* out, size_t outSize) {
  if (out == nullptr || outSize == 0) return 0;
  char clean[64];
  size_t cleanLen = normalizeMdnsHostname(hostname, clean, sizeof(clean));
  static constexpr const char kSuffix[] = ".local";
  static constexpr size_t kSuffixLen = 6;

  size_t pos = 0;
  for (size_t i = 0; i < cleanLen && pos + 1 < outSize; ++i) {
    out[pos++] = clean[i];
  }
  for (size_t i = 0; i < kSuffixLen && pos + 1 < outSize; ++i) {
    out[pos++] = kSuffix[i];
  }
  out[pos] = '\0';
  return pos;
}

/**
 * @brief Builds "http://<hostname>.local/" from a normalized mDNS hostname.
 */
inline size_t buildPortalUrl(const char* hostname, char* out, size_t outSize) {
  if (out == nullptr || outSize == 0) return 0;
  char fqdn[72];
  size_t fqdnLen = buildMdnsFqdn(hostname, fqdn, sizeof(fqdn));
  static constexpr const char kPrefix[] = "http://";
  static constexpr size_t kPrefixLen = 7;

  size_t pos = 0;
  for (size_t i = 0; i < kPrefixLen && pos + 1 < outSize; ++i) {
    out[pos++] = kPrefix[i];
  }
  for (size_t i = 0; i < fqdnLen && pos + 1 < outSize; ++i) {
    out[pos++] = fqdn[i];
  }
  if (pos + 1 < outSize) {
    out[pos++] = '/';
  }
  out[pos] = '\0';
  return pos;
}

/**
 * @brief Returns true if the HTTP request path is a known OS Captive Portal connectivity probe.
 * Covers Android, iOS, macOS, Windows, Firefox, and Linux NetworkManager probes.
 */
inline bool isCaptivePortalProbePath(const char* uri) {
  if (uri == nullptr || uri[0] == '\0') return false;

  // Strip query string (?...) before matching
  size_t pathLen = 0;
  while (uri[pathLen] != '\0' && uri[pathLen] != '?') {
    ++pathLen;
  }

  static constexpr const char* kProbePaths[] = {"/generate_204",
                                                "/gen_204",
                                                "/hotspot-detect.html",
                                                "/library/test/success.html",
                                                "/success.html",
                                                "/connecttest.txt",
                                                "/ncsi.txt",
                                                "/redirect",
                                                "/fwlink",
                                                "/canonical.html",
                                                "/success.txt",
                                                "/wpad.dat",
                                                "/mobile/status.php",
                                                "/check_network_status.txt"};

  for (size_t i = 0; i < sizeof(kProbePaths) / sizeof(kProbePaths[0]); ++i) {
    if (equalsIgnoreCaseN(uri, pathLen, kProbePaths[i])) {
      return true;
    }
  }
  return false;
}

/**
 * @brief Checks if an HTTP Host header belongs to our provisioning portal (mDNS FQDN or SoftAP IP).
 * Strips optional ":port" suffix and compares case-insensitively.
 */
inline bool isPortalHost(const char* hostHeader, const char* mdnsFqdn, const char* apIp) {
  if (hostHeader == nullptr || hostHeader[0] == '\0') return false;

  // Trim leading spaces
  while (*hostHeader == ' ' || *hostHeader == '\t') {
    ++hostHeader;
  }

  // Find length up to optional ':port' or trailing whitespace
  size_t hostLen = 0;
  while (hostHeader[hostLen] != '\0' && hostHeader[hostLen] != ':' && hostHeader[hostLen] != ' ' &&
         hostHeader[hostLen] != '\t') {
    ++hostLen;
  }

  // Strip optional trailing dot (DNS FQDN notation, e.g. "achaemenid.local.")
  while (hostLen > 0 && hostHeader[hostLen - 1] == '.') {
    --hostLen;
  }

  if (hostLen == 0) return false;

  if (mdnsFqdn != nullptr && mdnsFqdn[0] != '\0' && equalsIgnoreCaseN(hostHeader, hostLen, mdnsFqdn)) {
    return true;
  }
  if (apIp != nullptr && apIp[0] != '\0' && equalsIgnoreCaseN(hostHeader, hostLen, apIp)) {
    return true;
  }
  return false;
}

/**
 * @brief Determines whether an incoming HTTP request in AP provisioning mode should receive
 * a 302 redirect to http://<mdnsFqdn>/ (triggering OS Captive Portal auto-browser popup).
 */
inline bool shouldRedirectToCaptivePortal(const char* hostHeader, const char* uri, const char* mdnsFqdn,
                                          const char* apIp) {
  if (isCaptivePortalProbePath(uri)) {
    return true;
  }
  if (!isPortalHost(hostHeader, mdnsFqdn, apIp)) {
    return true;
  }
  return false;
}

/**
 * @brief Validates a Wi-Fi SSID/password pair according to IEEE 802.11 / WPA2 rules.
 * SSID: 1..32 bytes. Password: 0 bytes (open network) OR 8..63 bytes (WPA/WPA2/WPA3-PSK).
 */
inline bool isValidWifiCredential(const char* ssid, const char* password) {
  if (ssid == nullptr) return false;
  size_t ssidLen = strlen(ssid);
  if (ssidLen == 0 || ssidLen > 32) return false;

  if (password == nullptr) return true;
  size_t passLen = strlen(password);
  if (passLen == 0) return true;
  return passLen >= 8 && passLen <= 63;
}

/**
 * @brief Safely appends JSON-escaped text into a fixed buffer without overflow.
 */
inline bool appendJsonEscaped(char* out, size_t outSize, size_t& pos, const char* text) {
  if (out == nullptr || outSize == 0 || pos >= outSize) return false;
  if (text == nullptr) {
    out[pos] = '\0';
    return true;
  }

  auto pushChar = [&](char c) -> bool {
    if (pos + 1 >= outSize) return false;
    out[pos++] = c;
    return true;
  };

  bool complete = true;
  for (const char* p = text; *p != '\0'; ++p) {
    unsigned char uc = static_cast<unsigned char>(*p);
    if (uc == '\"' || uc == '\\') {
      if (!pushChar('\\') || !pushChar(static_cast<char>(uc))) {
        complete = false;
        break;
      }
    } else if (uc == '\n') {
      if (!pushChar('\\') || !pushChar('n')) {
        complete = false;
        break;
      }
    } else if (uc == '\r') {
      if (!pushChar('\\') || !pushChar('r')) {
        complete = false;
        break;
      }
    } else if (uc == '\t') {
      if (!pushChar('\\') || !pushChar('t')) {
        complete = false;
        break;
      }
    } else if (uc < 0x20) {
      // Skip other control characters to keep JSON strictly valid
      continue;
    } else {
      if (!pushChar(static_cast<char>(uc))) {
        complete = false;
        break;
      }
    }
  }
  out[pos] = '\0';
  return complete;
}

/**
 * @brief Safely appends HTML-escaped text into a fixed buffer (prevents XSS in prefilled SSIDs).
 */
inline bool appendHtmlEscaped(char* out, size_t outSize, size_t& pos, const char* text) {
  if (out == nullptr || outSize == 0 || pos >= outSize) return false;
  if (text == nullptr) {
    out[pos] = '\0';
    return true;
  }

  auto pushStr = [&](const char* s) -> bool {
    size_t len = strlen(s);
    if (pos + len >= outSize) return false;
    memcpy(out + pos, s, len);
    pos += len;
    return true;
  };

  bool complete = true;
  for (const char* p = text; *p != '\0'; ++p) {
    switch (*p) {
    case '&':
      complete = pushStr("&amp;");
      break;
    case '<':
      complete = pushStr("&lt;");
      break;
    case '>':
      complete = pushStr("&gt;");
      break;
    case '"':
      complete = pushStr("&quot;");
      break;
    case '\'':
      complete = pushStr("&#39;");
      break;
    default:
      if (pos + 1 >= outSize) {
        complete = false;
      } else {
        out[pos++] = *p;
      }
      break;
    }
    if (!complete) break;
  }
  out[pos] = '\0';
  return complete;
}

/**
 * @brief Decides whether an idle provisioning AP should automatically retry saved Wi-Fi networks.
 * Uses unsigned subtraction so 32-bit millis() wraparound after ~49.7 days is handled safely.
 */
inline bool shouldAutoRetrySavedWifiFromProvisioning(bool hasSavedWifi, uint8_t connectedClients, unsigned long nowMs,
                                                     unsigned long lastActivityMs, unsigned long idleTimeoutMs) {
  if (!hasSavedWifi) return false;
  if (connectedClients > 0) return false;
  if (idleTimeoutMs == 0) return false;
  const uint32_t elapsedMs = static_cast<uint32_t>(nowMs) - static_cast<uint32_t>(lastActivityMs);
  return elapsedMs >= static_cast<uint32_t>(idleTimeoutMs);
}

} // namespace captive_portal
} // namespace uniuno

#endif // CAPTIVE_PORTAL_HELPER_H
