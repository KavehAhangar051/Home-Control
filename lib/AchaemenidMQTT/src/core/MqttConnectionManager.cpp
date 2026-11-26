#include "MqttConnectionManager.h"
#include "AchaemenidMQTT.h"
#include <NetworkConfigHelper.h>
#include <Arduino.h>

namespace uniuno {

MqttConnectionManager::MqttConnectionManager(AchaemenidMQTT* mqttClient) : _mqttClient(mqttClient) {}

void MqttConnectionManager::onConnect() {
  _reconnectRetries = 0;
  _reconnectTimer.detach();
}

void MqttConnectionManager::onDisconnect() {
  if (WiFi.status() == WL_CONNECTED) {
    if (_reconnectRetries < 255) {
      _reconnectRetries++;
    }

    const uint32_t delayMs = net_config::computeMqttReconnectDelayMs(_reconnectRetries);
    const float delaySeconds = static_cast<float>(delayMs) / 1000.0F;
    Serial.printf("[MQTT] Reconnecting in %.0fs (attempt %u)...\n", delaySeconds,
                  static_cast<unsigned int>(_reconnectRetries));

    _reconnectTimer.once(delaySeconds, MqttConnectionManager::reconnectWrapper, _mqttClient);
  }
}

void MqttConnectionManager::resetRetries() {
  _reconnectRetries = 0;
}

void MqttConnectionManager::cancelReconnect() {
  _reconnectTimer.detach();
}

void MqttConnectionManager::scheduleImmediateReconnect(float delaySeconds) {
  _reconnectRetries = 0;
  _reconnectTimer.detach();
  _reconnectTimer.once(delaySeconds, MqttConnectionManager::reconnectWrapper, _mqttClient);
}

void MqttConnectionManager::reconnectWrapper(AchaemenidMQTT* instance) {
  if (instance) {
    instance->connect();
  }
}

} // namespace uniuno
