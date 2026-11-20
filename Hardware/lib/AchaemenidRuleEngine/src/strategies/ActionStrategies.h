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
 *
 * All action types (IMMEDIATE, AFTER_DELAY, FOR_DURATION) are handled via a
 * single static entry point. Timer callbacks capture a by-value copy of
 * RuleContext (pointer-only struct, 24 bytes) so lambdas remain self-contained.
 */
class ActionExecutor {
public:
    HOT_PATH static void execute(const RuleAction& act, int sourcePin, RuleContext& ctx);
};

} // namespace rules
} // namespace uniuno

#endif // ACTION_STRATEGIES_H
