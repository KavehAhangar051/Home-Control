#include <tiny_websockets/internals/websockets_endpoint.hpp>
#include <ArduinoWebsocketsAsm.h>
#include <memory>

namespace websockets { 

    CloseReason GetCloseReason(uint16_t reasonCode) {
        switch(reasonCode) {
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

            default: return CloseReason_None;
        }
    }    

namespace internals {

    uint32_t swapEndianess(uint32_t num) {
        uint32_t highest = (num >> 24);
        uint32_t second = (num << 8) >> 24;
        uint32_t third = (num << 16) >> 24;
        uint32_t lowest = (num << 24) >> 24;

        return highest | (second << 8) | (third << 16) | (lowest << 24);
    }

    uint64_t swapEndianess(uint64_t num) {
        uint32_t upper = (num >> 32);
        uint32_t lower = (num << 32) >> 32;
    
        upper = swapEndianess(upper);
        lower = swapEndianess(lower);
    
        uint64_t upperLong = upper;
        uint64_t lowerLong = lower;
        
        return upperLong | (lowerLong << 32);
    }

    WebsocketsEndpoint::WebsocketsEndpoint(std::shared_ptr<network::TcpClient> client, FragmentsPolicy fragmentsPolicy) : 
        _client(client),
        _fragmentsPolicy(fragmentsPolicy),
        _recvMode(RecvMode_Normal),
        _streamBuilder(fragmentsPolicy == FragmentsPolicy_Notify? true: false),
        _closeReason(CloseReason_None) {
        // Empty
    }

    WebsocketsEndpoint::WebsocketsEndpoint(const WebsocketsEndpoint& other) : 
        _client(other._client), 
        _fragmentsPolicy(other._fragmentsPolicy), 
        _recvMode(other._recvMode), 
        _streamBuilder(other._streamBuilder), 
        _closeReason(other._closeReason),
        _useMasking(other._useMasking) {

        const_cast<WebsocketsEndpoint&>(other)._client = nullptr;
    }
    WebsocketsEndpoint::WebsocketsEndpoint(const WebsocketsEndpoint&& other) : 
        _client(other._client), 
        _fragmentsPolicy(other._fragmentsPolicy), 
        _recvMode(other._recvMode), 
        _streamBuilder(other._streamBuilder), 
        _closeReason(other._closeReason),
        _useMasking(other._useMasking) {

        const_cast<WebsocketsEndpoint&>(other)._client = nullptr;
    }

    WebsocketsEndpoint& WebsocketsEndpoint::operator=(const WebsocketsEndpoint& other) {
        this->_client = other._client;
        this->_fragmentsPolicy = other._fragmentsPolicy;
        this->_recvMode = other._recvMode;
        this->_streamBuilder = other._streamBuilder;
        this->_closeReason = other._closeReason;
        this->_useMasking = other._useMasking;

        const_cast<WebsocketsEndpoint&>(other)._client = nullptr;

        return *this;
    }
    WebsocketsEndpoint& WebsocketsEndpoint::operator=(const WebsocketsEndpoint&& other) {
        this->_client = other._client;
        this->_fragmentsPolicy = other._fragmentsPolicy;
        this->_recvMode = other._recvMode;
        this->_streamBuilder = other._streamBuilder;
        this->_closeReason = other._closeReason;
        this->_useMasking = other._useMasking;

        const_cast<WebsocketsEndpoint&>(other)._client = nullptr;

        return *this;
    }

    void WebsocketsEndpoint::setInternalSocket(std::shared_ptr<network::TcpClient> socket) {
        this->_client = socket;
    }

    bool WebsocketsEndpoint::poll() {
        return this->_client->poll();
    }

    uint32_t readUntilSuccessfullOrError(network::TcpClient& socket, uint8_t* buffer, const uint32_t len) {
        auto numRead = socket.read(buffer, len);
        while(numRead == static_cast<uint32_t>(-1) && socket.available()) {
            numRead = socket.read(buffer, len);
        }
        return numRead;
    }

