#include <new>
#include "AsyncMqttClient.hpp"
#include "AsyncMqttAsm.h" // IWYU pragma: keep

AsyncMqttClient::AsyncMqttClient()
    : _connected(false), _connectPacketNotEnoughSpace(false), _disconnectOnPoll(false), _tlsBadFingerprint(false),
      _lastClientActivity(0), _lastServerActivity(0), _lastPingRequestTime(0), _host(nullptr), _useIp(false)
#if ASYNC_TCP_SSL_ENABLED
      ,
      _secure(false)
#endif
      ,
      _port(0), _keepAlive(15), _cleanSession(true), _clientId(nullptr), _username(nullptr), _password(nullptr),
      _willTopic(nullptr), _willPayload(nullptr), _willPayloadLength(0), _willQos(0), _willRetain(false),
      _parsingInformation{.bufferState = AsyncMqttClientInternals::BufferState::NONE}, _currentParsedPacket(nullptr),
      _remainingLengthBufferPosition(0), _nextPacketId(1) {
  _client.onConnect([](void* obj, AsyncClient* c) { (static_cast<AsyncMqttClient*>(obj))->_onConnect(c); }, this);
  _client.onDisconnect([](void* obj, AsyncClient* c) { (static_cast<AsyncMqttClient*>(obj))->_onDisconnect(c); }, this);
  _client.onError(
      [](void* obj, AsyncClient* c, int8_t error) { (static_cast<AsyncMqttClient*>(obj))->_onError(c, error); }, this);
  _client.onTimeout(
      [](void* obj, AsyncClient* c, uint32_t time) { (static_cast<AsyncMqttClient*>(obj))->_onTimeout(c, time); },
      this);
  _client.onAck([](void* obj, AsyncClient* c, size_t len,
                   uint32_t time) { (static_cast<AsyncMqttClient*>(obj))->_onAck(c, len, time); },
                this);
  _client.onData([](void* obj, AsyncClient* c, void* data,
                    size_t len) { (static_cast<AsyncMqttClient*>(obj))->_onData(c, static_cast<uint8_t*>(data), len); },
                 this);
  _client.onPoll([](void* obj, AsyncClient* c) { (static_cast<AsyncMqttClient*>(obj))->_onPoll(c); }, this);

#ifdef ESP32
  sprintf(_generatedClientId, "esp32-%06llx", ESP.getEfuseMac());
  _xSemaphore = xSemaphoreCreateMutex();
#elif defined(ESP8266)
  sprintf(_generatedClientId, "esp8266-%06x", ESP.getChipId());
#elif defined(LIBRETINY)
  sprintf(_generatedClientId, "%s-%06llx", lt_cpu_get_model_code(), lt_cpu_get_mac_id());
  _xSemaphore = xSemaphoreCreateMutex();
#endif
  _clientId = _generatedClientId;

  setMaxTopicLength(128);
}

AsyncMqttClient::~AsyncMqttClient() {
  delete _currentParsedPacket;
  delete[] _parsingInformation.topicBuffer;
#if defined(ESP32) || defined(LIBRETINY)
  vSemaphoreDelete(_xSemaphore);
#endif
}

AsyncMqttClient& AsyncMqttClient::setKeepAlive(uint16_t keepAlive) {
  _keepAlive = keepAlive;
  return *this;
}

AsyncMqttClient& AsyncMqttClient::setClientId(const char* clientId) {
  _clientId = clientId;
  return *this;
}

AsyncMqttClient& AsyncMqttClient::setCleanSession(bool cleanSession) {
  _cleanSession = cleanSession;
  return *this;
}

AsyncMqttClient& AsyncMqttClient::setMaxTopicLength(uint16_t maxTopicLength) {
  _parsingInformation.maxTopicLength = maxTopicLength;
  delete[] _parsingInformation.topicBuffer;
  _parsingInformation.topicBuffer = new char[maxTopicLength + 1];
  return *this;
}

AsyncMqttClient& AsyncMqttClient::setCredentials(const char* username, const char* password) {
  _username = username;
  _password = password;
  return *this;
}

AsyncMqttClient& AsyncMqttClient::setWill(const char* topic, uint8_t qos, bool retain, const char* payload,
                                          size_t length) {
  _willTopic = topic;
  _willQos = qos;
  _willRetain = retain;
  _willPayload = payload;
  _willPayloadLength = length;
  return *this;
}

AsyncMqttClient& AsyncMqttClient::setServer(IPAddress ip, uint16_t port) {
  _useIp = true;
  _ip = ip;
  _port = port;
  return *this;
}

AsyncMqttClient& AsyncMqttClient::setServer(const char* host, uint16_t port) {
  _useIp = false;
  _host = host;
  _port = port;
  return *this;
}

#if ASYNC_TCP_SSL_ENABLED
AsyncMqttClient& AsyncMqttClient::setSecure(bool secure) {
  _secure = secure;
  return *this;
}

