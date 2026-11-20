#ifndef RULE_ENGINE_H
#define RULE_ENGINE_H

#include <AchaemenidMQTT.h>
#include <Timer/Timer.h>
#include <Events/EventDispatcher.h>
#include <Core/Async/Executor.h>
#include <PinManager.h>
#include <Optimization/CompilerTraits.h>

struct RuleContext {
    uniuno::AchaemenidMQTT* mqttClient;
    uniuno::Timer* appTimer;
    uniuno::Executor* executor;
    uniuno::EventDispatcher* eventBus;
    PinManager* pinManager;
    bool* isDashboardOnline;
};

/**
 * @brief Evaluates digital input pin transitions and executes configured Rule Actions.
 *
 * Threading model:
 *   - handleInput() MUST be called only from the Arduino main loop (Core 1).
 *   - Timer callbacks scheduled via appTimer run from the ESP-IDF timer task (Core 1
 *     on esp_timer), so they share the same core as the main loop and do NOT need
 *     additional synchronization as long as appTimer uses the main-loop dispatcher.
 *   - RuleContext dependencies (PinManager, EventDispatcher, etc.) must outlive the
 *     RuleEngine instance. No ownership is transferred.
 *   - RuleEngine methods are NOT reentrant.
 */
class RuleEngine {
public:
    RuleEngine(RuleContext ctx);
    HOT_PATH void handleInput(int sourcePin, bool newState, unsigned long durationSec, const RuleConfig& rule);
    HOT_PATH void scheduleCloudSync(int sourcePin);

private:
    void executeAction(const RuleAction& act, int sourcePin);

    RuleContext _ctx;
};

#endif // RULE_ENGINE_H
