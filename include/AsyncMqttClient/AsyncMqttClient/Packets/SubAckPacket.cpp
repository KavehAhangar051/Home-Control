#include "SubAckPacket.hpp"
#include "../../AsyncMqttAsm.h"

using AsyncMqttClientInternals::SubAckPacket;

SubAckPacket::SubAckPacket(ParsingInformation* parsingInformation, OnSubAckInternalCallback callback)
    : _parsingInformation(parsingInformation), _callback(callback), _bytePosition(0), _packetIdMsb(0), _packetId(0) {}

SubAckPacket::~SubAckPacket() {}

void SubAckPacket::parseVariableHeader(uint8_t* data, size_t len, size_t* currentBytePosition) {
  uint8_t currentByte = data[(*currentBytePosition)++];
  if (_bytePosition++ == 0) {
    _packetIdMsb = currentByte;
  } else {
    _packetId = uniuno::asyncmqtt_asm::asm_make_uint16(_packetIdMsb, currentByte);
    _parsingInformation->bufferState = BufferState::PAYLOAD;
  }
}

void SubAckPacket::parsePayload(uint8_t* data, size_t len, size_t* currentBytePosition) {
  uint8_t status = data[(*currentBytePosition)++];
  _parsingInformation->bufferState = BufferState::NONE;
  _callback(_packetId, status);
}