AsyncMqttClient& AsyncMqttClient::addServerFingerprint(const uint8_t* fingerprint) {
  std::array<uint8_t, SHA1_SIZE> newFingerprint;
  memcpy(newFingerprint.data(), fingerprint, SHA1_SIZE);
  _secureServerFingerprints.push_back(newFingerprint);
  return *this;
}
#endif

AsyncMqttClient& AsyncMqttClient::onConnect(AsyncMqttClientInternals::OnConnectUserCallback callback) {
  _onConnectUserCallbacks.push_back(callback);
  return *this;
}

AsyncMqttClient& AsyncMqttClient::onDisconnect(AsyncMqttClientInternals::OnDisconnectUserCallback callback) {
  _onDisconnectUserCallbacks.push_back(callback);
  return *this;
}

AsyncMqttClient& AsyncMqttClient::onSubscribe(AsyncMqttClientInternals::OnSubscribeUserCallback callback) {
  _onSubscribeUserCallbacks.push_back(callback);
  return *this;
}

AsyncMqttClient& AsyncMqttClient::onUnsubscribe(AsyncMqttClientInternals::OnUnsubscribeUserCallback callback) {
  _onUnsubscribeUserCallbacks.push_back(callback);
  return *this;
}

AsyncMqttClient& AsyncMqttClient::onMessage(AsyncMqttClientInternals::OnMessageUserCallback callback) {
  _onMessageUserCallbacks.push_back(callback);
  return *this;
}

AsyncMqttClient& AsyncMqttClient::onPublish(AsyncMqttClientInternals::OnPublishUserCallback callback) {
  _onPublishUserCallbacks.push_back(callback);
  return *this;
}

void AsyncMqttClient::_freeCurrentParsedPacket() {
  if (_currentParsedPacket) {
    _currentParsedPacket->~Packet();
    _currentParsedPacket = nullptr;
  }
}

void AsyncMqttClient::_clear() {
  _lastPingRequestTime = 0;
  _connected = false;
  _disconnectOnPoll = false;
  _connectPacketNotEnoughSpace = false;
  _tlsBadFingerprint = false;
  _freeCurrentParsedPacket();

  _pendingPubRels.clear();
  _pendingPubRels.shrink_to_fit();

  _toSendAcks.clear();
  _toSendAcks.shrink_to_fit();

  _nextPacketId = 1;
  _parsingInformation.bufferState = AsyncMqttClientInternals::BufferState::NONE;
}

