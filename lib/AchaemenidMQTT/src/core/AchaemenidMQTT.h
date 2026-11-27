#pragma once

#include <Arduino.h>
#include <ProjectConfig.h>
#include <AsyncMqttClient.h>
#include <Optimization/FastFunction.h>
#include <Optimization/FramedSpscRing.h>
#include "MqttConfig.h"
#include "MqttConnectionManager.h"

namespace uniuno {

class AchaemenidMQTT {
public:
  using MessageCallback =
      uniuno::FastFunction<void(const uint8_t* payload, size_t length), ACHAEMENID_CALLBACK_SBO_BYTES>;

  AchaemenidMQTT();
  ~AchaemenidMQTT();

  void begin(const char* server, uint16_t port, const char* baseTopic, uint8_t qos, const char* user,
             const char* password);
  void begin(const String& server, uint16_t port, const String& baseTopic, uint8_t qos, const String& user,
             const String& password);
  void connect();
  void disconnect(bool force = false);
  bool isConnected() const { return _mqttClient.connected(); }

  /// ~2-cycle IRAM-safe check for commands queued from Core 0 (AsyncTCP) to Core 1 (loopTask).
  HOT_PATH FORCE_INLINE bool hasPendingCommands() const { return _rxRing.hasPending(); }

  /// Consumer-side (Core 1): drain queued MQTT commands in FIFO order with zero heap allocations.
  HOT_PATH void processQueue();

  /// Producer-side helper: push a raw command frame into the lock-free SPSC ring.
  HOT_PATH bool enqueueCommand(const uint8_t* payload, size_t length) { return _rxRing.push(payload, length); }

  uint32_t getDroppedCommandCount() const { return _rxRing.droppedCount(); }

  String getBaseTopic() const { return String(_config.baseTopic.c_str()); }
  const char* getBaseTopicCStr() const { return _config.baseTopic.c_str(); }
  const char* getStateTopicCStr() const { return _config.stateTopic.c_str(); }

  bool publish(const char* topic, const uint8_t* payload, size_t length, bool retained = false);
  bool publish(const char* topic, const char* payload, bool retained = false);
  bool publish(const String& topic, const uint8_t* payload, size_t length, bool retained = false);
  bool publish(const String& topic, const String& payload, bool retained = false);
  bool publishState(const char* payload, size_t length, bool retained = false);
  bool publishState(const char* payload, bool retained = false);

  void setCallback(MessageCallback callback);
  void subscribe(const char* topic);
  void subscribe(const String& topic);

#ifdef UNIUNO_NATIVE_TEST
  AsyncMqttClient& testMqttClient() { return _mqttClient; }
  const MqttConfig& testConfig() const { return _config; }
  bool testHasPendingReconfigureReconnect() const { return _reconnectAfterDisconnect; }
#endif

private:
  AsyncMqttClient _mqttClient;
  MqttConfig _config;
  MqttConnectionManager _connManager;
  MessageCallback _messageCallback;
  static constexpr size_t MAX_COMMAND_PAYLOAD = 1536;
  uint8_t _messageBuffer[MAX_COMMAND_PAYLOAD]{};
  uniuno::FramedSpscRing<ACHAEMENID_MQTT_RX_RING_BYTES> _rxRing;
  size_t _messageTotal = 0;
  size_t _messageReceived = 0;
  bool _configured = false;
  bool _reconnectAfterDisconnect = false;
  bool _subscribed = false;

  void _onMqttConnect(bool sessionPresent);
  void _onMqttDisconnect(AsyncMqttClientDisconnectReason reason);
  void _onMqttMessage(char* topic, char* payload, AsyncMqttClientMessageProperties properties, size_t len, size_t index,
                      size_t total);
};

} // namespace uniuno
