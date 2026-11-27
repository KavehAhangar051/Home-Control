#ifndef BOOT_MANAGER_H
#define BOOT_MANAGER_H

#include <INetworkManager.h>
#include <PinManager.h>
#include <AuxNodeManager.h>
#include <Timer/Timer.h>
#include <Events/IEventDispatcher.h>
#include <Core/Async/Executor.h>
#include <Optimization/StaticFunction.h>
#include <Optimization/CompilerTraits.h>
#include <WebServer.h>
#include <DNSServer.h>
#include "ISegmentStorage.h"
#include "IAuxNodeStorage.h"

struct BootContext {
  uniuno::INetworkManager* network;
  PinManager* pinManager;
  uniuno::Executor* executor;
  uniuno::IEventDispatcher* eventBus;
  uniuno::Timer* appTimer;
  uniuno::ISegmentStorage* segmentStorage;
  bool* configLoadedFlag;
  String* rawConfigPayload;
  AuxNodeManager* auxNodeManager = nullptr;
  uniuno::IAuxNodeStorage* auxNodeStorage = nullptr;
  void (*startLocalWebSocketServer)() = nullptr;
};

enum class BootState : uint8_t { CONNECT_WIFI = 0, DONE = 1, PROVISIONING = 2, RECONNECTING = 3 };

/**
 * @brief Manages fast offline bootstrap, async network connectivity, mDNS responder,
 * and automatic Captive Portal Wi-Fi provisioning.
 */
class BootManager {
private:
  BootContext ctx_;
  BootState state_;
  uniuno::Future<void, void> wifiFut_;
  unsigned long fetchConfigStartTime_;
  unsigned long lastReconnectAttempt_;
  unsigned long provisioningLastActivityMs_;
  unsigned long lastProvisioningIdleCheckMs_;
  uint32_t lastConnectedCheckCycle_ = 0;

  WebServer provisioningServer_{80};
  DNSServer dnsServer_;
  bool provisioningServerStarted_;
  bool provisioningRoutesRegistered_;
  bool dnsServerStarted_;
  bool mdnsStarted_;
  bool hasSavedWifiNetworks_;
  bool networkReady_ = false;
  uniuno::TaskHandle bootTaskHandle_;

  String apSsid_;
  char mdnsHostname_[33];
  char mdnsFqdn_[40];
  char portalUrl_[48];

  uniuno::AsyncResult<void> bootPollFn();
  void bootErrorFn(uniuno::Error e) const;

  void initMdnsIdentity();
  bool startMdnsResponder(bool apMode);
  void stopMdnsResponder();

  bool hasSavedWifiCredentials() const;
  void beginWifiConnectAttempt(bool initialBoot);
  void startProvisioningPortal();
  void stopProvisioningPortal();
  void touchProvisioningActivity();

  void registerCaptivePortalRoutes();
  void sendCaptiveRedirect();
  void handlePortalRoot();
  void handleWifiScan();
  void handlePortalStatus();
  void handleSaveWifi();

  __attribute__((noinline)) void loadOfflineConfigFromNvs() const;
  static void restartFn();

public:
  BootManager();
  void startBootSequenceAsync(const BootContext& ctx);
  void refreshMdnsIdentity();
  HOT_PATH FORCE_INLINE bool isPollDue() const {
    if (LIKELY(state_ == BootState::DONE)) {
      if (UNLIKELY(!networkReady_)) return false;
      const uint32_t now = uniuno::asm_opt::get_cpu_cycle_count();
      return UNLIKELY(static_cast<uint32_t>(now - lastConnectedCheckCycle_) >= uniuno::asm_opt::ms_to_cycles(500));
    }
    return state_ == BootState::PROVISIONING;
  }
  HOT_PATH void loop();
  BootState getState() const { return state_; }
  const char* getMdnsHostname() const { return mdnsHostname_; }
  const char* getMdnsFqdn() const { return mdnsFqdn_; }
  const char* getPortalUrl() const { return portalUrl_; }
#ifdef UNIUNO_NATIVE_TEST
  WebServer& testServer() { return provisioningServer_; }
#endif
};

#endif // BOOT_MANAGER_H