/* TCP */
void AsyncMqttClient::_onConnect(AsyncClient* client) {
  (void)client;

#if ASYNC_TCP_SSL_ENABLED
  if (_secure && _secureServerFingerprints.size() > 0) {
    SSL* clientSsl = _client.getSSL();

    bool sslFoundFingerprint = false;
    for (std::array<uint8_t, SHA1_SIZE> fingerprint : _secureServerFingerprints) {
      if (ssl_match_fingerprint(clientSsl, fingerprint.data()) == SSL_OK) {
        sslFoundFingerprint = true;
        break;
      }
    }

    if (!sslFoundFingerprint) {
      _tlsBadFingerprint = true;
      _client.close(true);
      return;
    }
  }
#endif

  char fixedHeader[5];
  fixedHeader[0] = AsyncMqttClientInternals::PacketType.CONNECT;
  fixedHeader[0] = fixedHeader[0] << 4;
  fixedHeader[0] = fixedHeader[0] | AsyncMqttClientInternals::HeaderFlag.CONNECT_RESERVED;

  uint16_t protocolNameLength = 4;
  char protocolNameLengthBytes[2];
  protocolNameLengthBytes[0] = protocolNameLength >> 8;
  protocolNameLengthBytes[1] = protocolNameLength & 0xFF;

  char connectFlags = 0;
  if (_cleanSession) connectFlags |= AsyncMqttClientInternals::ConnectFlag.CLEAN_SESSION;
  if (_username != nullptr) connectFlags |= AsyncMqttClientInternals::ConnectFlag.USERNAME;
  if (_password != nullptr) connectFlags |= AsyncMqttClientInternals::ConnectFlag.PASSWORD;
  if (_willTopic != nullptr) {
    connectFlags |= AsyncMqttClientInternals::ConnectFlag.WILL;
    if (_willRetain) connectFlags |= AsyncMqttClientInternals::ConnectFlag.WILL_RETAIN;
    connectFlags |= static_cast<char>((_willQos & 0x03) << 3);
  }

  char keepAliveBytes[2];
  keepAliveBytes[0] = _keepAlive >> 8;
  keepAliveBytes[1] = _keepAlive & 0xFF;

  uint16_t clientIdLength = strlen(_clientId);
  char clientIdLengthBytes[2];
  clientIdLengthBytes[0] = clientIdLength >> 8;
  clientIdLengthBytes[1] = clientIdLength & 0xFF;

  // Optional fields
  uint16_t willTopicLength = 0;
  char willTopicLengthBytes[2];
  uint16_t willPayloadLength = _willPayloadLength;
  char willPayloadLengthBytes[2];
  if (_willTopic != nullptr) {
    willTopicLength = strlen(_willTopic);
    willTopicLengthBytes[0] = willTopicLength >> 8;
    willTopicLengthBytes[1] = willTopicLength & 0xFF;

    if (_willPayload != nullptr && willPayloadLength == 0) willPayloadLength = strlen(_willPayload);

    willPayloadLengthBytes[0] = willPayloadLength >> 8;
    willPayloadLengthBytes[1] = willPayloadLength & 0xFF;
  }

  uint16_t usernameLength = 0;
  char usernameLengthBytes[2];
  if (_username != nullptr) {
    usernameLength = strlen(_username);
    usernameLengthBytes[0] = usernameLength >> 8;
    usernameLengthBytes[1] = usernameLength & 0xFF;
  }

  uint16_t passwordLength = 0;
  char passwordLengthBytes[2];
  if (_password != nullptr) {
    passwordLength = strlen(_password);
    passwordLengthBytes[0] = passwordLength >> 8;
    passwordLengthBytes[1] = passwordLength & 0xFF;
  }

  uint32_t remainingLength = 2 + protocolNameLength + 1 + 1 + 2 + 2 + clientIdLength; // always present
  if (_willTopic != nullptr) remainingLength += 2 + willTopicLength + 2 + willPayloadLength;
  if (_username != nullptr) remainingLength += 2 + usernameLength;
  if (_password != nullptr) remainingLength += 2 + passwordLength;
  uint8_t remainingLengthLength =
      AsyncMqttClientInternals::Helpers::encodeRemainingLength(remainingLength, fixedHeader + 1);

  uint32_t neededSpace = 1 + remainingLengthLength;
  neededSpace += 2;
  neededSpace += protocolNameLength;
  neededSpace += 1;
  neededSpace += 1;
  neededSpace += 2;
  neededSpace += 2;
  neededSpace += clientIdLength;
  if (_willTopic != nullptr) {
    neededSpace += 2;
    neededSpace += willTopicLength;

    neededSpace += 2;
    if (_willPayload != nullptr) neededSpace += willPayloadLength;
  }
  if (_username != nullptr) {
    neededSpace += 2;
    neededSpace += usernameLength;
  }
  if (_password != nullptr) {
    neededSpace += 2;
    neededSpace += passwordLength;
  }

  SEMAPHORE_TAKE();
  if (_client.space() < neededSpace) {
    _connectPacketNotEnoughSpace = true;
    _client.close(true);
    SEMAPHORE_GIVE();
    return;
  }

  // Batched connect prefix (fixed header + protocol header + keepalive + clientIdLength) into one single IPC add call
  char connectPrefix[20];
  size_t prefixLen = 1 + remainingLengthLength;
  memcpy(connectPrefix, fixedHeader, prefixLen);
  connectPrefix[prefixLen + 0] = protocolNameLengthBytes[0];
  connectPrefix[prefixLen + 1] = protocolNameLengthBytes[1];
  connectPrefix[prefixLen + 2] = 'M';
  connectPrefix[prefixLen + 3] = 'Q';
  connectPrefix[prefixLen + 4] = 'T';
  connectPrefix[prefixLen + 5] = 'T';
  connectPrefix[prefixLen + 6] = 0x04;
  connectPrefix[prefixLen + 7] = connectFlags;
  connectPrefix[prefixLen + 8] = keepAliveBytes[0];
  connectPrefix[prefixLen + 9] = keepAliveBytes[1];
  connectPrefix[prefixLen + 10] = clientIdLengthBytes[0];
  connectPrefix[prefixLen + 11] = clientIdLengthBytes[1];

  _client.add(connectPrefix, prefixLen + 12);

  _client.add(_clientId, clientIdLength);
  if (_willTopic != nullptr) {
    _client.add(willTopicLengthBytes, 2);
    _client.add(_willTopic, willTopicLength);

    _client.add(willPayloadLengthBytes, 2);
    if (_willPayload != nullptr) _client.add(_willPayload, willPayloadLength);
  }
  if (_username != nullptr) {
    _client.add(usernameLengthBytes, 2);
    _client.add(_username, usernameLength);
  }
  if (_password != nullptr) {
    _client.add(passwordLengthBytes, 2);
    _client.add(_password, passwordLength);
  }
  _client.send();
  _lastClientActivity = millis();
  SEMAPHORE_GIVE();
}

