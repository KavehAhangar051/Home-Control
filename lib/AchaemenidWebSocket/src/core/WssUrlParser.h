#pragma once

#include <cstddef>
#include <cstdlib>
#include <cstring>

namespace uniuno {

struct ParsedWssUrl {
  char host[96]{};
  int port = 443;
  char path[128]{};
};

/**
 * @brief Zero-heap parser for wss:// and https:// WebSocket endpoint URLs.
 * Avoids Arduino String allocations inside the TLS connection FreeRTOS task.
 */
inline bool parseWssUrl(const char* rawUrl, ParsedWssUrl& out) {
  out.host[0] = '\0';
  out.port = 443;
  out.path[0] = '/';
  out.path[1] = '\0';

  if (rawUrl == nullptr) return false;

  const char* cursor = nullptr;
  if (std::strncmp(rawUrl, "wss://", 6) == 0) {
    cursor = rawUrl + 6;
  } else if (std::strncmp(rawUrl, "https://", 8) == 0) {
    cursor = rawUrl + 8;
  } else {
    return false;
  }

  const char* slash = std::strchr(cursor, '/');
  const char* authorityEnd = (slash != nullptr) ? slash : (cursor + std::strlen(cursor));

  if (slash != nullptr) {
    const size_t pathLen = std::strlen(slash);
    if (pathLen >= sizeof(out.path)) return false;
    std::memcpy(out.path, slash, pathLen + 1);
  }

  const char* colon = nullptr;
  for (const char* p = cursor; p < authorityEnd; ++p) {
    if (*p == ':') {
      colon = p;
      break;
    }
  }

  const char* hostEnd = (colon != nullptr) ? colon : authorityEnd;
  const size_t hostLen = static_cast<size_t>(hostEnd - cursor);
  if (hostLen == 0 || hostLen >= sizeof(out.host)) return false;

  std::memcpy(out.host, cursor, hostLen);
  out.host[hostLen] = '\0';

  if (colon != nullptr) {
    const char* portStart = colon + 1;
    const size_t portLen = static_cast<size_t>(authorityEnd - portStart);
    if (portLen > 0 && portLen < 12) {
      char portBuf[12];
      std::memcpy(portBuf, portStart, portLen);
      portBuf[portLen] = '\0';
      char* endPtr = nullptr;
      const long parsed = std::strtol(portBuf, &endPtr, 10);
      if (endPtr == portBuf + portLen && parsed > 0 && parsed <= 65535) {
        out.port = static_cast<int>(parsed);
      }
    }
  }

  return true;
}

} // namespace uniuno