    Header readHeaderFromSocket(network::TcpClient& socket) {
        Header header;
        header.payload = 0;
        readUntilSuccessfullOrError(socket, reinterpret_cast<uint8_t*>(&header), 2);
        return header;
    }

    uint64_t readExtendedPayloadLength(network::TcpClient& socket, const Header& header) {
        uint64_t extendedPayload = header.payload;
        // in case of extended payload length
        if (header.payload == 126) {
            // read next 16 bits as payload length
            uint16_t tmp = 0;
            readUntilSuccessfullOrError(socket, reinterpret_cast<uint8_t*>(&tmp), 2);
            tmp = (tmp << 8) | (tmp >> 8);
            extendedPayload = tmp;
        }
        else if (header.payload == 127) {
            uint64_t tmp = 0;
            readUntilSuccessfullOrError(socket, reinterpret_cast<uint8_t*>(&tmp), 8);
            extendedPayload = swapEndianess(tmp);
        }

        return extendedPayload;
    }

    void readMaskingKey(network::TcpClient& socket, uint8_t* outputBuffer) {
        readUntilSuccessfullOrError(socket, reinterpret_cast<uint8_t*>(outputBuffer), 4);
    }

    WSString readData(network::TcpClient& socket, uint64_t extendedPayload) {
        WSString data(extendedPayload, '\0');
        uint64_t done_reading = 0;
        while (done_reading < extendedPayload && socket.available()) {
            uint32_t to_read = (extendedPayload - done_reading >= 1024) 
                ? 1024 
                : static_cast<uint32_t>(extendedPayload - done_reading);
            uint32_t numReceived = readUntilSuccessfullOrError(socket, 
                reinterpret_cast<uint8_t*>(&data[done_reading]), to_read);

            // On failed reads or EOF, terminate
            if(!socket.available() || numReceived == static_cast<uint32_t>(-1) || numReceived == 0) break;

            done_reading += numReceived;
        }
        if (done_reading < extendedPayload) {
            data.resize(done_reading);
        }
        return data;
    }

    void remaskData(WSString& data, const uint8_t* const maskingKey, uint64_t payloadLength) {
        if (payloadLength > 0 && !data.empty()) {
            asm_opt::fast_mask(reinterpret_cast<uint8_t*>(&data[0]), static_cast<size_t>(payloadLength), maskingKey);
        }
    }

    WebsocketsFrame WebsocketsEndpoint::_recv() {
        auto header = readHeaderFromSocket(*this->_client);
        if(!_client->available()) return WebsocketsFrame(); // In case of faliure

        uint64_t payloadLength = readExtendedPayloadLength(*this->_client, header);
        if(!_client->available()) return WebsocketsFrame(); // In case of faliure

#ifdef _WS_CONFIG_MAX_MESSAGE_SIZE
        if(payloadLength > _WS_CONFIG_MAX_MESSAGE_SIZE) {
            return WebsocketsFrame();
        }
#endif

        uint8_t maskingKey[4];
        // if masking is set
        if (header.mask) {
            readMaskingKey(*this->_client, maskingKey);
            if(!_client->available()) return WebsocketsFrame(); // In case of faliure
        }

        WebsocketsFrame frame;
        // read the message's payload (data) according to the read length
        frame.payload = readData(*this->_client, payloadLength);
        if(!_client->available()) return WebsocketsFrame(); // In case of faliure

        // if masking is set un-mask the message
        if (header.mask) {
            remaskData(frame.payload, maskingKey, payloadLength);
        }

        // Construct frame from data and header that was read
        frame.fin = header.fin;
        frame.mask = header.mask;

        frame.mask_buf[0] = maskingKey[0];
        frame.mask_buf[1] = maskingKey[1];
        frame.mask_buf[2] = maskingKey[2];
        frame.mask_buf[3] = maskingKey[3];

        frame.opcode = header.opcode;
        frame.payload_length = payloadLength;

        return frame;
    }

