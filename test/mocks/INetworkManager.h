#pragma once

#include <Future.h>
#include <Optimization/CompilerTraits.h>

namespace uniuno {

class WiFiConnector;

class INetworkManager {
public:
    virtual ~INetworkManager() = default;
    virtual void add_access_point(const char* ssid, const char* password) = 0;
    virtual Future<void, void, Error> connectAsync() = 0;
    virtual bool isConnected() const = 0;
    virtual WiFiConnector* getConnector() = 0;
};

} // namespace uniuno
