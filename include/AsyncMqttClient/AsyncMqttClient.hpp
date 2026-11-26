/**
 * @file AsyncMqttClient.hpp
 * @brief High-performance, zero-heap asynchronous MQTT 3.1.1 client for ESP32.
 * @author uniuno
 *
 * ARCHITECTURE HIGHLIGHTS:
 *   - Zero Heap Fragmentation: In-situ placement new buffer (_packetStorage) for all incoming packets.
 *   - Zero std::function Overhead: FastFunction with 64-byte SBO directly invoked without heap allocation.
 *   - Zero std::vector Heap Traffic: SmallVector inline buffers for callbacks and pending ACKs.
 *   - Hardware Accelerated: Xtensa LX6 assembly and branchless bitwise state machines.
 *   - Flash Minimized: Consolidated duplicate ACK packet classes and batched packet transmission.
 */

#pragma once

#include <Optimization/SmallVector.h>
#include <Optimization/FastFunction.h>
#include <Optimization/CompilerTraits.h>

#include "Arduino.h"

#ifdef ESP32
#include <AsyncTCP.h>
#include <freertos/semphr.h>
#elif defined(ESP8266)
#include <ESPAsyncTCP.h>
#elif defined(USE_RP2040)
#include <AsyncTCP_RP2040W.h>
#elif defined(LIBRETINY)
#include <AsyncTCP.h>
#include <semphr.h>
#else
#error Platform not supported
#endif

#if ASYNC_TCP_SSL_ENABLED
#include <tcp_axtls.h>
#include <vector>
#define SHA1_SIZE 20
#endif

#include "AsyncMqttClient/Flags.hpp"
#include "AsyncMqttClient/ParsingInformation.hpp"
#include "AsyncMqttClient/MessageProperties.hpp"
#include "AsyncMqttClient/Helpers.hpp"
#include "AsyncMqttClient/Callbacks.hpp"
#include "AsyncMqttClient/DisconnectReasons.hpp"
#include "AsyncMqttClient/Storage.hpp"

#include "AsyncMqttClient/Packets/Packet.hpp"
#include "AsyncMqttClient/Packets/ConnAckPacket.hpp"
#include "AsyncMqttClient/Packets/PingRespPacket.hpp"
#include "AsyncMqttClient/Packets/SubAckPacket.hpp"
#include "AsyncMqttClient/Packets/UnsubAckPacket.hpp"
#include "AsyncMqttClient/Packets/PublishPacket.hpp"
#include "AsyncMqttClient/Packets/PubRelPacket.hpp"
#include "AsyncMqttClient/Packets/PubAckPacket.hpp"
#include "AsyncMqttClient/Packets/PubRecPacket.hpp"
#include "AsyncMqttClient/Packets/PubCompPacket.hpp"

#if defined(ESP32) || defined(LIBRETINY)
#define SEMAPHORE_TAKE(X)                                                                                              \
  if (xSemaphoreTake(_xSemaphore, 1000 / portTICK_PERIOD_MS) != pdTRUE) {                                              \
    return X;                                                                                                          \
  }
#define SEMAPHORE_GIVE() xSemaphoreGive(_xSemaphore);
#elif defined(ESP8266) || defined(USE_RP2040)
#define SEMAPHORE_TAKE(X) void()
#define SEMAPHORE_GIVE() void()
#endif

/**
 * @class AsyncMqttClient
 * @brief Fully asynchronous non-blocking MQTT 3.1.1 client.
 */
class AsyncMqttClient {
public:
  AsyncMqttClient();
  ~AsyncMqttClient();

  // Configuration Builders
  AsyncMqttClient& setKeepAlive(uint16_t keepAlive);
  AsyncMqttClient& setClientId(const char* clientId);
  AsyncMqttClient& setCleanSession(bool cleanSession);
  AsyncMqttClient& setMaxTopicLength(uint16_t maxTopicLength);
  AsyncMqttClient& setCredentials(const char* username, const char* password = nullptr);
  AsyncMqttClient& setWill(const char* topic, uint8_t qos, bool retain, const char* payload = nullptr,
                           size_t length = 0);
  AsyncMqttClient& setServer(IPAddress ip, uint16_t port);
  AsyncMqttClient& setServer(const char* host, uint16_t port);
#if ASYNC_TCP_SSL_ENABLED
  AsyncMqttClient& setSecure(bool secure);
  AsyncMqttClient& addServerFingerprint(const uint8_t* fingerprint);
#endif

  // User Callback Registrations (FastFunction SBO)
  AsyncMqttClient& onConnect(AsyncMqttClientInternals::OnConnectUserCallback callback);
  AsyncMqttClient& onDisconnect(AsyncMqttClientInternals::OnDisconnectUserCallback callback);
  AsyncMqttClient& onSubscribe(AsyncMqttClientInternals::OnSubscribeUserCallback callback);
  AsyncMqttClient& onUnsubscribe(AsyncMqttClientInternals::OnUnsubscribeUserCallback callback);
  AsyncMqttClient& onMessage(AsyncMqttClientInternals::OnMessageUserCallback callback);
  AsyncMqttClient& onPublish(AsyncMqttClientInternals::OnPublishUserCallback callback);

  // Connection Management
  bool connected() const;
  void connect();
  void disconnect(bool force = false);

  // MQTT Protocol Actions
  uint16_t subscribe(const char* topic, uint8_t qos);
  uint16_t unsubscribe(const char* topic);
  uint16_t publish(const char* topic, uint8_t qos, bool retain, const char* payload = nullptr, size_t length = 0,
                   bool dup = false, uint16_t message_id = 0);

