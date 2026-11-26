#include <tiny_websockets/internals/websockets_endpoint.hpp>
#include <ArduinoWebsocketsAsm.h>
#include <memory>

namespace websockets {

CloseReason GetCloseReason(uint16_t reasonCode) {
  switch (reasonCode) {
  case CloseReason_NormalClosure:
    return CloseReason_NormalClosure;

  case CloseReason_GoingAway:
    return CloseReason_GoingAway;

  case CloseReason_ProtocolError:
    return CloseReason_ProtocolError;

  case CloseReason_UnsupportedData:
    return CloseReason_UnsupportedData;

  case CloseReason_AbnormalClosure:
    return CloseReason_AbnormalClosure;

  case CloseReason_InvalidPayloadData:
    return CloseReason_InvalidPayloadData;

  case CloseReason_PolicyViolation:
    return CloseReason_PolicyViolation;

  case CloseReason_MessageTooBig:
    return CloseReason_MessageTooBig;

  case CloseReason_NoStatusRcvd:
    return CloseReason_NoStatusRcvd;

  case CloseReason_InternalServerError:
    return CloseReason_InternalServerError;

  default:
    return CloseReason_None;
  }
}

namespace internals {

WebsocketsEndpoint::WebsocketsEndpoint(std::shared_ptr<network::TcpClient> client, FragmentsPolicy fragmentsPolicy)
    : _client(client), _fragmentsPolicy(fragmentsPolicy), _recvMode(RecvMode_Normal),
      _streamBuilder(fragmentsPolicy == FragmentsPolicy_Notify ? true : false), _closeReason(CloseReason_None) {
  // Empty
}

WebsocketsEndpoint::WebsocketsEndpoint(const WebsocketsEndpoint& other)
    : _client(other._client), _fragmentsPolicy(other._fragmentsPolicy), _recvMode(other._recvMode),
      _streamBuilder(other._streamBuilder), _closeReason(other._closeReason), _useMasking(other._useMasking),
      _rxState(other._rxState) {

  const_cast<WebsocketsEndpoint&>(other)._client = nullptr;
  const_cast<WebsocketsEndpoint&>(other)._rxState.reset();
}
WebsocketsEndpoint::WebsocketsEndpoint(const WebsocketsEndpoint&& other)
    : _client(other._client), _fragmentsPolicy(other._fragmentsPolicy), _recvMode(other._recvMode),
      _streamBuilder(other._streamBuilder), _closeReason(other._closeReason), _useMasking(other._useMasking),
      _rxState(std::move(const_cast<WebsocketsEndpoint&>(other)._rxState)) {

  const_cast<WebsocketsEndpoint&>(other)._client = nullptr;
  const_cast<WebsocketsEndpoint&>(other)._rxState.reset();
}

WebsocketsEndpoint& WebsocketsEndpoint::operator=(const WebsocketsEndpoint& other) {
  this->_client = other._client;
  this->_fragmentsPolicy = other._fragmentsPolicy;
  this->_recvMode = other._recvMode;
  this->_streamBuilder = other._streamBuilder;
  this->_closeReason = other._closeReason;
  this->_useMasking = other._useMasking;
  this->_rxState = other._rxState;

  const_cast<WebsocketsEndpoint&>(other)._client = nullptr;
  const_cast<WebsocketsEndpoint&>(other)._rxState.reset();

  return *this;
}
WebsocketsEndpoint& WebsocketsEndpoint::operator=(const WebsocketsEndpoint&& other) {
  this->_client = other._client;
  this->_fragmentsPolicy = other._fragmentsPolicy;
  this->_recvMode = other._recvMode;
  this->_streamBuilder = other._streamBuilder;
  this->_closeReason = other._closeReason;
  this->_useMasking = other._useMasking;
  this->_rxState = std::move(const_cast<WebsocketsEndpoint&>(other)._rxState);

  const_cast<WebsocketsEndpoint&>(other)._client = nullptr;
  const_cast<WebsocketsEndpoint&>(other)._rxState.reset();

  return *this;
}

void WebsocketsEndpoint::setInternalSocket(std::shared_ptr<network::TcpClient> socket) {
  this->_client = socket;
  this->_rxState.reset();
}

bool WebsocketsEndpoint::poll() {
  return this->_client->poll();
}

void remaskData(WSString& data, const uint8_t* const maskingKey, uint64_t payloadLength) {
  if (payloadLength > 0 && !data.empty()) {
    asm_opt::fast_mask(reinterpret_cast<uint8_t*>(&data[0]), static_cast<size_t>(payloadLength), maskingKey);
  }
}

bool WebsocketsEndpoint::stepRxFrame() {
  if (UNLIKELY(!_client || !_client->available())) {
    _rxState.reset();
    return false;
  }

  // Non-blocking partial frame state machine: progresses through Header -> ExtLen -> MaskKey -> Payload
  // Returns false immediately when socket has no more bytes, avoiding busy-wait stalls on loopTask.
  for (;;) {
    if (_rxState.stage == RxStage::Header) {
      const uint32_t need = static_cast<uint32_t>(_rxState.hdr_need - _rxState.hdr_read);
      const uint32_t got = _client->read(_rxState.hdr_buf + _rxState.hdr_read, need);
      if (got == 0U) return false;
      _rxState.hdr_read += static_cast<uint8_t>(got);
      if (_rxState.hdr_read < _rxState.hdr_need) return false;

      memcpy(&_rxState.header, _rxState.hdr_buf, 2U);
      _rxState.hdr_read = 0U;
      if (_rxState.header.payload == 126U) {
        _rxState.hdr_need = 2U;
        _rxState.stage = RxStage::ExtLen;
      } else if (_rxState.header.payload == 127U) {
        _rxState.hdr_need = 8U;
        _rxState.stage = RxStage::ExtLen;
      } else {
        _rxState.payload_len = _rxState.header.payload;
        _rxState.hdr_need = 4U;
        _rxState.stage = _rxState.header.mask ? RxStage::MaskKey : RxStage::Payload;
        if (!_rxState.header.mask) {
          _rxState.payload_done = 0U;
          _rxState.payload.resize(static_cast<size_t>(_rxState.payload_len));
        }
      }
    } else if (_rxState.stage == RxStage::ExtLen) {
      const uint32_t need = static_cast<uint32_t>(_rxState.hdr_need - _rxState.hdr_read);
      const uint32_t got = _client->read(_rxState.hdr_buf + _rxState.hdr_read, need);
      if (got == 0U) return false;
      _rxState.hdr_read += static_cast<uint8_t>(got);
      if (_rxState.hdr_read < _rxState.hdr_need) return false;

      if (_rxState.hdr_need == 2U) {
        uint16_t tmp = 0U;
        memcpy(&tmp, _rxState.hdr_buf, 2U);
        _rxState.payload_len = asm_opt::bswap16(tmp);
      } else {
        uint64_t tmp = 0ULL;
        memcpy(&tmp, _rxState.hdr_buf, 8U);
        _rxState.payload_len = asm_opt::bswap64(tmp);
      }

#ifdef _WS_CONFIG_MAX_MESSAGE_SIZE
      if (UNLIKELY(_rxState.payload_len > _WS_CONFIG_MAX_MESSAGE_SIZE)) {
#else
      if (UNLIKELY(_rxState.payload_len > 32768ULL)) {
#endif
        _rxState.reset();
        close(CloseReason_MessageTooBig);
        return false;
      }

      _rxState.hdr_read = 0U;
      if (_rxState.header.mask) {
        _rxState.hdr_need = 4U;
        _rxState.stage = RxStage::MaskKey;
      } else {
        _rxState.payload_done = 0U;
        _rxState.payload.resize(static_cast<size_t>(_rxState.payload_len));
        _rxState.stage = RxStage::Payload;
      }
    } else if (_rxState.stage == RxStage::MaskKey) {
      const uint32_t need = static_cast<uint32_t>(4U - _rxState.hdr_read);
      const uint32_t got = _client->read(_rxState.masking_key + _rxState.hdr_read, need);
      if (got == 0U) return false;
      _rxState.hdr_read += static_cast<uint8_t>(got);
      if (_rxState.hdr_read < 4U) return false;

      _rxState.payload_done = 0U;
      _rxState.payload.resize(static_cast<size_t>(_rxState.payload_len));
      _rxState.stage = RxStage::Payload;
    } else { // RxStage::Payload
      while (_rxState.payload_done < _rxState.payload_len) {
        const uint64_t rem = _rxState.payload_len - _rxState.payload_done;
        const uint32_t to_read = (rem > 4096ULL) ? 4096U : static_cast<uint32_t>(rem);
        const uint32_t got = _client->read(
            reinterpret_cast<uint8_t*>(&_rxState.payload[static_cast<size_t>(_rxState.payload_done)]), to_read);
        if (got == 0U) return false;
        _rxState.payload_done += got;
      }
      return true;
    }
  }
}

WebsocketsFrame WebsocketsEndpoint::_recv() {
  if (!stepRxFrame()) {
    return WebsocketsFrame();
  }

  if (_rxState.header.mask) {
    remaskData(_rxState.payload, _rxState.masking_key, _rxState.payload_len);
  }

  WebsocketsFrame frame;
  frame.payload = std::move(_rxState.payload);
  frame.fin = _rxState.header.fin;
  frame.mask = _rxState.header.mask;
  memcpy(frame.mask_buf, _rxState.masking_key, 4U);
  frame.opcode = _rxState.header.opcode;
  frame.payload_length = _rxState.payload_len;

  _rxState.reset();
  return frame;
}

WebsocketsMessage WebsocketsEndpoint::handleFrameInStreamingMode(WebsocketsFrame& frame) {
  if (frame.isControlFrame()) {
    auto msg = WebsocketsMessage::CreateFromFrame(std::move(frame));
    this->handleMessageInternally(msg);
    return msg;
  } else if (frame.isBeginningOfFragmentsStream()) {
    this->_recvMode = RecvMode_Streaming;

    if (this->_streamBuilder.isEmpty()) {
      this->_streamBuilder.first(frame);
      // if policy is set to notify, return the frame to the user
      if (this->_fragmentsPolicy == FragmentsPolicy_Notify) {
        return WebsocketsMessage(this->_streamBuilder.type(), std::move(frame.payload), MessageRole::First);
      } else
        return {};
    }
  } else if (frame.isContinuesFragment()) {
    this->_streamBuilder.append(frame);
    if (this->_streamBuilder.isOk()) {
      // if policy is set to notify, return the frame to the user
      if (this->_fragmentsPolicy == FragmentsPolicy_Notify) {
        return WebsocketsMessage(this->_streamBuilder.type(), std::move(frame.payload), MessageRole::Continuation);
      } else
        return {};
    }
  } else if (frame.isEndOfFragmentsStream()) {
    this->_recvMode = RecvMode_Normal;
    this->_streamBuilder.end(frame);
    if (this->_streamBuilder.isOk()) {
      // if policy is set to notify, return the frame to the user
      if (this->_fragmentsPolicy == FragmentsPolicy_Aggregate) {
        auto completeMessage = this->_streamBuilder.build();
        this->_streamBuilder = WebsocketsMessage::StreamBuilder(false);
        this->handleMessageInternally(completeMessage);
        return completeMessage;
      } else { // in case of notify policy
        auto messageType = this->_streamBuilder.type();
        this->_streamBuilder = WebsocketsMessage::StreamBuilder(true);
        return WebsocketsMessage(messageType, std::move(frame.payload), MessageRole::Last);
      }
    }
  }

  // Error
  close(CloseReason_ProtocolError);
  return {};
}

WebsocketsMessage WebsocketsEndpoint::handleFrameInStandardMode(WebsocketsFrame& frame) {
  // Normal (unfragmented) frames are handled as a complete message
  if (frame.isNormalUnfragmentedMessage() || frame.isControlFrame()) {
    auto msg = WebsocketsMessage::CreateFromFrame(std::move(frame));
    this->handleMessageInternally(msg);
    return msg;
  } else if (frame.isBeginningOfFragmentsStream()) {
    return handleFrameInStreamingMode(frame);
  }

  // This is an error. a bad combination of opcodes and fin flag arrived.
  close(CloseReason_ProtocolError);
  return {};
}

WebsocketsMessage WebsocketsEndpoint::recv() {
  auto frame = _recv();
  if (frame.isEmpty()) {
    return {};
  }

  if (this->_recvMode == RecvMode_Normal) {
    return handleFrameInStandardMode(frame);
  } else /* this->_recvMode == RecvMode_Streaming */ {
    return handleFrameInStreamingMode(frame);
  }
}

void WebsocketsEndpoint::handleMessageInternally(WebsocketsMessage& msg) {
  if (msg.isPing()) {
    pong(msg.c_str(), msg.length());
  } else if (msg.isClose()) {
    // is there a reason field
    if (msg.length() >= 2U) {
      uint16_t reason = 0U;
      memcpy(&reason, msg.c_str(), 2U);
      this->_closeReason = GetCloseReason(asm_opt::bswap16(reason));
    } else {
      this->_closeReason = CloseReason_GoingAway;
    }
    close(this->_closeReason);
  }
}

bool WebsocketsEndpoint::send(const char* data, const size_t len, const uint8_t opcode, const bool fin) {
  return this->send(data, len, opcode, fin, this->_useMasking);
}

bool WebsocketsEndpoint::send(const WSString& data, const uint8_t opcode, const bool fin) {
  return this->send(data, opcode, fin, this->_useMasking);
}

bool WebsocketsEndpoint::send(const WSString& data, const uint8_t opcode, const bool fin, const bool mask,
                              const char* maskingKey) {
  return send(data.c_str(), data.size(), opcode, fin, mask, maskingKey);
}

static size_t formatHeaderBytes(uint8_t* out, uint64_t len, uint8_t opcode, bool fin, bool mask) {
  out[0] = (fin ? 0x80 : 0x00) | (opcode & 0x0F);
  const uint8_t mask_bit = mask ? 0x80 : 0x00;

  if (LIKELY(len < 126ULL)) {
    out[1] = mask_bit | static_cast<uint8_t>(len);
    return 2U;
  } else if (len < 65536ULL) {
    out[1] = mask_bit | 126U;
    const uint16_t be16 = asm_opt::bswap16(static_cast<uint16_t>(len));
    memcpy(out + 2U, &be16, 2U);
    return 4U;
  } else {
    out[1] = mask_bit | 127U;
    const uint64_t be64 = asm_opt::bswap64(len);
    memcpy(out + 2U, &be64, 8U);
    return 10U;
  }
}

std::string WebsocketsEndpoint::getHeader(uint64_t len, uint8_t opcode, bool fin, bool mask) {
  uint8_t hdr[10];
  size_t hlen = formatHeaderBytes(hdr, len, opcode, fin, mask);
  return std::string(reinterpret_cast<char*>(hdr), hlen);
}

void remaskData(WSString& data, const char* const maskingKey, size_t first, size_t len) {
  if (len > 0 && first < data.size()) {
    asm_opt::fast_mask(reinterpret_cast<uint8_t*>(&data[first]), len, reinterpret_cast<const uint8_t*>(maskingKey));
  }
}

bool WebsocketsEndpoint::send(const char* data, const size_t len, const uint8_t opcode, const bool fin, const bool mask,
                              const char* maskingKey) {
#ifdef _WS_CONFIG_MAX_MESSAGE_SIZE
  if (len > _WS_CONFIG_MAX_MESSAGE_SIZE) {
    return false;
  }
#endif
  const bool active_mask = mask && (maskingKey != nullptr) &&
                           ((static_cast<uint8_t>(maskingKey[0]) | static_cast<uint8_t>(maskingKey[1]) |
                             static_cast<uint8_t>(maskingKey[2]) | static_cast<uint8_t>(maskingKey[3])) != 0U);

  // Zero-heap fast path for frames up to 1536 bytes
  static constexpr size_t kStackFrameLimit = 1536;
  if (LIKELY(len <= kStackFrameLimit)) {
    uint8_t frame_buf[kStackFrameLimit + 14];
    size_t frame_len = formatHeaderBytes(frame_buf, len, opcode, fin, mask);

    if (mask) {
      memcpy(frame_buf + frame_len, maskingKey, 4);
      frame_len += 4;
    }

    if (len > 0 && data != nullptr) {
      memcpy(frame_buf + frame_len, data, len);
      if (active_mask) {
        asm_opt::fast_mask(frame_buf + frame_len, len, reinterpret_cast<const uint8_t*>(maskingKey));
      }
      frame_len += len;
    }

    this->_client->send(frame_buf, frame_len);
    return true;
  }

  // Heap fallback for large messages (> 1.5 KB)
  size_t alloc_size = 14 + len;
  std::unique_ptr<uint8_t[]> heap_buf(new (std::nothrow) uint8_t[alloc_size]);
  if (!heap_buf) return false;

  size_t frame_len = formatHeaderBytes(heap_buf.get(), len, opcode, fin, mask);
  if (mask) {
    memcpy(heap_buf.get() + frame_len, maskingKey, 4);
    frame_len += 4;
  }
  if (len > 0 && data != nullptr) {
    memcpy(heap_buf.get() + frame_len, data, len);
    if (active_mask) {
      asm_opt::fast_mask(heap_buf.get() + frame_len, len, reinterpret_cast<const uint8_t*>(maskingKey));
    }
    frame_len += len;
  }

  this->_client->send(heap_buf.get(), frame_len);
  return true;
}

void WebsocketsEndpoint::close(CloseReason reason) {
  this->_closeReason = reason;
  this->_rxState.reset();

  if (!this->_client->available()) return;

  if (reason == CloseReason_None) {
    send(nullptr, 0, internals::ContentType::Close, true, this->_useMasking);
  } else {
    uint16_t reasonNum = asm_opt::bswap16(static_cast<uint16_t>(reason));
    send(reinterpret_cast<const char*>(&reasonNum), 2, internals::ContentType::Close, true, this->_useMasking);
  }
  this->_client->close();
}

CloseReason WebsocketsEndpoint::getCloseReason() const {
  return _closeReason;
}

bool WebsocketsEndpoint::ping(const char* msg, size_t len) {
  if (UNLIKELY(len > 125U)) return false;
  return send(msg, len, ContentType::Ping, true, this->_useMasking);
}

bool WebsocketsEndpoint::ping(const WSString& msg) {
  return ping(msg.c_str(), msg.size());
}
bool WebsocketsEndpoint::ping(const WSString&& msg) {
  return ping(msg.c_str(), msg.size());
}

bool WebsocketsEndpoint::pong(const char* msg, size_t len) {
  if (UNLIKELY(len > 125U)) return false;
  return send(msg, len, ContentType::Pong, true, this->_useMasking);
}

bool WebsocketsEndpoint::pong(const WSString& msg) {
  return pong(msg.c_str(), msg.size());
}
bool WebsocketsEndpoint::pong(const WSString&& msg) {
  return pong(msg.c_str(), msg.size());
}

void WebsocketsEndpoint::setFragmentsPolicy(FragmentsPolicy newPolicy) {
  this->_fragmentsPolicy = newPolicy;
}

FragmentsPolicy WebsocketsEndpoint::getFragmentsPolicy() const {
  return this->_fragmentsPolicy;
}

WebsocketsEndpoint::~WebsocketsEndpoint() {}
} // namespace internals
} // namespace websockets
