#include "AuxNodeManager.h"
#include <Utilities/FixedJsonWriter.h>
#include <Utilities/logging.h>
#include <cstdio>
#include <cstring>

namespace {

const char* chipTypeLabel(AuxChipType chip) {
  switch (chip) {
  case AUX_CHIP_ESP8266_01:
    return "ESP8266-01";
  case AUX_CHIP_ESP8266_12:
    return "ESP8266-12";
  case AUX_CHIP_ESP32:
    return "ESP32";
  case AUX_CHIP_ESP32_C3:
    return "ESP32-C3";
  case AUX_CHIP_ESP32_S3:
    return "ESP32-S3";
  case AUX_CHIP_UNKNOWN:
  default:
    return "Unknown";
  }
}

} // namespace

AuxNodeManager::AuxNodeManager() {
  clearAllNodes();
}

bool AuxNodeManager::addNode(uint8_t nodeId, const uint8_t mac[6], uint8_t pinCapacity, AuxChipType chipType,
                             const char* name) {
  if (!isValidAuxNodeId(nodeId)) {
    WARNINGF("[AuxNodeManager] Invalid nodeId %u (expected 1..%d).", nodeId, MAX_AUX_NODES);
    return false;
  }
  if (!isValidUnicastMac(mac)) {
    WARNING("[AuxNodeManager] Rejected invalid or non-unicast MAC address.");
    return false;
  }
  if (pinCapacity < 1 || pinCapacity > MAX_AUX_NODE_PIN_CAPACITY) {
    WARNINGF("[AuxNodeManager] Invalid pinCapacity %u (expected 1..%u).", pinCapacity,
             static_cast<unsigned int>(MAX_AUX_NODE_PIN_CAPACITY));
    return false;
  }
  if (hasNodeId(nodeId) || hasMac(mac)) {
    WARNINGF("[AuxNodeManager] Node %u or MAC already registered.", nodeId);
    return false;
  }

  AuxNodeConfig& slot = _nodes[nodeId - 1];
  slot.reset();
  slot.nodeId = nodeId;
  memcpy(slot.mac, mac, 6);
  slot.pinCapacity = pinCapacity;
  slot.chipType = (static_cast<uint8_t>(chipType) <= static_cast<uint8_t>(AUX_CHIP_MAX)) ? chipType : AUX_CHIP_UNKNOWN;
  if (name != nullptr && name[0] != '\0') {
    strlcpy(slot.name, name, sizeof(slot.name));
  } else {
    snprintf(slot.name, sizeof(slot.name), "Node-%u", nodeId);
  }
  slot.online = false;
  slot.valid = true;

  char macStr[18];
  formatMacAddress(slot.mac, macStr, sizeof(macStr));
  INFOF("[AuxNodeManager] Added node #%u '%s' mac=%s cap=%u chip=%s", slot.nodeId, slot.name, macStr, slot.pinCapacity,
        chipTypeLabel(slot.chipType));
  return true;
}

bool AuxNodeManager::upsertNode(uint8_t nodeId, const uint8_t mac[6], uint8_t pinCapacity, AuxChipType chipType,
                                const char* name) {
  if (!isValidAuxNodeId(nodeId) || !isValidUnicastMac(mac) || pinCapacity < 1 ||
      pinCapacity > MAX_AUX_NODE_PIN_CAPACITY) {
    WARNINGF("[AuxNodeManager] Rejected upsert for node %u (invalid parameters).", nodeId);
    return false;
  }

  // Preserve online status if updating the same nodeId with the same MAC.
  bool preserveOnline = false;
  const AuxNodeConfig* existingSameId = getNodeById(nodeId);
  if (existingSameId != nullptr && macEquals(existingSameId->mac, mac)) {
    preserveOnline = existingSameId->online;
  }

  // Deduplicate any other slot holding the same MAC address.
  const uint8_t existingMacNodeId = findNodeIdByMac(mac);
  if (existingMacNodeId != AUX_NODE_ID_LOCAL && existingMacNodeId != nodeId) {
    WARNINGF("[AuxNodeManager] MAC moved from node #%u to node #%u; clearing old slot.", existingMacNodeId, nodeId);
    _nodes[existingMacNodeId - 1].reset();
  }

  _nodes[nodeId - 1].reset();
  const bool added = addNode(nodeId, mac, pinCapacity, chipType, name);
  if (added && preserveOnline) {
    _nodes[nodeId - 1].online = true;
  }
  return added;
}

bool AuxNodeManager::removeNodeById(uint8_t nodeId) {
  if (!isValidAuxNodeId(nodeId)) return false;
  AuxNodeConfig& slot = _nodes[nodeId - 1];
  if (!slot.valid) return false;

  char macStr[18];
  formatMacAddress(slot.mac, macStr, sizeof(macStr));
  INFOF("[AuxNodeManager] Removed node #%u '%s' (%s)", slot.nodeId, slot.name, macStr);
  slot.reset();
  return true;
}

bool AuxNodeManager::removeNodeByMac(const uint8_t mac[6]) {
  const uint8_t nodeId = findNodeIdByMac(mac);
  if (nodeId == AUX_NODE_ID_LOCAL) return false;
  return removeNodeById(nodeId);
}

