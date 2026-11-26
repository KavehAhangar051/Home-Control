#include "AckWithIdPacket.hpp"
#include "../../AsyncMqttAsm.h"

using AsyncMqttClientInternals::AckWithIdPacket;

AckWithIdPacket::AckWithIdPacket(ParsingInformation* parsingInformation,
                                 uniuno::FastFunction<void(uint16_t packetId), 16> callback)
    : _parsingInformation(parsingInformation), _callback(std::move(callback)), _bytePosition(0), _packetIdMsb(0),
      _packetId(0) {}

AckWithIdPacket::~AckWithIdPacket() {}

void AckWithIdPacket::parseVariableHeader(uint8_t* data, size_t len, size_t* currentBytePosition) {
  (void)len;
  uint8_t currentByte = data[(*currentBytePosition)++];
  if (_bytePosition++ == 0) {
    _packetIdMsb = currentByte;
  } else {
    _packetId = uniuno::asyncmqtt_asm::asm_make_uint16(_packetIdMsb, currentByte);
    _parsingInformation->bufferState = BufferState::NONE;
    _callback(_packetId);
  }
}

void AckWithIdPacket::parsePayload(uint8_t* data, size_t len, size_t* currentBytePosition) {
  (void)data;
  (void)len;
  (void)currentBytePosition;
}
