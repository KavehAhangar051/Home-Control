#ifndef GLOBALS_H
#define GLOBALS_H

#include <INetworkManager.h>
#include <PinManager.h>
#include <AuxNodeManager.h>
#include <AchaemenidMQTT.h>
#include <Timer/Timer.h>
#include <Events/EventDispatcher.h>
#include <Core/Async/Executor.h>
// Forward declarations
namespace uniuno {
class AchaemenidWebSocketClient;
class AchaemenidWebSocketServer;
class MqttCommandDispatcher;
class ISegmentStorage;
class IAuxNodeStorage;
} // namespace uniuno
class BootManager;
class RuleEngine;

// =============================================
// Configuration
// =============================================
extern const char* WIFI_SSID;
extern const char* WIFI_PASSWORD;

// =============================================
// Global Objects
// =============================================
extern uniuno::INetworkManager* network;
extern String rawConfigPayload;
extern PinManager pinManager;
extern AuxNodeManager auxNodeManager;
extern uniuno::AchaemenidMQTT mqttClient;
extern uniuno::Timer* appTimer;
extern uniuno::EventDispatcher eventBus;
extern uniuno::Executor executor;
extern uniuno::AchaemenidWebSocketClient* wsClient;
extern uniuno::AchaemenidWebSocketServer* wsServer;
extern uniuno::MqttCommandDispatcher* mqttDispatcher;
extern RuleEngine* ruleEngine;
extern BootManager* bootManager;
extern uniuno::ISegmentStorage* segmentStorage;
extern uniuno::IAuxNodeStorage* auxNodeStorage;

// =============================================
// State Variables
// =============================================
extern bool configLoaded;
extern bool configFetchStarted;
extern bool ntpSynced;
extern bool isDashboardOnline;
extern uniuno::TimerHandle dashboardTimeoutTimer;

#endif // GLOBALS_H
