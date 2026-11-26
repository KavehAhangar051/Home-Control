#ifndef NVS_AUX_NODE_STORAGE_H
#define NVS_AUX_NODE_STORAGE_H

#include "IAuxNodeStorage.h"
#include <Preferences.h>

namespace uniuno {

/**
 * @brief Atomic dual-bank NVS storage for auxiliary ESP node registrations (MACs, capacities, names).
 */
class NvsAuxNodeStorage : public IAuxNodeStorage {
public:
  void saveAuxNodes(const ParseResult& parsed) override;
  bool loadAuxNodes(ParseResult& out) override;
};

} // namespace uniuno

#endif // NVS_AUX_NODE_STORAGE_H
