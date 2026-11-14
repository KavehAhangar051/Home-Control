#ifndef BOOT_MANAGER_H
#define BOOT_MANAGER_H

#include <INetworkManager.h>
#include <PinManager.h>
#include <Timer/Timer.h>
#include <Events/IEventDispatcher.h>
#include <Core/Async/Executor.h>
#include <Optimization/StaticFunction.h>
#include <Optimization/CompilerTraits.h>
#include <WebServer.h>
#include "ISegmentStorage.h"

struct BootContext {
    uniuno::INetworkManager* network;
    PinManager* pinManager;
    uniuno::Executor* executor;
    uniuno::IEventDispatcher* eventBus;
    uniuno::Timer* appTimer;
    uniuno::ISegmentStorage* segmentStorage;
    bool* configLoadedFlag;
    String* rawConfigPayload;
};

enum class BootState : uint8_t {
    CONNECT_WIFI = 0,
    DONE = 1,
    PROVISIONING = 2,
    RECONNECTING = 3
};

class BootManager {
private:
    BootContext ctx_;
    BootState state_;
    uniuno::Future<void, void> wifiFut_;
    unsigned long fetchConfigStartTime_;
    unsigned long lastReconnectAttempt_;
    WebServer provisioningServer_{80};
    bool provisioningServerStarted_;

    uniuno::AsyncResult<void> bootPollFn();
    void bootErrorFn(uniuno::Error e);
    void startProvisioningPortal();
    static void restartFn();

public:
    BootManager();
    void startBootSequenceAsync(BootContext ctx);
    void loop();
};

#endif // BOOT_MANAGER_H
