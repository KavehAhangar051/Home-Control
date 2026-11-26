#pragma once

#include <Optimization/FastFunction.h>
#include <Optimization/CompilerTraits.h>

#include "DisconnectReasons.hpp"
#include "MessageProperties.hpp"

namespace AsyncMqttClientInternals {
// user callbacks (Max-Velocity 64-byte SBO, direct IRAM call, zero vtable, zero-heap)
typedef uniuno::FastFunction<void(bool sessionPresent), 64> OnConnectUserCallback;
typedef uniuno::FastFunction<void(AsyncMqttClientDisconnectReason reason), 64> OnDisconnectUserCallback;
typedef uniuno::FastFunction<void(uint16_t packetId, uint8_t qos), 64> OnSubscribeUserCallback;
typedef uniuno::FastFunction<void(uint16_t packetId), 64> OnUnsubscribeUserCallback;
typedef uniuno::FastFunction<void(char* topic, char* payload, AsyncMqttClientMessageProperties properties, size_t len,
                                  size_t index, size_t total),
                             64>
    OnMessageUserCallback;
typedef uniuno::FastFunction<void(uint16_t packetId), 64> OnPublishUserCallback;

// internal callbacks (Max-Velocity 64-byte SBO, direct IRAM call, zero vtable, zero-heap)
typedef uniuno::FastFunction<void(bool sessionPresent, uint8_t connectReturnCode), 64> OnConnAckInternalCallback;
typedef uniuno::FastFunction<void(), 64> OnPingRespInternalCallback;
typedef uniuno::FastFunction<void(uint16_t packetId, char status), 64> OnSubAckInternalCallback;
typedef uniuno::FastFunction<void(uint16_t packetId), 64> OnUnsubAckInternalCallback;
typedef uniuno::FastFunction<void(char* topic, char* payload, uint8_t qos, bool dup, bool retain, size_t len,
                                  size_t index, size_t total, uint16_t packetId),
                             64>
    OnMessageInternalCallback;
typedef uniuno::FastFunction<void(uint16_t packetId, uint8_t qos), 64> OnPublishInternalCallback;
typedef uniuno::FastFunction<void(uint16_t packetId), 64> OnPubRelInternalCallback;
typedef uniuno::FastFunction<void(uint16_t packetId), 64> OnPubAckInternalCallback;
typedef uniuno::FastFunction<void(uint16_t packetId), 64> OnPubRecInternalCallback;
typedef uniuno::FastFunction<void(uint16_t packetId), 64> OnPubCompInternalCallback;
} // namespace AsyncMqttClientInternals
