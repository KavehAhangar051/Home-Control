#ifndef I_AUX_NODE_STORAGE_H
#define I_AUX_NODE_STORAGE_H

#include <AchaemenidConfigProtocol.h>

namespace uniuno {

/**
 * @brief Persistence interface for registered auxiliary ESP nodes (MAC addresses & metadata).
 */
class IAuxNodeStorage {
public:
    virtual ~IAuxNodeStorage() = default;
    virtual void saveAuxNodes(const ParseResult& parsed) = 0;
    virtual bool loadAuxNodes(ParseResult& out) = 0;
};

} // namespace uniuno

#endif // I_AUX_NODE_STORAGE_H
