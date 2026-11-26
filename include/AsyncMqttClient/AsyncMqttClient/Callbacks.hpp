#pragma once

#include <Optimization/FastFunction.h>
#include <Optimization/CompilerTraits.h>

#include "DisconnectReasons.hpp"
#include "MessageProperties.hpp"

namespace AsyncMqttClientInternals {
// user callbacks (32-byte power-of-2 SBO on ESP32: 16B inline = 4 pointers, direct IRAM call, zero-heap)
typedef uniuno::FastFunction<void(bool sessionPresent), 16> OnConnectUserCallback;
typedef uniuno::FastFunction<void(AsyncMqttClientDisconnectReason reason), 16> OnDisconnectUserCallback;
typedef uniuno::FastFunction<void(uint16_t packetId, uint8_t qos), 16> OnSubscribeUserCallback;
typedef uniuno::FastFunction<void(uint16_t packetId), 16> OnUnsubscribeUserCallback;
typedef uniuno::FastFunction<void(char* topic, char* payload, AsyncMqttClientMessageProperties properties, size_t len,
                                  size_t index, size_t total),
                             16>
    OnMessageUserCallback;
typedef uniuno::FastFunction<void(uint16_t packetId), 16> OnPublishUserCallback;

// internal callbacks (32-byte power-of-2 SBO on ESP32: 16B inline = 4 pointers, direct IRAM call, zero-heap)
typedef uniuno::FastFunction<void(bool sessionPresent, uint8_t connectReturnCode), 16> OnConnAckInternalCallback;
typedef uniuno::FastFunction<void(), 16> OnPingRespInternalCallback;
typedef uniuno::FastFunction<void(uint16_t packetId, char status), 16> OnSubAckInternalCallback;
typedef uniuno::FastFunction<void(uint16_t packetId), 16> OnUnsubAckInternalCallback;
typedef uniuno::FastFunction<void(char* topic, char* payload, uint8_t qos, bool dup, bool retain, size_t len,
                                  size_t index, size_t total, uint16_t packetId),
                             16>
    OnMessageInternalCallback;
typedef uniuno::FastFunction<void(uint16_t packetId, uint8_t qos), 16> OnPublishInternalCallback;
typedef uniuno::FastFunction<void(uint16_t packetId), 16> OnPubRelInternalCallback;
typedef uniuno::FastFunction<void(uint16_t packetId), 16> OnPubAckInternalCallback;
typedef uniuno::FastFunction<void(uint16_t packetId), 16> OnPubRecInternalCallback;
typedef uniuno::FastFunction<void(uint16_t packetId), 16> OnPubCompInternalCallback;
} // namespace AsyncMqttClientInternals
