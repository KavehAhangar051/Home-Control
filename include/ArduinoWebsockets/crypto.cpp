#include <tiny_websockets/internals/wscrypto/crypto.hpp>
#include <tiny_websockets/internals/wscrypto/base64.hpp>

#ifdef ESP32
#include <esp_idf_version.h>
#include <mbedtls/sha1.h>
#else
#include <tiny_websockets/internals/wscrypto/sha1.hpp>
#endif

#ifndef _WS_CONFIG_NO_TRUE_RANDOMNESS
#include <time.h>
#endif

namespace websockets {
namespace crypto {
WSString base64Encode(WSString data) {
  return internals::base64_encode(reinterpret_cast<const uint8_t*>(data.c_str()), data.size());
}
WSString base64Encode(uint8_t* data, size_t len) {
  return internals::base64_encode(reinterpret_cast<const uint8_t*>(data), len);
}

WSString base64Decode(WSString data) {
  return internals::base64_decode(data);
}

WSString websocketsHandshakeEncodeKey(WSString key) {
#ifdef ESP32
  static constexpr char kWsGuid[] = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
  uint8_t digest[20];
  mbedtls_sha1_context ctx;
  mbedtls_sha1_init(&ctx);
#if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 0, 0)
  mbedtls_sha1_starts(&ctx);
  mbedtls_sha1_update(&ctx, reinterpret_cast<const unsigned char*>(key.c_str()), key.size());
  mbedtls_sha1_update(&ctx, reinterpret_cast<const unsigned char*>(kWsGuid), sizeof(kWsGuid) - 1);
  mbedtls_sha1_finish(&ctx, digest);
#else
  mbedtls_sha1_starts_ret(&ctx);
  mbedtls_sha1_update_ret(&ctx, reinterpret_cast<const unsigned char*>(key.c_str()), key.size());
  mbedtls_sha1_update_ret(&ctx, reinterpret_cast<const unsigned char*>(kWsGuid), sizeof(kWsGuid) - 1);
  mbedtls_sha1_finish_ret(&ctx, digest);
#endif
  mbedtls_sha1_free(&ctx);
  return internals::base64_encode(digest, sizeof(digest));
#else
  char base64[30];
  internals::sha1(key.c_str()).add("258EAFA5-E914-47DA-95CA-C5AB0DC85B11").finalize().print_base64(base64);

  return WSString(base64);
#endif
}

#ifdef _WS_CONFIG_NO_TRUE_RANDOMNESS
WSString randomBytes(size_t len) {
  WSString result;
  result.reserve(len);

  for (size_t i = 0; i < len; i++) {
    result += "0123456789abcdef"[i % 16];
  }

  return result;
}
#else
WSString randomBytes(size_t len) {
#if defined(ESP32)
  static const char charset[] = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  WSString result;
  result.resize(len);
  for (size_t i = 0; i < len; i++) {
    result[i] = charset[esp_random() % (sizeof(charset) - 1)];
  }
  return result;
#else
  static int onlyOnce = []() {
    srand(time(NULL));
    return 0;
  }();

  WSString result;
  result.reserve(len);

  for (size_t i = onlyOnce; i < len; i++) {
    result += "0123456789abcdefABCDEFGHIJKLMNOPQRSTUVEXYZ"[rand() % 42];
  }
  return result;
#endif
}
#endif
} // namespace crypto
} // namespace websockets