void AsyncMqttClient::_onDisconnect(AsyncClient* client) {
  (void)client;
  AsyncMqttClientDisconnectReason reason;

  if (_connectPacketNotEnoughSpace) {
    reason = AsyncMqttClientDisconnectReason::ESP8266_NOT_ENOUGH_SPACE;
  } else if (_tlsBadFingerprint) {
    reason = AsyncMqttClientDisconnectReason::TLS_BAD_FINGERPRINT;
  } else {
    reason = AsyncMqttClientDisconnectReason::TCP_DISCONNECTED;
  }

  _clear();

  for (const auto& callback : _onDisconnectUserCallbacks)
    callback(reason);
}

void AsyncMqttClient::_onError(AsyncClient* client, int8_t error) {
  (void)client;
  (void)error;
  // _onDisconnect called anyway
}

void AsyncMqttClient::_onTimeout(AsyncClient* client, uint32_t time) {
  (void)client;
  (void)time;
  // disconnection will be handled by ping/pong management
}

void AsyncMqttClient::_onAck(AsyncClient* client, size_t len, uint32_t time) {
  (void)client;
  (void)len;
  (void)time;
}

HOT_PATH void AsyncMqttClient::_onData(AsyncClient* client, uint8_t* data, size_t len) {
  (void)client;
  const uint32_t now = uniuno::asyncmqtt_asm::fast_millis();
  size_t currentBytePosition = 0;
  uint8_t currentByte;
  do {
    switch (_parsingInformation.bufferState) {
    case AsyncMqttClientInternals::BufferState::NONE:
      currentByte = data[currentBytePosition++];
      uniuno::asyncmqtt_asm::asm_extract_header(currentByte, _parsingInformation.packetType,
                                                _parsingInformation.packetFlags);
      _parsingInformation.bufferState = AsyncMqttClientInternals::BufferState::REMAINING_LENGTH;
      _lastServerActivity = now;
      switch (_parsingInformation.packetType) {
      case AsyncMqttClientInternals::PacketType.CONNACK:
        _currentParsedPacket = new (_packetStorage) AsyncMqttClientInternals::ConnAckPacket(
            &_parsingInformation, [this](bool sessionPresent, uint8_t connectReturnCode) {
              this->_onConnAck(sessionPresent, connectReturnCode);
            });
        break;
      case AsyncMqttClientInternals::PacketType.PINGRESP:
        // PINGRESP has remainingLength == 0 and no variable header or payload.
        // Handled directly when remainingLength is decoded without allocating any packet object.
        break;
      case AsyncMqttClientInternals::PacketType.SUBACK:
        _currentParsedPacket = new (_packetStorage) AsyncMqttClientInternals::SubAckPacket(
            &_parsingInformation, [this](uint16_t packetId, char status) { this->_onSubAck(packetId, status); });
        break;
      case AsyncMqttClientInternals::PacketType.UNSUBACK:
        _currentParsedPacket = new (_packetStorage) AsyncMqttClientInternals::UnsubAckPacket(
            &_parsingInformation, [this](uint16_t packetId) { this->_onUnsubAck(packetId); });
        break;
      case AsyncMqttClientInternals::PacketType.PUBLISH:
        _currentParsedPacket = new (_packetStorage) AsyncMqttClientInternals::PublishPacket(
            &_parsingInformation,
            [this](char* topic, char* payload, uint8_t qos, bool dup, bool retain, size_t len, size_t index,
                   size_t total, uint16_t packetId) {
              this->_onMessage(topic, payload, qos, dup, retain, len, index, total, packetId);
            },
            [this](uint16_t packetId, uint8_t qos) { this->_onPublish(packetId, qos); });
        break;
      case AsyncMqttClientInternals::PacketType.PUBREL:
        _currentParsedPacket = new (_packetStorage) AsyncMqttClientInternals::PubRelPacket(
            &_parsingInformation, [this](uint16_t packetId) { this->_onPubRel(packetId); });
        break;
      case AsyncMqttClientInternals::PacketType.PUBACK:
        _currentParsedPacket = new (_packetStorage) AsyncMqttClientInternals::PubAckPacket(
            &_parsingInformation, [this](uint16_t packetId) { this->_onPubAck(packetId); });
        break;
      case AsyncMqttClientInternals::PacketType.PUBREC:
        _currentParsedPacket = new (_packetStorage) AsyncMqttClientInternals::PubRecPacket(
            &_parsingInformation, [this](uint16_t packetId) { this->_onPubRec(packetId); });
        break;
      case AsyncMqttClientInternals::PacketType.PUBCOMP:
        _currentParsedPacket = new (_packetStorage) AsyncMqttClientInternals::PubCompPacket(
            &_parsingInformation, [this](uint16_t packetId) { this->_onPubComp(packetId); });
        break;
      default:
        break;
      }
      break;
    case AsyncMqttClientInternals::BufferState::REMAINING_LENGTH:
      currentByte = data[currentBytePosition++];
      _remainingLengthBuffer[_remainingLengthBufferPosition++] = currentByte;
      if (currentByte >> 7 == 0) {
        _parsingInformation.remainingLength =
            AsyncMqttClientInternals::Helpers::decodeRemainingLength(_remainingLengthBuffer);
        _remainingLengthBufferPosition = 0;
        if (_parsingInformation.remainingLength > 0) {
          _parsingInformation.bufferState = AsyncMqttClientInternals::BufferState::VARIABLE_HEADER;
        } else {
          // PINGRESP is a special case where it has no variable header, so the packet ends right here
          _parsingInformation.bufferState = AsyncMqttClientInternals::BufferState::NONE;
          _onPingResp();
        }
      }
      break;
    case AsyncMqttClientInternals::BufferState::VARIABLE_HEADER:
      _currentParsedPacket->parseVariableHeader(data, len, &currentBytePosition);
      break;
    case AsyncMqttClientInternals::BufferState::PAYLOAD:
      _currentParsedPacket->parsePayload(data, len, &currentBytePosition);
      break;
    default:
      currentBytePosition = len;
    }
  } while (currentBytePosition != len);
}