  const char* getClientId();

private:
  AsyncClient _client;

  bool _connected;
  bool _connectPacketNotEnoughSpace;
  bool _disconnectOnPoll;
  bool _tlsBadFingerprint;

  uint32_t _lastClientActivity;
  uint32_t _lastServerActivity;
  uint32_t _lastPingRequestTime;

  char _generatedClientId[18 + 1];
  IPAddress _ip;
  const char* _host;
  bool _useIp;
#if ASYNC_TCP_SSL_ENABLED
  bool _secure;
#endif
  uint16_t _port;
  uint16_t _keepAlive;
  bool _cleanSession;
  const char* _clientId;
  const char* _username;
  const char* _password;
  const char* _willTopic;
  const char* _willPayload;
  uint16_t _willPayloadLength;
  uint8_t _willQos;
  bool _willRetain;

#if ASYNC_TCP_SSL_ENABLED
  std::vector<std::array<uint8_t, SHA1_SIZE>> _secureServerFingerprints;
#endif

  // Zero-Heap Callback Vectors (configured via ACHAEMENID_MQTT_USER_CB_INLINE_CAP)
  uniuno::SmallVector<AsyncMqttClientInternals::OnConnectUserCallback, ACHAEMENID_MQTT_USER_CB_INLINE_CAP>
      _onConnectUserCallbacks;
  uniuno::SmallVector<AsyncMqttClientInternals::OnDisconnectUserCallback, ACHAEMENID_MQTT_USER_CB_INLINE_CAP>
      _onDisconnectUserCallbacks;
  uniuno::SmallVector<AsyncMqttClientInternals::OnSubscribeUserCallback, ACHAEMENID_MQTT_USER_CB_INLINE_CAP>
      _onSubscribeUserCallbacks;
  uniuno::SmallVector<AsyncMqttClientInternals::OnUnsubscribeUserCallback, ACHAEMENID_MQTT_USER_CB_INLINE_CAP>
      _onUnsubscribeUserCallbacks;
  uniuno::SmallVector<AsyncMqttClientInternals::OnMessageUserCallback, ACHAEMENID_MQTT_USER_CB_INLINE_CAP>
      _onMessageUserCallbacks;
  uniuno::SmallVector<AsyncMqttClientInternals::OnPublishUserCallback, ACHAEMENID_MQTT_USER_CB_INLINE_CAP>
      _onPublishUserCallbacks;

  // Zero-Heap Placement-New Packet Storage (exact 16-byte aligned size for largest packet)
  AsyncMqttClientInternals::ParsingInformation _parsingInformation;
  AsyncMqttClientInternals::Packet* _currentParsedPacket;
  static constexpr size_t kPacketStorageSize = (sizeof(AsyncMqttClientInternals::PublishPacket) + 15U) & ~size_t(15U);
  static_assert(kPacketStorageSize >= sizeof(AsyncMqttClientInternals::ConnAckPacket) &&
                    kPacketStorageSize >= sizeof(AsyncMqttClientInternals::SubAckPacket) &&
                    kPacketStorageSize >= sizeof(AsyncMqttClientInternals::UnsubAckPacket) &&
                    kPacketStorageSize >= sizeof(AsyncMqttClientInternals::PublishPacket) &&
                    kPacketStorageSize >= sizeof(AsyncMqttClientInternals::PubRelPacket) &&
                    kPacketStorageSize >= sizeof(AsyncMqttClientInternals::PubAckPacket) &&
                    kPacketStorageSize >= sizeof(AsyncMqttClientInternals::PubRecPacket) &&
                    kPacketStorageSize >= sizeof(AsyncMqttClientInternals::PubCompPacket),
                "AsyncMqttClient _packetStorage must fit every packet type");
  alignas(16) uint8_t _packetStorage[kPacketStorageSize];
  uint8_t _remainingLengthBufferPosition;
  char _remainingLengthBuffer[4];

  uint16_t _nextPacketId;

  // High-Speed SmallVector ACK Queues
  uniuno::SmallVector<AsyncMqttClientInternals::PendingPubRel, 4> _pendingPubRels;
  uniuno::SmallVector<AsyncMqttClientInternals::PendingAck, 8> _toSendAcks;

#if defined(ESP32) || defined(LIBRETINY)
  SemaphoreHandle_t _xSemaphore = nullptr;
#endif

  void _clear();
  void _freeCurrentParsedPacket();

  // TCP Socket Callbacks
  void _onConnect(AsyncClient* client);
  void _onDisconnect(AsyncClient* client);
  static void _onError(AsyncClient* client, int8_t error);
  void _onTimeout(AsyncClient* client, uint32_t time);
  static void _onAck(AsyncClient* client, size_t len, uint32_t time);
  void _onData(AsyncClient* client, uint8_t* data, size_t len);
  void _onPoll(AsyncClient* client);

  // MQTT Internal Packet Handlers
  void _onPingResp();
  void _onConnAck(bool sessionPresent, uint8_t connectReturnCode);
  void _onSubAck(uint16_t packetId, char status);
  void _onUnsubAck(uint16_t packetId);
  void _onMessage(char* topic, char* payload, uint8_t qos, bool dup, bool retain, size_t len, size_t index,
                  size_t total, uint16_t packetId);
  void _onPublish(uint16_t packetId, uint8_t qos);
  void _onPubRel(uint16_t packetId);
  void _onPubAck(uint16_t packetId);
  void _onPubRec(uint16_t packetId);
  void _onPubComp(uint16_t packetId);

  bool _sendPing();
  void _sendAcks();
  bool _sendDisconnect();

  uint16_t _getNextPacketId();
};
