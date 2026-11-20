#pragma once
#include <memory>

namespace websockets {
namespace network {

class TcpClient {
public:
    virtual ~TcpClient() = default;
};

template <typename TClient>
class GenericEspTcpClient : public TcpClient {
public:
    TClient client;
};

} // namespace network
} // namespace websockets