HOT_PATH void AsyncMqttClient::_onPoll(AsyncClient* client) {
  if (!_connected) return;

  const uint32_t now = uniuno::asyncmqtt_asm::fast_millis();
  const uint32_t ka2x = static_cast<uint32_t>(_keepAlive) * 2000U;
  const uint32_t ka70 = static_cast<uint32_t>(_keepAlive) * 700U;

  // Disconnect if ping response overdue
  if (UNLIKELY(_lastPingRequestTime != 0 && (now - _lastPingRequestTime) >= ka2x)) {
    disconnect();
    return;
  } else if (_lastPingRequestTime == 0 &&
             ((now - _lastClientActivity) >= ka70 || (now - _lastServerActivity) >= ka70)) {
    _sendPing();
  }

  _sendAcks();

  // handle disconnect

  if (_disconnectOnPoll) {
    _sendDisconnect();
  }
}

/* MQTT */
void AsyncMqttClient::_onPingResp() {
  _freeCurrentParsedPacket();
  _lastPingRequestTime = 0;
}

void AsyncMqttClient::_onConnAck(bool sessionPresent, uint8_t connectReturnCode) {
  (void)sessionPresent;
  _freeCurrentParsedPacket();

  if (connectReturnCode == 0) {
    _connected = true;
    for (const auto& callback : _onConnectUserCallbacks)
      callback(sessionPresent);
  } else {
    // Callbacks are handled by the ondisconnect function which is called from the AsyncTcp lib
  }
}

void AsyncMqttClient::_onSubAck(uint16_t packetId, char status) {
  _freeCurrentParsedPacket();

  for (const auto& callback : _onSubscribeUserCallbacks)
    callback(packetId, status);
}

void AsyncMqttClient::_onUnsubAck(uint16_t packetId) {
  _freeCurrentParsedPacket();

  for (const auto& callback : _onUnsubscribeUserCallbacks)
    callback(packetId);
}

void AsyncMqttClient::_onMessage(char* topic, char* payload, uint8_t qos, bool dup, bool retain, size_t len,
                                 size_t index, size_t total, uint16_t packetId) {
  bool notifyPublish = true;

  if (qos == 2) {
    for (const auto& pendingPubRel : _pendingPubRels) {
      if (pendingPubRel.packetId == packetId) {
        notifyPublish = false;
        break;
      }
    }
  }

  if (notifyPublish) {
    AsyncMqttClientMessageProperties properties;
    properties.qos = qos;
    properties.dup = dup;
    properties.retain = retain;

    for (const auto& callback : _onMessageUserCallbacks)
      callback(topic, payload, properties, len, index, total);
  }
}

void AsyncMqttClient::_onPublish(uint16_t packetId, uint8_t qos) {
  AsyncMqttClientInternals::PendingAck pendingAck;

  if (qos == 1) {
    pendingAck.packetType = AsyncMqttClientInternals::PacketType.PUBACK;
    pendingAck.headerFlag = AsyncMqttClientInternals::HeaderFlag.PUBACK_RESERVED;
    pendingAck.packetId = packetId;
    _toSendAcks.push_back(pendingAck);
  } else if (qos == 2) {
    pendingAck.packetType = AsyncMqttClientInternals::PacketType.PUBREC;
    pendingAck.headerFlag = AsyncMqttClientInternals::HeaderFlag.PUBREC_RESERVED;
    pendingAck.packetId = packetId;
    _toSendAcks.push_back(pendingAck);

    bool pubRelAwaiting = false;
    for (const auto& pendingPubRel : _pendingPubRels) {
      if (pendingPubRel.packetId == packetId) {
        pubRelAwaiting = true;
        break;
      }
    }

    if (!pubRelAwaiting) {
      AsyncMqttClientInternals::PendingPubRel pendingPubRel;
      pendingPubRel.packetId = packetId;
      _pendingPubRels.push_back(pendingPubRel);
    }

    _sendAcks();
  }

  _freeCurrentParsedPacket();
}

