#pragma once

#include <ProjectConfig.h>
#include <Optimization/FastFunction.h>
#include <Optimization/CompilerTraits.h>

#include "DisconnectReasons.hpp"
#include "MessageProperties.hpp"

namespace AsyncMqttClientInternals {
// user callbacks (configured via ACHAEMENID_CALLBACK_SBO_BYTES)
typedef uniuno::FastFunction<void(bool sessionPresent), ACHAEMENID_CALLBACK_SBO_BYTES> OnConnectUserCallback;
typedef uniuno::FastFunction<void(AsyncMqttClientDisconnectReason reason), ACHAEMENID_CALLBACK_SBO_BYTES>
    OnDisconnectUserCallback;
typedef uniuno::FastFunction<void(uint16_t packetId, uint8_t qos), ACHAEMENID_CALLBACK_SBO_BYTES>
    OnSubscribeUserCallback;
typedef uniuno::FastFunction<void(uint16_t packetId), ACHAEMENID_CALLBACK_SBO_BYTES> OnUnsubscribeUserCallback;
typedef uniuno::FastFunction<void(char* topic, char* payload, AsyncMqttClientMessageProperties properties, size_t len,
                                  size_t index, size_t total),
                             ACHAEMENID_CALLBACK_SBO_BYTES>
    OnMessageUserCallback;
typedef uniuno::FastFunction<void(uint16_t packetId), ACHAEMENID_CALLBACK_SBO_BYTES> OnPublishUserCallback;

// internal callbacks (configured via ACHAEMENID_CALLBACK_SBO_BYTES)
typedef uniuno::FastFunction<void(bool sessionPresent, uint8_t connectReturnCode), ACHAEMENID_CALLBACK_SBO_BYTES>
    OnConnAckInternalCallback;
typedef uniuno::FastFunction<void(), ACHAEMENID_CALLBACK_SBO_BYTES> OnPingRespInternalCallback;
typedef uniuno::FastFunction<void(uint16_t packetId, char status), ACHAEMENID_CALLBACK_SBO_BYTES>
    OnSubAckInternalCallback;
typedef uniuno::FastFunction<void(uint16_t packetId), ACHAEMENID_CALLBACK_SBO_BYTES> OnUnsubAckInternalCallback;
typedef uniuno::FastFunction<void(char* topic, char* payload, uint8_t qos, bool dup, bool retain, size_t len,
                                  size_t index, size_t total, uint16_t packetId),
                             ACHAEMENID_CALLBACK_SBO_BYTES>
    OnMessageInternalCallback;
typedef uniuno::FastFunction<void(uint16_t packetId, uint8_t qos), ACHAEMENID_CALLBACK_SBO_BYTES>
    OnPublishInternalCallback;
typedef uniuno::FastFunction<void(uint16_t packetId), ACHAEMENID_CALLBACK_SBO_BYTES> OnPubRelInternalCallback;
typedef uniuno::FastFunction<void(uint16_t packetId), ACHAEMENID_CALLBACK_SBO_BYTES> OnPubAckInternalCallback;
typedef uniuno::FastFunction<void(uint16_t packetId), ACHAEMENID_CALLBACK_SBO_BYTES> OnPubRecInternalCallback;
typedef uniuno::FastFunction<void(uint16_t packetId), ACHAEMENID_CALLBACK_SBO_BYTES> OnPubCompInternalCallback;
} // namespace AsyncMqttClientInternals
