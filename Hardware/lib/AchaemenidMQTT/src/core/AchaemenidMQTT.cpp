#include "AchaemenidMQTT.h"
#include <NetworkConfigHelper.h>
#include <Utilities/SystemDiagnostics.h>
#include <Utilities/logging.h>
#include <Optimization/CompilerTraits.h>
#include <WiFi.h>
#include <cstring>
#ifdef ESP32
#include <esp_system.h>
#endif

namespace uniuno {

AchaemenidMQTT::AchaemenidMQTT() : _connManager(this) {
  String mac = WiFi.macAddress();
  mac.replace(":", "");
  _config.clientId = ("ESP32-" + mac).c_str();

  _mqttClient.onConnect([this](bool sessionPresent) { this->_onMqttConnect(sessionPresent); });

  _mqttClient.onDisconnect([this](AsyncMqttClientDisconnectReason reason) { this->_onMqttDisconnect(reason); });

  _mqttClient.onMessage([this](char* topic, char* payload, AsyncMqttClientMessageProperties properties, size_t len,
                               size_t index,
                               size_t total) { this->_onMqttMessage(topic, payload, properties, len, index, total); });
}

AchaemenidMQTT::~AchaemenidMQTT() {}

void AchaemenidMQTT::begin(const String& server, uint16_t port, const String& baseTopic, uint8_t qos,
                           const String& user, const String& password) {
  char normalizedTopic[64] = {0};
  if (!net_config::normalizeMqttBaseTopic(baseTopic.c_str(), normalizedTopic, sizeof(normalizedTopic))) {
    net_config::copySafeString(normalizedTopic, sizeof(normalizedTopic), baseTopic.c_str());
  }

  MqttConfig nextConfig;
  nextConfig.clientId = _config.clientId;
  nextConfig.server = server.c_str();
  nextConfig.port = static_cast<uint16_t>(net_config::sanitizeMqttPort(port));
  nextConfig.baseTopic = normalizedTopic;
  nextConfig.qos = static_cast<uint8_t>(net_config::sanitizeMqttQos(qos));
  nextConfig.user = user.c_str();
  nextConfig.password = password.c_str();
  nextConfig.willTopic = (String(normalizedTopic) + "/Status").c_str();
  nextConfig.commandTopic = (String(normalizedTopic) + "/Command").c_str();

  const bool configChanged = _configured && !_config.matchesConnectionParams(nextConfig);
  _config = nextConfig;
  _configured = true;

  _mqttClient.setServer(_config.server.c_str(), _config.port);
  _mqttClient.setClientId(_config.clientId.c_str());

  if (!_config.user.empty()) {
    _mqttClient.setCredentials(_config.user.c_str(), !_config.password.empty() ? _config.password.c_str() : nullptr);
  } else {
    _mqttClient.setCredentials(nullptr, nullptr);
  }

  _mqttClient.setWill(_config.willTopic.c_str(), _config.qos, true, "offline");
  _mqttClient.setKeepAlive(15);

  if (configChanged) {
    Serial.printf("[MQTT] Configuration changed (%s:%u, topic=%s, qos=%u).\n", _config.server.c_str(),
                  static_cast<unsigned int>(_config.port), _config.baseTopic.c_str(),
                  static_cast<unsigned int>(_config.qos));
    _connManager.cancelReconnect();
    _connManager.resetRetries();
    _subscribed = false;

    if (_mqttClient.connected()) {
      _reconnectAfterDisconnect = true;
      _mqttClient.disconnect(false);
    }
  }
}

void AchaemenidMQTT::connect() {
  if (WiFi.status() != WL_CONNECTED || _mqttClient.connected() || _reconnectAfterDisconnect) return;
  if (!_config.isValid()) return;
  Serial.printf("[MQTT] Connecting to %s:%u...\n", _config.server.c_str(), static_cast<unsigned int>(_config.port));
  _mqttClient.connect();
}

void AchaemenidMQTT::disconnect(bool force) {
  _connManager.cancelReconnect();
  _reconnectAfterDisconnect = false;
  _subscribed = false;
  if (_mqttClient.connected()) {
    _mqttClient.disconnect(force);
  }
}

void AchaemenidMQTT::setCallback(MessageCallback callback) {
  _messageCallback = std::move(callback);
}

void AchaemenidMQTT::subscribe(const String& topic) {
  const bool topicChanged = (_config.commandTopic != topic.c_str());
  _config.commandTopic = topic.c_str();
  if (_mqttClient.connected() && !_reconnectAfterDisconnect && (topicChanged || !_subscribed)) {
    _mqttClient.subscribe(_config.commandTopic.c_str(), _config.qos);
    _subscribed = true;
    Serial.printf("[MQTT] Subscribed to topic: %s\n", _config.commandTopic.c_str());
  }
}

bool AchaemenidMQTT::publish(const char* topic, const uint8_t* payload, size_t length, bool retained) {
  if (LIKELY(topic != nullptr && _mqttClient.connected())) {
    const uint16_t packetId =
        _mqttClient.publish(topic, _config.qos, retained, reinterpret_cast<const char*>(payload), length);
    return packetId != 0;
  }
  return false;
}

bool AchaemenidMQTT::publish(const String& topic, const uint8_t* payload, size_t length, bool retained) {
  return publish(topic.c_str(), payload, length, retained);
}

bool AchaemenidMQTT::publish(const String& topic, const String& payload, bool retained) {
  if (LIKELY(_mqttClient.connected())) {
    const uint16_t packetId = _mqttClient.publish(topic.c_str(), _config.qos, retained, payload.c_str());
    return packetId != 0;
  }
  return false;
}

void AchaemenidMQTT::_onMqttConnect(bool sessionPresent) {
  (void)sessionPresent;
  Serial.println("[MQTT] Connected to MQTT broker!");
  _reconnectAfterDisconnect = false;
  _connManager.onConnect();

  IPAddress ip = WiFi.localIP();
#ifdef ESP32
  const char* resetReason = diagnostics::resetReasonToString(static_cast<int>(esp_reset_reason()));
  const uint32_t minFreeHeap = ESP.getMinFreeHeap();
#else
  const char* resetReason = "native";
  const uint32_t minFreeHeap = 0U;
#endif
  char onlinePayload[160];
  const size_t payloadLen = diagnostics::formatMqttOnlineStatusJson(onlinePayload, sizeof(onlinePayload), ip[0], ip[1],
                                                                    ip[2], ip[3], resetReason, minFreeHeap);
  publish(_config.willTopic.c_str(), reinterpret_cast<const uint8_t*>(onlinePayload), payloadLen, true);

  if (!_config.commandTopic.empty()) {
    _mqttClient.subscribe(_config.commandTopic.c_str(), _config.qos);
    _subscribed = true;
    Serial.printf("[MQTT] Subscribed to topic: %s\n", _config.commandTopic.c_str());
  }
}

void AchaemenidMQTT::_onMqttDisconnect(AsyncMqttClientDisconnectReason reason) {
  (void)reason;
  _subscribed = false;
  if (_reconnectAfterDisconnect) {
    _reconnectAfterDisconnect = false;
    Serial.println("[MQTT] Disconnected for reconfiguration; connecting with new settings...");
    _connManager.scheduleImmediateReconnect(0.15F);
    return;
  }
  Serial.println("[MQTT] Disconnected from MQTT.");
  _connManager.onDisconnect();
}

HOT_PATH IRAM_ATTR void AchaemenidMQTT::_onMqttMessage(char* /*topic*/, char* payload,
                                                       AsyncMqttClientMessageProperties /*properties*/, size_t len,
                                                       size_t index, size_t total) {
  if (UNLIKELY(!_messageCallback || payload == nullptr || total == 0)) return;

  if (index == 0) {
    _messageTotal = total;
    _messageReceived = 0;
  }

  if (UNLIKELY(total > MAX_COMMAND_PAYLOAD || total != _messageTotal || index != _messageReceived || index > total ||
               len > total - index)) {
    Serial.printf("[MQTT] Dropped malformed/oversized command fragment (index=%u len=%u total=%u)\n",
                  static_cast<unsigned>(index), static_cast<unsigned>(len), static_cast<unsigned>(total));
    _messageTotal = 0;
    _messageReceived = 0;
    return;
  }

  memcpy(_messageBuffer + index, payload, len);
  _messageReceived += len;

  if (_messageReceived == _messageTotal) {
    _messageCallback(_messageBuffer, _messageTotal);
    _messageTotal = 0;
    _messageReceived = 0;
  }
}

} // namespace uniuno
