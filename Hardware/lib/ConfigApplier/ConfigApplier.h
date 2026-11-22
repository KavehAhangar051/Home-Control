#ifndef CONFIG_APPLIER_H
#define CONFIG_APPLIER_H

#include <AchaemenidConfigProtocol.h>
#include <PinManager.h>

class AuxNodeManager;

/**
 * @namespace ConfigApplier
 * @brief Applies parsed configuration results to PinManager and optional AuxNodeManager.
 * 
 * Separates the configuration logic from the hardware GPIO logic.
 */
namespace ConfigApplier {
    /**
     * @brief Applies a parsed configuration to PinManager and optional AuxNodeManager.
     * 
     * @param config The ParseResult containing auxiliary nodes and segments to configure.
     * @param pinManager Pointer to the PinManager to configure.
     * @param auxNodeManager Optional pointer to AuxNodeManager for auxiliary ESP node registration.
     * @return int The number of successfully applied local and virtual segments.
     */
    int apply(const ParseResult& config, PinManager* pinManager, AuxNodeManager* auxNodeManager = nullptr);
}

#endif // CONFIG_APPLIER_H
