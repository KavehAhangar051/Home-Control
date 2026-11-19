#include "ConfigApplier.h"
#include <Utilities/logging.h>
namespace ConfigApplier {

int apply(const ParseResult& config, PinManager* pinManager) {
    if (pinManager == nullptr) {
        return 0;
    }

    if (!config.success) {
        WARNING("[ConfigApplier] Config not valid, skipping.");
        return 0;
    }

    int applied = 0;

    for (int i = 0; i < MAX_SEGMENTS; i++) {
        const SegmentConfig& seg = config.segments[i];
        if (!seg.valid) continue;

        const SegmentType sType = parseSegmentType(seg.type);

        bool added = pinManager->addSegment(
            seg.id,
            sType,
            seg.pin,
            seg.autoOffDelay,
            seg.rule,
            seg.pwmResolution,
            seg.pwmFrequency
        );
        if (added) {
            if (sType == SegmentType::AnalogOutput) {
                if (seg.analogValue > 0) {
                    pinManager->setAnalogValueById(seg.id, seg.analogValue);
                }
                INFOF("[ConfigApplier] Pin %d registered (id=%s, type=analog_output, duty=%u, %u-bit @ %uHz)",
                      seg.pin, seg.id, seg.analogValue, seg.pwmResolution, seg.pwmFrequency);
            } else {
                pinManager->setStateById(seg.id, seg.value);
                INFOF("[ConfigApplier] Pin %d registered (id=%s, value=%d)", seg.pin, seg.id, seg.value);
            }
            applied++;
        } else {
            WARNINGF("[ConfigApplier] Failed to register pin %d (id=%s)", seg.pin, seg.id);
        }
    }

    INFOF("[ConfigApplier] Applied %d GPIO segments.", applied);
    return applied;
}

} // namespace ConfigApplier
