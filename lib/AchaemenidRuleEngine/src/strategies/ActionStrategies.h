#ifndef ACTION_STRATEGIES_H
#define ACTION_STRATEGIES_H

#include "../RuleEngine.h"
#include <AchaemenidConfigProtocol.h>
#include <Optimization/CompilerTraits.h>

namespace uniuno {
namespace rules {

/**
 * @brief High-performance dispatcher for Rule Actions.
 * Direct dispatch without virtual table overhead.
 */
class ActionExecutor {
public:
    HOT_PATH static void execute(const RuleAction& act, int sourcePin, RuleContext& ctx);
};

/**
 * @brief Backward-compatible interface for action strategies.
 */
class IRuleActionStrategy {
public:
    virtual ~IRuleActionStrategy() = default;
    virtual void execute(const RuleAction& act, int sourcePin, RuleContext& ctx) = 0;
};

class ImmediateActionStrategy : public IRuleActionStrategy {
public:
    void execute(const RuleAction& act, int sourcePin, RuleContext& ctx) override;
};

class DelayedActionStrategy : public IRuleActionStrategy {
public:
    void execute(const RuleAction& act, int sourcePin, RuleContext& ctx) override;
};

class DurationActionStrategy : public IRuleActionStrategy {
public:
    void execute(const RuleAction& act, int sourcePin, RuleContext& ctx) override;
};

} // namespace rules
} // namespace uniuno

#endif // ACTION_STRATEGIES_H