void AsyncMqttClient::_onPubRel(uint16_t packetId) {
  _freeCurrentParsedPacket();

  AsyncMqttClientInternals::PendingAck pendingAck;
  pendingAck.packetType = AsyncMqttClientInternals::PacketType.PUBCOMP;
  pendingAck.headerFlag = AsyncMqttClientInternals::HeaderFlag.PUBCOMP_RESERVED;
  pendingAck.packetId = packetId;
  _toSendAcks.push_back(pendingAck);

  for (size_t i = 0; i < _pendingPubRels.size(); i++) {
    if (_pendingPubRels[i].packetId == packetId) {
      _pendingPubRels.erase_unordered(i);
      break;
    }
  }

  _sendAcks();
}

void AsyncMqttClient::_onPubAck(uint16_t packetId) {
  _freeCurrentParsedPacket();

  for (const auto& callback : _onPublishUserCallbacks)
    callback(packetId);
}

void AsyncMqttClient::_onPubRec(uint16_t packetId) {
  _freeCurrentParsedPacket();

  AsyncMqttClientInternals::PendingAck pendingAck;
  pendingAck.packetType = AsyncMqttClientInternals::PacketType.PUBREL;
  pendingAck.headerFlag = AsyncMqttClientInternals::HeaderFlag.PUBREL_RESERVED;
  pendingAck.packetId = packetId;
  _toSendAcks.push_back(pendingAck);

  _sendAcks();
}

void AsyncMqttClient::_onPubComp(uint16_t packetId) {
  _freeCurrentParsedPacket();

  for (const auto& callback : _onPublishUserCallbacks)
    callback(packetId);
}

bool AsyncMqttClient::_sendPing() {
  const char fixedHeader[2] = {static_cast<char>((AsyncMqttClientInternals::PacketType.PINGREQ << 4) |
                                                 AsyncMqttClientInternals::HeaderFlag.PINGREQ_RESERVED),
                               0};

  SEMAPHORE_TAKE(false);
  if (_client.space() < 2U) {
    SEMAPHORE_GIVE();
    return false;
  }

  _client.write(fixedHeader, 2U);
  const uint32_t now = uniuno::asyncmqtt_asm::fast_millis();
  _lastClientActivity = now;
  _lastPingRequestTime = now;

  SEMAPHORE_GIVE();
  return true;
}

void AsyncMqttClient::_sendAcks() {
  if (_toSendAcks.empty()) return;

  SEMAPHORE_TAKE();
  const size_t totalAcks = _toSendAcks.size();
  const size_t availSpace = _client.space();
  const size_t maxBySpace = availSpace >> 2;
  const size_t sendCount = uniuno::asyncmqtt_asm::asm_min(totalAcks, maxBySpace);

  if (sendCount > 0U) {
    // Batch up to 32 ACKs (128 bytes) into one atomic tcp_write+tcp_output IPC
    char ackBuf[128];
    size_t idx = 0U;
    while (idx < sendCount) {
      const size_t batch = uniuno::asyncmqtt_asm::asm_min(sendCount - idx, static_cast<size_t>(32U));
      for (size_t j = 0U; j < batch; ++j) {
        const auto& pendingAck = _toSendAcks[idx + j];
        char* p = ackBuf + (j << 2);
        p[0] = static_cast<char>((pendingAck.packetType << 4) | pendingAck.headerFlag);
        p[1] = 2;
        uniuno::asyncmqtt_asm::asm_split_uint16(pendingAck.packetId, p[2], p[3]);
      }
      _client.write(ackBuf, batch << 2);
      idx += batch;
    }

    if (LIKELY(sendCount == totalAcks)) {
      _toSendAcks.clear();
    } else {
      for (size_t rem = sendCount; rem > 0U; --rem) {
        _toSendAcks.erase(static_cast<std::size_t>(0));
      }
    }
    _lastClientActivity = uniuno::asyncmqtt_asm::fast_millis();
  }
  SEMAPHORE_GIVE();
}

bool AsyncMqttClient::_sendDisconnect() {
  if (!_connected) return true;

  const uint8_t neededSpace = 2;

  SEMAPHORE_TAKE(false);

  if (_client.space() < neededSpace) {
    SEMAPHORE_GIVE();
    return false;
  }

  char fixedHeader[2];
  fixedHeader[0] = AsyncMqttClientInternals::PacketType.DISCONNECT;
  fixedHeader[0] = fixedHeader[0] << 4;
  fixedHeader[0] = fixedHeader[0] | AsyncMqttClientInternals::HeaderFlag.DISCONNECT_RESERVED;
  fixedHeader[1] = 0;

  _client.add(fixedHeader, 2);
  _client.send();
  _client.close(true);

  _disconnectOnPoll = false;

  SEMAPHORE_GIVE();
  return true;
}