    WebsocketsMessage WebsocketsEndpoint::handleFrameInStreamingMode(WebsocketsFrame& frame) {
        if(frame.isControlFrame()) {
            auto msg = WebsocketsMessage::CreateFromFrame(std::move(frame));
            this->handleMessageInternally(msg);
            return msg;
        }
        else if(frame.isBeginningOfFragmentsStream()) {
            this->_recvMode = RecvMode_Streaming;

            if(this->_streamBuilder.isEmpty()) {
                this->_streamBuilder.first(frame);
                // if policy is set to notify, return the frame to the user
                if(this->_fragmentsPolicy == FragmentsPolicy_Notify) {
                    return WebsocketsMessage(this->_streamBuilder.type(), std::move(frame.payload), MessageRole::First);
                }
                else return {};
            }
        }
        else if(frame.isContinuesFragment()) {
            this->_streamBuilder.append(frame);
            if(this->_streamBuilder.isOk()) {
                // if policy is set to notify, return the frame to the user
                if(this->_fragmentsPolicy == FragmentsPolicy_Notify) {
                    return WebsocketsMessage(this->_streamBuilder.type(), std::move(frame.payload), MessageRole::Continuation);
                }
                else return {};
            }
        }
        else if(frame.isEndOfFragmentsStream()) {
            this->_recvMode = RecvMode_Normal;
            this->_streamBuilder.end(frame);
            if(this->_streamBuilder.isOk()) {
                // if policy is set to notify, return the frame to the user
                if(this->_fragmentsPolicy == FragmentsPolicy_Aggregate) {
                    auto completeMessage = this->_streamBuilder.build();
                    this->_streamBuilder = WebsocketsMessage::StreamBuilder(false);
                    this->handleMessageInternally(completeMessage);
                    return completeMessage;
                }
                else { // in case of notify policy
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
        if(frame.isNormalUnfragmentedMessage() || frame.isControlFrame()) {
            auto msg = WebsocketsMessage::CreateFromFrame(std::move(frame));
            this->handleMessageInternally(msg);
            return msg;
        } 
        else if(frame.isBeginningOfFragmentsStream()) {
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

        if(this->_recvMode == RecvMode_Normal) {
            return handleFrameInStandardMode(frame);
        } 
        else /* this->_recvMode == RecvMode_Streaming */ {
            return handleFrameInStreamingMode(frame);
        }
    }

    void WebsocketsEndpoint::handleMessageInternally(WebsocketsMessage& msg) {
        if(msg.isPing()) {
            pong(internals::fromInterfaceString(msg.data()));
        } else if(msg.isClose()) {
            // is there a reason field
            if(internals::fromInterfaceString(msg.data()).size() >= 2) {
                uint16_t reason = *(reinterpret_cast<const uint16_t*>(msg.data().c_str()));
                reason = reason >> 8 | reason << 8;
                this->_closeReason = GetCloseReason(reason);
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

    bool WebsocketsEndpoint::send(const WSString& data, const uint8_t opcode, const bool fin, const bool mask, const char* maskingKey) { 
        return send(data.c_str(), data.size(), opcode, fin, mask, maskingKey);
    }

    static size_t formatHeaderBytes(uint8_t* out, uint64_t len, uint8_t opcode, bool fin, bool mask) {
        out[0] = (fin ? 0x80 : 0x00) | (opcode & 0x0F);
        uint8_t mask_bit = mask ? 0x80 : 0x00;

        if (len < 126) {
            out[1] = mask_bit | static_cast<uint8_t>(len);
            return 2;
        } else if (len < 65536) {
            out[1] = mask_bit | 126;
            out[2] = static_cast<uint8_t>(len >> 8);
            out[3] = static_cast<uint8_t>(len & 0xFF);
            return 4;
        } else {
            out[1] = mask_bit | 127;
            for (int i = 7; i >= 0; --i) {
                out[2 + (7 - i)] = static_cast<uint8_t>((len >> (i * 8)) & 0xFF);
            }
            return 10;
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

    bool WebsocketsEndpoint::send(const char* data, const size_t len, const uint8_t opcode, const bool fin, const bool mask, const char* maskingKey) {
#ifdef _WS_CONFIG_MAX_MESSAGE_SIZE
        if(len > _WS_CONFIG_MAX_MESSAGE_SIZE) {
            return false;
        }
#endif
        // Zero-heap fast path for frames up to 1536 bytes
        static constexpr size_t kStackFrameLimit = 1536;
        if (len <= kStackFrameLimit) {
            uint8_t frame_buf[kStackFrameLimit + 14];
            size_t frame_len = formatHeaderBytes(frame_buf, len, opcode, fin, mask);

            if (mask) {
                memcpy(frame_buf + frame_len, maskingKey, 4);
                frame_len += 4;
            }

            if (len > 0 && data != nullptr) {
                memcpy(frame_buf + frame_len, data, len);
                if (mask && memcmp(maskingKey, __TINY_WS_INTERNAL_DEFAULT_MASK, 4) != 0) {
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
            if (mask && memcmp(maskingKey, __TINY_WS_INTERNAL_DEFAULT_MASK, 4) != 0) {
                asm_opt::fast_mask(heap_buf.get() + frame_len, len, reinterpret_cast<const uint8_t*>(maskingKey));
            }
            frame_len += len;
        }

        this->_client->send(heap_buf.get(), frame_len);
        return true;
    }

    void WebsocketsEndpoint::close(CloseReason reason) {
        this->_closeReason = reason;
        
        if(!this->_client->available()) return;

        if(reason == CloseReason_None) {
            send(nullptr, 0, internals::ContentType::Close, true, this->_useMasking);
        } else {
            uint16_t reasonNum = static_cast<uint16_t>(reason);
            reasonNum = (reasonNum >> 8) | (reasonNum << 8);
            send(reinterpret_cast<const char*>(&reasonNum), 2, internals::ContentType::Close, true, this->_useMasking);
        }
        this->_client->close();
    }

    CloseReason WebsocketsEndpoint::getCloseReason() const {
        return _closeReason;
    }

    bool WebsocketsEndpoint::ping(const WSString& msg) {
        // Ping data must be shorter than 125 bytes
        if(msg.size() > 125) {
            return false;
        }
        else {
            return send(msg, ContentType::Ping, true, this->_useMasking);
        }
    }
    bool WebsocketsEndpoint::ping(const WSString&& msg) {
        // Ping data must be shorter than 125 bytes
        if(msg.size() > 125) {
            return false;
        }
        else {
            return send(msg, ContentType::Ping, true, this->_useMasking);
        }
    }

    bool WebsocketsEndpoint::pong(const WSString& msg) {
        // Pong data must be shorter than 125 bytes
        if(msg.size() > 125)  {
            return false;
        }
        else {
            return this->send(msg, ContentType::Pong, true, this->_useMasking);
        }
    }
    bool WebsocketsEndpoint::pong(const WSString&& msg) {
        // Pong data must be shorter than 125 bytes
        if(msg.size() > 125)  {
            return false;
        }
        else {
            return this->send(msg, ContentType::Pong, true, this->_useMasking);
        }
    }

    void WebsocketsEndpoint::setFragmentsPolicy(FragmentsPolicy newPolicy) {
        this->_fragmentsPolicy = newPolicy;
    }

    FragmentsPolicy WebsocketsEndpoint::getFragmentsPolicy() const {
        return this->_fragmentsPolicy;
    }

    WebsocketsEndpoint::~WebsocketsEndpoint() {}
}} // websockets::internals
