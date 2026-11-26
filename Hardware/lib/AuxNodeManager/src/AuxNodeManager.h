#ifndef AUX_NODE_MANAGER_H
#define AUX_NODE_MANAGER_H

#include <Arduino.h>
#include <ConfigTypes.h>

/**
 * @brief Registry of auxiliary ESP nodes (ESP8266-01, ESP8266-12, ESP32, etc.)
 * paired with the central ESP32 hub for wireless virtual segments.
 */
class AuxNodeManager {
public:
  AuxNodeManager();

  bool addNode(uint8_t nodeId, const uint8_t mac[6], uint8_t pinCapacity, AuxChipType chipType, const char* name);

  bool upsertNode(uint8_t nodeId, const uint8_t mac[6], uint8_t pinCapacity, AuxChipType chipType, const char* name);

  bool removeNodeById(uint8_t nodeId);
  bool removeNodeByMac(const uint8_t mac[6]);
  bool removeNodeByIdOrMac(uint8_t nodeId, const uint8_t* mac, uint8_t* outRemovedNodeId = nullptr);
  void clearAllNodes();

  bool hasNodeId(uint8_t nodeId) const;
  bool hasMac(const uint8_t mac[6]) const;

  const AuxNodeConfig* getNodeById(uint8_t nodeId) const;
  const AuxNodeConfig* findNodeByMac(const uint8_t mac[6]) const;
  uint8_t findNodeIdByMac(const uint8_t mac[6]) const;
  const AuxNodeConfig* getNodeBySlot(int slot) const;

  bool setNodeOnline(uint8_t nodeId, bool online);
  int getActiveCount() const;

  void exportConfig(ParseResult& out) const;
  void appendNodesJson(String& out) const;
  void printStatus() const;

private:
  AuxNodeConfig _nodes[MAX_AUX_NODES];
};

#endif // AUX_NODE_MANAGER_H