uint16_t AsyncMqttClient::_getNextPacketId() {
  uint16_t nextPacketId = _nextPacketId;

  if (_nextPacketId == 65535) _nextPacketId = 0; // 0 is forbidden
  _nextPacketId++;

  return nextPacketId;
}

bool AsyncMqttClient::connected() const {
  return _connected;
}

void AsyncMqttClient::connect() {
  if (_connected) return;

#if ASYNC_TCP_SSL_ENABLED
  if (_useIp) {
    _client.connect(_ip, _port, _secure);
  } else {
    _client.connect(_host, _port, _secure);
  }
#else
  if (_useIp) {
    _client.connect(_ip, _port);
  } else {
    _client.connect(_host, _port);
  }
#endif
}

void AsyncMqttClient::disconnect(bool force) {
  if (!_connected) return;

  if (force) {
    _client.close(true);
  } else {
    _sendDisconnect();
    _disconnectOnPoll = false;
  }
}

uint16_t AsyncMqttClient::subscribe(const char* topic, uint8_t qos) {
  if (!_connected) return 0;

  char fixedHeader[5];
  fixedHeader[0] = AsyncMqttClientInternals::PacketType.SUBSCRIBE;
  fixedHeader[0] = fixedHeader[0] << 4;
  fixedHeader[0] = fixedHeader[0] | AsyncMqttClientInternals::HeaderFlag.SUBSCRIBE_RESERVED;

  uint16_t topicLength = strlen(topic);
  char topicLengthBytes[2];
  uniuno::asyncmqtt_asm::asm_split_uint16(topicLength, topicLengthBytes[0], topicLengthBytes[1]);

  char qosByte[1];
  qosByte[0] = qos;

  uint8_t remainingLengthLength =
      AsyncMqttClientInternals::Helpers::encodeRemainingLength(2 + 2 + topicLength + 1, fixedHeader + 1);

  size_t neededSpace = 0;
  neededSpace += 1 + remainingLengthLength;
  neededSpace += 2;
  neededSpace += 2;
  neededSpace += topicLength;
  neededSpace += 1;

  SEMAPHORE_TAKE(0);
  if (_client.space() < neededSpace) {
    SEMAPHORE_GIVE();
    return 0;
  }

  uint16_t packetId = _getNextPacketId();
  char packetIdBytes[2];
  uniuno::asyncmqtt_asm::asm_split_uint16(packetId, packetIdBytes[0], packetIdBytes[1]);

  char subHeaderBuf[11];
  size_t subHLen = 1 + remainingLengthLength;
  memcpy(subHeaderBuf, fixedHeader, subHLen);
  subHeaderBuf[subHLen++] = packetIdBytes[0];
  subHeaderBuf[subHLen++] = packetIdBytes[1];
  subHeaderBuf[subHLen++] = topicLengthBytes[0];
  subHeaderBuf[subHLen++] = topicLengthBytes[1];

  if (LIKELY(neededSpace <= 256U)) {
    char txBuf[256];
    memcpy(txBuf, subHeaderBuf, subHLen);
    memcpy(txBuf + subHLen, topic, topicLength);
    txBuf[subHLen + topicLength] = qosByte[0];
    _client.write(txBuf, neededSpace);
  } else {
    _client.add(subHeaderBuf, subHLen);
    _client.add(topic, topicLength);
    _client.write(qosByte, 1);
  }
  _lastClientActivity = uniuno::asyncmqtt_asm::fast_millis();

  SEMAPHORE_GIVE();
  return packetId;
}

uint16_t AsyncMqttClient::unsubscribe(const char* topic) {
  if (!_connected) return 0;

  char fixedHeader[5];
  fixedHeader[0] = AsyncMqttClientInternals::PacketType.UNSUBSCRIBE;
  fixedHeader[0] = fixedHeader[0] << 4;
  fixedHeader[0] = fixedHeader[0] | AsyncMqttClientInternals::HeaderFlag.UNSUBSCRIBE_RESERVED;

  uint16_t topicLength = strlen(topic);
  char topicLengthBytes[2];
  uniuno::asyncmqtt_asm::asm_split_uint16(topicLength, topicLengthBytes[0], topicLengthBytes[1]);

  uint8_t remainingLengthLength =
      AsyncMqttClientInternals::Helpers::encodeRemainingLength(2 + 2 + topicLength, fixedHeader + 1);

  size_t neededSpace = 0;
  neededSpace += 1 + remainingLengthLength;
  neededSpace += 2;
  neededSpace += 2;
  neededSpace += topicLength;

  SEMAPHORE_TAKE(0);
  if (_client.space() < neededSpace) {
    SEMAPHORE_GIVE();
    return 0;
  }

  uint16_t packetId = _getNextPacketId();
  char packetIdBytes[2];
  uniuno::asyncmqtt_asm::asm_split_uint16(packetId, packetIdBytes[0], packetIdBytes[1]);

  char unsubHeaderBuf[11];
  size_t unsubHLen = 1 + remainingLengthLength;
  memcpy(unsubHeaderBuf, fixedHeader, unsubHLen);
  unsubHeaderBuf[unsubHLen++] = packetIdBytes[0];
  unsubHeaderBuf[unsubHLen++] = packetIdBytes[1];
  unsubHeaderBuf[unsubHLen++] = topicLengthBytes[0];
  unsubHeaderBuf[unsubHLen++] = topicLengthBytes[1];

  if (LIKELY(neededSpace <= 256U)) {
    char txBuf[256];
    memcpy(txBuf, unsubHeaderBuf, unsubHLen);
    memcpy(txBuf + unsubHLen, topic, topicLength);
    _client.write(txBuf, neededSpace);
  } else {
    _client.add(unsubHeaderBuf, unsubHLen);
    _client.write(topic, topicLength);
  }
  _lastClientActivity = uniuno::asyncmqtt_asm::fast_millis();

  SEMAPHORE_GIVE();
  return packetId;
}

