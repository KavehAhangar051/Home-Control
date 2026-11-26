#include <cstring>
#include "PublishPacket.hpp"
#include "../../AsyncMqttAsm.h"

using AsyncMqttClientInternals::PublishPacket;

PublishPacket::PublishPacket(ParsingInformation* parsingInformation, OnMessageInternalCallback dataCallback, OnPublishInternalCallback completeCallback)
: _parsingInformation(parsingInformation)
, _dataCallback(dataCallback)
, _completeCallback(completeCallback)
, _dup(false)
, _qos(0)
, _retain(0)
, _bytePosition(0)
, _topicLengthMsb(0)
, _topicLength(0)
, _ignore(false)
, _packetIdMsb(0)
, _packetId(0)
, _payloadLength(0)
, _payloadBytesRead(0) {
    _dup = (_parsingInformation->packetFlags & HeaderFlag.PUBLISH_DUP) != 0;
    _retain = (_parsingInformation->packetFlags & HeaderFlag.PUBLISH_RETAIN) != 0;
    _qos = (_parsingInformation->packetFlags & 0x06) >> 1;
}

PublishPacket::~PublishPacket() {
}

void PublishPacket::parseVariableHeader(uint8_t* data, size_t len, size_t* currentBytePosition) {
  if (LIKELY(_bytePosition >= 2U && _bytePosition < static_cast<size_t>(2U + _topicLength))) {
    const size_t availTopic = static_cast<size_t>(2U + _topicLength) - _bytePosition;
    const size_t availChunk = len - (*currentBytePosition);
    const size_t copyLen = uniuno::asyncmqtt_asm::asm_min(availTopic, availChunk);
    if (LIKELY(!_ignore && copyLen > 0U)) {
      std::memcpy(_parsingInformation->topicBuffer + (_bytePosition - 2U), data + (*currentBytePosition), copyLen);
    }
    _bytePosition += copyLen;
    (*currentBytePosition) += copyLen;
    if (_bytePosition == static_cast<size_t>(2U + _topicLength) && _qos == 0) {
      const uint32_t payloadLen = (_parsingInformation->remainingLength >= _bytePosition)
                                  ? (_parsingInformation->remainingLength - _bytePosition) : 0U;
      _preparePayloadHandling(payloadLen);
    }
    return;
  }

  uint8_t currentByte = data[(*currentBytePosition)++];
  if (_bytePosition == 0) {
    _topicLengthMsb = currentByte;
  } else if (_bytePosition == 1) {
    _topicLength = uniuno::asyncmqtt_asm::asm_make_uint16(_topicLengthMsb, currentByte);
    if (_topicLength > _parsingInformation->maxTopicLength) {
      _ignore = true;
    } else {
      _parsingInformation->topicBuffer[_topicLength] = '\0';
    }
  } else if (_bytePosition == 2 + _topicLength) {
    _packetIdMsb = currentByte;
  } else {
    _packetId = uniuno::asyncmqtt_asm::asm_make_uint16(_packetIdMsb, currentByte);
    uint32_t varHeaderLen = _bytePosition + 1;
    uint32_t payloadLen = (_parsingInformation->remainingLength >= varHeaderLen)
                          ? (_parsingInformation->remainingLength - varHeaderLen) : 0;
    _preparePayloadHandling(payloadLen);
  }
  _bytePosition++;
}

void PublishPacket::_preparePayloadHandling(uint32_t payloadLength) {
  _payloadLength = payloadLength;
  if (payloadLength == 0) {
    _parsingInformation->bufferState = BufferState::NONE;
    if (LIKELY(!_ignore)) {
      _dataCallback(_parsingInformation->topicBuffer, nullptr, _qos, _dup, _retain, 0, 0, 0, _packetId);
      _completeCallback(_packetId, _qos);
    }
  } else {
    _parsingInformation->bufferState = BufferState::PAYLOAD;
  }
}

void PublishPacket::parsePayload(uint8_t* data, size_t len, size_t* currentBytePosition) {
  const size_t availableInPayload = _payloadLength - _payloadBytesRead;
  const size_t availableInChunk = len - (*currentBytePosition);
  const size_t remainToRead = uniuno::asyncmqtt_asm::asm_min(availableInChunk, availableInPayload);

  if (LIKELY(!_ignore)) {
    _dataCallback(_parsingInformation->topicBuffer, reinterpret_cast<char*>(data + (*currentBytePosition)), _qos, _dup, _retain, remainToRead, _payloadBytesRead, _payloadLength, _packetId);
  }
  _payloadBytesRead += remainToRead;
  (*currentBytePosition) += remainToRead;

  if (_payloadBytesRead == _payloadLength) {
    _parsingInformation->bufferState = BufferState::NONE;
    if (LIKELY(!_ignore)) _completeCallback(_packetId, _qos);
  }
}
