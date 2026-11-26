#include "SystemSetup.h"
#include <ProjectConfig.h>
#include <core/Globals.h>
#include <Core/Error/ErrorHandler.h>
#include <Utilities/SystemDiagnostics.h>
#include <Utilities/logging.h>
#include <parsers/MqttCommandDispatcher.h>
#include <parsers/StateParsers.h>
#include <parsers/SegmentParsers.h>
#include <parsers/RuleParsers.h>
#include <core/WebSocketClient.h>
#include <core/WebSocketServer.h>
#include <RuleEngine.h>
#include "ESP32WiFiAdapter.h"
#include <AchaemenidNetwork.h>

#ifdef ESP32
#include <esp_idf_version.h>
#include <esp_ota_ops.h>
#include <esp_system.h>
#include <esp_task_wdt.h>
#endif

namespace {

uniuno::diagnostics::OtaHealthGate s_otaHealthGate;
bool s_wdtRegistered = false;

} // namespace

void setupErrorHandler() {
  uniuno::ErrorHandler::getInstance().onError([](const uniuno::ErrorInfo& info) {
    const char* sev = info.severity == uniuno::ErrorSeverity::CRITICAL  ? "CRIT"
                      : info.severity == uniuno::ErrorSeverity::ERROR   ? "ERR"
                      : info.severity == uniuno::ErrorSeverity::WARNING ? "WARN"
                                                                        : "INFO";
    Serial.printf("[%s] %s: %s\n", sev, info.context, info.message);
  });
  uniuno::ErrorHandler::getInstance().setThrottle("HTTP", ACHAEMENID_ERROR_THROTTLE_MS);
  uniuno::ErrorHandler::getInstance().setThrottle("MQTT", ACHAEMENID_ERROR_THROTTLE_MS);
}

void setupWatchdog(uint32_t timeoutSec) {
  s_otaHealthGate.begin(millis(), ACHAEMENID_OTA_CONFIRM_DELAY_MS);

#ifdef ESP32
  const char* reason = uniuno::diagnostics::resetReasonToString(static_cast<int>(esp_reset_reason()));
  INFOF("[Health] Boot diagnostics: resetReason=%s, freeHeap=%lu, minFreeHeap=%lu", reason,
        static_cast<unsigned long>(ESP.getFreeHeap()), static_cast<unsigned long>(ESP.getMinFreeHeap()));

#if defined(ESP_IDF_VERSION) && (ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 0, 0))
  esp_task_wdt_config_t twdtCfg = {};
  twdtCfg.timeout_ms = timeoutSec * 1000U;
  twdtCfg.idle_core_mask = 0;
  twdtCfg.trigger_panic = true;
  esp_err_t wdtErr = esp_task_wdt_reconfigure(&twdtCfg);
  if (wdtErr == ESP_ERR_INVALID_STATE) {
    wdtErr = esp_task_wdt_init(&twdtCfg);
  }
#else
  esp_err_t wdtErr = esp_task_wdt_init(timeoutSec, true);
#endif
  if (wdtErr == ESP_OK || wdtErr == ESP_ERR_INVALID_STATE) {
    const esp_err_t addErr = esp_task_wdt_add(nullptr);
    if (addErr == ESP_OK || addErr == ESP_ERR_INVALID_ARG) {
      s_wdtRegistered = true;
      INFOF("[Health] Task Watchdog armed (%lus timeout).", static_cast<unsigned long>(timeoutSec));
    } else {
      WARNINGF("[Health] Failed to subscribe loopTask to TWDT (err=%d).", static_cast<int>(addErr));
    }
  } else {
    WARNINGF("[Health] Failed to initialize TWDT (err=%d).", static_cast<int>(wdtErr));
  }
#else
  (void)timeoutSec;
#endif
}

void pollWatchdogAndOtaHealth() {
#ifdef ESP32
  if (s_wdtRegistered) {
    esp_task_wdt_reset();
  }
  if (!s_otaHealthGate.isConfirmed()) {
    const bool netConnected = (::network != nullptr) && ::network->isConnected();
    if (s_otaHealthGate.shouldConfirm(millis(), netConnected)) {
      const esp_partition_t* running = esp_ota_get_running_partition();
      esp_ota_img_states_t otaState = ESP_OTA_IMG_UNDEFINED;
      if (running != nullptr && esp_ota_get_state_partition(running, &otaState) == ESP_OK &&
          otaState == ESP_OTA_IMG_PENDING_VERIFY) {
        if (esp_ota_mark_app_valid_cancel_rollback() == ESP_OK) {
          INFO("[Health] OTA firmware verified after stable boot; rollback cancelled.");
        }
      }
      s_otaHealthGate.markConfirmed();
    }
  }
#endif
}

void setupNetworkAndTime() {
  static uniuno::ESP32WiFiAdapter wifiAdapter;
  static uniuno::AchaemenidNetwork networkInstance(&wifiAdapter);
  ::network = &networkInstance;
}

void setupTimer() {
  uniuno::TimerFeatures features;
  features.timeout = true;
  features.interval = true;
  features.clear = true;
  static uniuno::Timer timerInstance(features, millis, &eventBus);
  appTimer = &timerInstance;
}

void setupMqtt() {
  static uniuno::MqttCommandDispatcher dispatcherInstance;
  mqttDispatcher = &dispatcherInstance;

  static uniuno::StateParsers stateHandler;
  static uniuno::SegmentParsers segmentHandler;
  static uniuno::RuleParsers ruleHandler;

  mqttDispatcher->registerHandler(&stateHandler);
  mqttDispatcher->registerHandler(&segmentHandler);
  mqttDispatcher->registerHandler(&ruleHandler);

  mqttClient.setCallback([](const uint8_t* payload, size_t len) {
    if (mqttDispatcher) {
      mqttDispatcher->handlePayload(payload, len, &eventBus);
    }
  });
}

void setupWebSocket() {
  auto stateProvider = []() -> String { return pinManager.exportStateJson(&auxNodeManager); };

  static uniuno::AchaemenidWebSocketClient wsClientInstance(&eventBus, stateProvider);
  static uniuno::AchaemenidWebSocketServer wsServerInstance(&eventBus, stateProvider);
  wsClient = &wsClientInstance;
  wsServer = &wsServerInstance;

  wsClient->begin(ACHAEMENID_DEFAULT_WS_URL);
}

void setupRuleEngine() {
  RuleContext ctx = {&mqttClient, appTimer, &executor, &eventBus, &pinManager, &isDashboardOnline};
  static RuleEngine ruleEngineInstance(ctx);
  ruleEngine = &ruleEngineInstance;
}