HOT_PATH uint16_t AsyncMqttClient::publish(const char* topic, uint8_t qos, bool retain, const char* payload,
                                           size_t length, bool dup, uint16_t message_id) {
  if (UNLIKELY(!_connected)) return 0;

  char fixedHeader[5];
  fixedHeader[0] = static_cast<char>(0x30 | ((dup & 1) << 3) | ((qos & 0x03) << 1) | (retain & 1));

  const uint16_t topicLength = static_cast<uint16_t>(uniuno::xtensa_asm::asm_strlen(topic));
  char topicLengthBytes[2];
  uniuno::asyncmqtt_asm::asm_split_uint16(topicLength, topicLengthBytes[0], topicLengthBytes[1]);

  uint32_t payloadLength = static_cast<uint32_t>(length);
  if (payload != nullptr && payloadLength == 0U) {
    payloadLength = static_cast<uint32_t>(uniuno::xtensa_asm::asm_strlen(payload));
  }

  uint32_t remainingLength = 2U + topicLength + payloadLength;
  if (qos != 0) remainingLength += 2U;
  const uint8_t remainingLengthLength =
      AsyncMqttClientInternals::Helpers::encodeRemainingLength(remainingLength, fixedHeader + 1);

  const size_t headerLen = static_cast<size_t>(1U + remainingLengthLength);
  const size_t prefixLen = headerLen + 2U;
  const size_t neededSpace =
      prefixLen + topicLength + ((qos != 0) ? 2U : 0U) + ((payload != nullptr) ? payloadLength : 0U);

  SEMAPHORE_TAKE(0);
  if (UNLIKELY(_client.space() < neededSpace)) {
    SEMAPHORE_GIVE();
    return 0;
  }

  uint16_t packetId = 0;
  char packetIdBytes[2];
  if (qos != 0) {
    packetId = (dup && message_id > 0) ? message_id : _getNextPacketId();
    uniuno::asyncmqtt_asm::asm_split_uint16(packetId, packetIdBytes[0], packetIdBytes[1]);
  }

  // Coalesce up to 512B publishes into one single atomic tcp_write+tcp_output IPC
  if (LIKELY(neededSpace <= 512U)) {
    char txBuf[512];
    memcpy(txBuf, fixedHeader, headerLen);
    txBuf[headerLen] = topicLengthBytes[0];
    txBuf[headerLen + 1U] = topicLengthBytes[1];
    size_t pos = prefixLen;
    memcpy(txBuf + pos, topic, topicLength);
    pos += topicLength;
    if (qos != 0) {
      txBuf[pos++] = packetIdBytes[0];
      txBuf[pos++] = packetIdBytes[1];
    }
    if (payload != nullptr && payloadLength > 0U) {
      memcpy(txBuf + pos, payload, payloadLength);
    }
    _client.write(txBuf, neededSpace);
  } else {
    char pubHeaderBuf[9];
    memcpy(pubHeaderBuf, fixedHeader, headerLen);
    pubHeaderBuf[headerLen] = topicLengthBytes[0];
    pubHeaderBuf[headerLen + 1U] = topicLengthBytes[1];
    _client.add(pubHeaderBuf, prefixLen);
    _client.add(topic, topicLength);
    if (qos != 0) _client.add(packetIdBytes, 2U);
    if (payload != nullptr && payloadLength > 0U) {
      _client.write(payload, payloadLength);
    } else {
      _client.send();
    }
  }
  _lastClientActivity = uniuno::asyncmqtt_asm::fast_millis();

  SEMAPHORE_GIVE();
  if (qos != 0) {
    return packetId;
  } else {
    return 1;
  }
}

const char* AsyncMqttClient::getClientId() {
  return _clientId;
}
