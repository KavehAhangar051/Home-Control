#pragma once

#include <tiny_websockets/internals/ws_common.hpp>
#include <tiny_websockets/network/tcp_client.hpp>

namespace websockets { namespace network {
  template <class WifiClientImpl> 
  class GenericEspTcpClient : public TcpClient {
  public:
    GenericEspTcpClient(WifiClientImpl c) : client(c) {
      client.setNoDelay(true);
    }
    
    GenericEspTcpClient() {}

    bool connect(const WSString& host, const int port) {
      auto didConnect = client.connect(host.c_str(), port);
      if (didConnect) {
        client.setNoDelay(true);
      }
      return didConnect;
    }

    bool poll() override {
      return client.available() > 0;
    }

    bool available() override {
      return client.connected();
    }

    void send(const WSString& data) override {
      client.write(reinterpret_cast<const uint8_t*>(data.c_str()), data.size());
    }

    void send(const WSString&& data) override {
      client.write(reinterpret_cast<const uint8_t*>(data.c_str()), data.size());
    }

    void send(const uint8_t* data, const uint32_t len) override {
      client.write(data, len);
    }
    
    WSString readLine() override {
      WSString line = "";

      int ch = -1;

      const uint64_t millisBeforeReadingHeaders = millis();
      while( ch != '\n' && available()) {
        if (millis() - millisBeforeReadingHeaders > _CONNECTION_TIMEOUT) return "";
        ch = client.read();
        if (ch < 0) continue;
        line += (char) ch;
      }

      return line;
    }

    uint32_t read(uint8_t* buffer, const uint32_t len) override {
      if (len == 0U) return 0U;
      const int r = client.read(buffer, len);
      return (r > 0) ? static_cast<uint32_t>(r) : 0U;
    }

    void close() override {
      client.stop();
    }

    virtual ~GenericEspTcpClient() {
      client.stop();
    }

  protected:
    WifiClientImpl client;

    int getSocket() const override {
      return -1;
    }    
  };
}} // websockets::network
