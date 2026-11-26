#pragma once

#include "Arduino.h"
#include "Packet.hpp"
#include "../ParsingInformation.hpp"
#include "../Callbacks.hpp"

namespace AsyncMqttClientInternals {
/**
 * @brief Unified parser for 2-byte Packet Identifier ACK packets (PUBACK, PUBREC, PUBREL, PUBCOMP, UNSUBACK).
 * Consolidates 5 identical packet classes into a single implementation to eliminate duplicate vtables
 * and reduce flash memory usage while maximizing instruction cache locality.
 */
class AckWithIdPacket : public Packet {
public:
  explicit AckWithIdPacket(ParsingInformation* parsingInformation,
                           uniuno::FastFunction<void(uint16_t packetId), ACHAEMENID_CALLBACK_SBO_BYTES> callback);
  ~AckWithIdPacket() override;

  void parseVariableHeader(uint8_t* data, size_t len, size_t* currentBytePosition) override;
  void parsePayload(uint8_t* data, size_t len, size_t* currentBytePosition) override;

private:
  ParsingInformation* _parsingInformation;
  uniuno::FastFunction<void(uint16_t packetId), ACHAEMENID_CALLBACK_SBO_BYTES> _callback;

  uint8_t _bytePosition;
  uint8_t _packetIdMsb;
  uint16_t _packetId;
};
} // namespace AsyncMqttClientInternals
