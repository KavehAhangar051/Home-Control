#include "ConfigApplier.h"
#include <AuxNodeManager.h>
#include <Utilities/logging.h>

namespace ConfigApplier {

int apply(const ParseResult& config, PinManager* pinManager, AuxNodeManager* auxNodeManager) {
  if (pinManager == nullptr) {
    return 0;
  }

  if (!config.success) {
    WARNING("[ConfigApplier] Config not valid, skipping.");
    return 0;
  }

  if (auxNodeManager != nullptr && config.auxNodesProvided) {
    for (int i = 0; i < MAX_AUX_NODES; ++i) {
      const AuxNodeConfig& node = config.auxNodes[i];
      if (!node.valid) continue;
      auxNodeManager->upsertNode(node.nodeId, node.mac, node.pinCapacity, node.chipType, node.name);
    }
  }

  int applied = 0;

  for (int i = 0; i < MAX_SEGMENTS; i++) {
    const SegmentConfig& seg = config.segments[i];
    if (!seg.valid) continue;

    const SegmentType sType = parseSegmentType(seg.type);
    bool added = false;

    if (seg.isVirtual) {
      if (auxNodeManager != nullptr && !auxNodeManager->hasNodeId(seg.nodeId)) {
        WARNINGF("[ConfigApplier] Skipping virtual segment '%s' (vpin=%d): aux node #%u not registered.", seg.id,
                 seg.pin, seg.nodeId);
        continue;
      }
      added =
          pinManager->addVirtualSegment(seg.id, sType, seg.pin, seg.nodeId, seg.remotePin, seg.autoOffDelay, seg.rule,
                                        seg.pwmResolution, seg.pwmFrequency, seg.adcResolution, seg.adcSampleIntervalMs,
                                        seg.adcDeltaThreshold, seg.adcHighThreshold, seg.adcLowThreshold);
    } else {
      added = pinManager->addSegment(seg.id, sType, seg.pin, seg.autoOffDelay, seg.rule, seg.pwmResolution,
                                     seg.pwmFrequency, seg.adcResolution, seg.adcSampleIntervalMs,
                                     seg.adcDeltaThreshold, seg.adcHighThreshold, seg.adcLowThreshold);
    }

    if (added) {
      if (sType == SegmentType::AnalogOutput) {
        if (seg.analogValue > 0) {
          pinManager->setAnalogValueById(seg.id, seg.analogValue);
        }
        INFOF("[ConfigApplier] %sPin %d registered (id=%s, type=analog_output, duty=%u, %u-bit @ %uHz)",
              seg.isVirtual ? "Virtual " : "", seg.pin, seg.id, seg.analogValue, seg.pwmResolution, seg.pwmFrequency);
      } else if (sType == SegmentType::AnalogInput) {
        INFOF("[ConfigApplier] %sPin %d registered (id=%s, type=analog_input, %u-bit sint=%ums delta=%u ath=%u atl=%u)",
              seg.isVirtual ? "Virtual " : "", seg.pin, seg.id, seg.adcResolution, seg.adcSampleIntervalMs,
              seg.adcDeltaThreshold, seg.adcHighThreshold, seg.adcLowThreshold);
      } else {
        pinManager->setStateById(seg.id, seg.value);
        INFOF("[ConfigApplier] %sPin %d registered (id=%s, value=%d)", seg.isVirtual ? "Virtual " : "", seg.pin, seg.id,
              seg.value);
      }
      applied++;
    } else {
      WARNINGF("[ConfigApplier] Failed to register %spin %d (id=%s)", seg.isVirtual ? "virtual " : "", seg.pin, seg.id);
    }
  }

  INFOF("[ConfigApplier] Applied %d segments.", applied);
  return applied;
}

} // namespace ConfigApplier