bool AuxNodeManager::removeNodeByIdOrMac(uint8_t nodeId, const uint8_t* mac, uint8_t* outRemovedNodeId) {
  if (outRemovedNodeId != nullptr) *outRemovedNodeId = AUX_NODE_ID_LOCAL;

  if (isValidAuxNodeId(nodeId) && hasNodeId(nodeId) && removeNodeById(nodeId)) {
    if (outRemovedNodeId != nullptr) *outRemovedNodeId = nodeId;
    return true;
  }

  if (mac != nullptr) {
    const uint8_t resolvedId = findNodeIdByMac(mac);
    if (resolvedId != AUX_NODE_ID_LOCAL && removeNodeById(resolvedId)) {
      if (outRemovedNodeId != nullptr) *outRemovedNodeId = resolvedId;
      return true;
    }
  }

  return false;
}

void AuxNodeManager::clearAllNodes() {
  for (int i = 0; i < MAX_AUX_NODES; ++i) {
    _nodes[i].reset();
  }
}

bool AuxNodeManager::hasNodeId(uint8_t nodeId) const {
  return getNodeById(nodeId) != nullptr;
}

bool AuxNodeManager::hasMac(const uint8_t mac[6]) const {
  return findNodeByMac(mac) != nullptr;
}

const AuxNodeConfig* AuxNodeManager::getNodeById(uint8_t nodeId) const {
  if (!isValidAuxNodeId(nodeId)) return nullptr;
  const AuxNodeConfig& slot = _nodes[nodeId - 1];
  return slot.valid ? &slot : nullptr;
}

const AuxNodeConfig* AuxNodeManager::findNodeByMac(const uint8_t mac[6]) const {
  if (mac == nullptr) return nullptr;
  for (int i = 0; i < MAX_AUX_NODES; ++i) {
    if (_nodes[i].valid && macEquals(_nodes[i].mac, mac)) {
      return &_nodes[i];
    }
  }
  return nullptr;
}

uint8_t AuxNodeManager::findNodeIdByMac(const uint8_t mac[6]) const {
  const AuxNodeConfig* node = findNodeByMac(mac);
  return node ? node->nodeId : AUX_NODE_ID_LOCAL;
}

const AuxNodeConfig* AuxNodeManager::getNodeBySlot(int slot) const {
  if (slot < 0 || slot >= MAX_AUX_NODES) return nullptr;
  return _nodes[slot].valid ? &_nodes[slot] : nullptr;
}

bool AuxNodeManager::setNodeOnline(uint8_t nodeId, bool online) {
  if (!isValidAuxNodeId(nodeId)) return false;
  AuxNodeConfig& slot = _nodes[nodeId - 1];
  if (!slot.valid) return false;
  slot.online = online;
  return true;
}

int AuxNodeManager::getActiveCount() const {
  int count = 0;
  for (int i = 0; i < MAX_AUX_NODES; ++i) {
    if (_nodes[i].valid) ++count;
  }
  return count;
}

void AuxNodeManager::exportConfig(ParseResult& out) const {
  for (int i = 0; i < MAX_AUX_NODES; ++i) {
    out.auxNodes[i].reset();
  }
  out.auxNodeCount = 0;
  out.auxNodesProvided = true;

  for (int i = 0; i < MAX_AUX_NODES; ++i) {
    if (!_nodes[i].valid) continue;
    out.auxNodes[out.auxNodeCount++] = _nodes[i];
  }
}

size_t AuxNodeManager::appendNodesJson(char* outBuf, size_t outBufSize, size_t offset) const {
  uniuno::FixedJsonWriter writer(outBuf, outBufSize, offset);
  writer.appendChar('[');
  bool first = true;
  char macStr[18];
  for (int i = 0; i < MAX_AUX_NODES; ++i) {
    if (!_nodes[i].valid) continue;
    if (!first) writer.appendChar(',');
    formatMacAddress(_nodes[i].mac, macStr, sizeof(macStr));

    writer.appendRaw("{\"id\":");
    writer.appendUInt(_nodes[i].nodeId);
    writer.appendRaw(",\"mac\":\"");
    writer.appendRaw(macStr);
    writer.appendRaw("\",\"cap\":");
    writer.appendUInt(_nodes[i].pinCapacity);
    writer.appendRaw(",\"chip\":");
    writer.appendUInt(static_cast<unsigned int>(_nodes[i].chipType));
    writer.appendRaw(",\"name\":\"");
    writer.appendJsonEscaped(_nodes[i].name);
    writer.appendRaw("\",\"online\":");
    writer.appendBool(_nodes[i].online);
    writer.appendChar('}');
    first = false;
  }
  writer.appendChar(']');
  return writer.length();
}

void AuxNodeManager::appendNodesJson(String& out) const {
  char buf[1024];
  const size_t len = appendNodesJson(buf, sizeof(buf), 0);
  out.concat(buf, len);
}

void AuxNodeManager::printStatus() const {
  Serial.println("========= Aux Node Manager =========");
  Serial.printf("  Registered nodes: %d / %d\n", getActiveCount(), MAX_AUX_NODES);
  char macStr[18];
  for (int i = 0; i < MAX_AUX_NODES; ++i) {
    if (!_nodes[i].valid) continue;
    formatMacAddress(_nodes[i].mac, macStr, sizeof(macStr));
    Serial.printf("  [node #%u] name='%s' mac=%s cap=%u chip=%s status=%s\n", _nodes[i].nodeId, _nodes[i].name, macStr,
                  _nodes[i].pinCapacity, chipTypeLabel(_nodes[i].chipType), _nodes[i].online ? "ONLINE" : "OFFLINE");
  }
  Serial.println("====================================");
}
