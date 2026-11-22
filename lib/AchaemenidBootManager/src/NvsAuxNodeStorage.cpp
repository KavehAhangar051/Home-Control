#include "NvsAuxNodeStorage.h"
#include <Arduino.h>
#include <cstdio>
#include <cstring>

namespace uniuno {
namespace {

static constexpr uint8_t AUX_NODE_STORAGE_VERSION = 1;
static constexpr char AUX_NVS_NAMESPACE[] = "AchaemenidNodes";

#pragma pack(push, 1)
struct StoredAuxNodeV1 {
    uint8_t nodeId;
    uint8_t mac[6];
    uint8_t pinCapacity;
    uint8_t chipType;
    uint8_t reserved;
    char name[32];
};
#pragma pack(pop)

static_assert(sizeof(StoredAuxNodeV1) == 42, "Unexpected StoredAuxNodeV1 layout");

bool loadAuxBank(Preferences& prefs, char bank, ParseResult& out) {
    for (int i = 0; i < MAX_AUX_NODES; ++i) {
        out.auxNodes[i].reset();
    }
    out.auxNodeCount = 0;

    char countKey[8];
    char versionKey[8];
    snprintf(countKey, sizeof(countKey), "%cCount", bank);
    snprintf(versionKey, sizeof(versionKey), "%cVer", bank);

    const int count = prefs.getInt(countKey, -1);
    const uint8_t version = prefs.getUChar(versionKey, 0);
    if (version != AUX_NODE_STORAGE_VERSION || count < 0 || count > MAX_AUX_NODES) {
        return false;
    }

    char key[16];
    for (int i = 0; i < count; ++i) {
        snprintf(key, sizeof(key), "%c%d", bank, i);
        if (prefs.getBytesLength(key) != sizeof(StoredAuxNodeV1)) {
            Serial.printf("[NodeStorage] Bank %c rejected: invalid size for %s\n", bank, key);
            return false;
        }

        StoredAuxNodeV1 record{};
        if (prefs.getBytes(key, &record, sizeof(record)) != sizeof(record)) {
            Serial.printf("[NodeStorage] Bank %c rejected: failed reading %s\n", bank, key);
            return false;
        }

        const bool nameTerminated = memchr(record.name, '\0', sizeof(record.name)) != nullptr;
        if (!nameTerminated || !isValidAuxNodeId(record.nodeId) ||
            !isValidUnicastMac(record.mac) ||
            record.pinCapacity < 1 || record.pinCapacity > MAX_AUX_NODE_PIN_CAPACITY ||
            record.chipType > static_cast<uint8_t>(AUX_CHIP_MAX)) {
            Serial.printf("[NodeStorage] Bank %c rejected: invalid node record %s\n", bank, key);
            return false;
        }

        for (int prev = 0; prev < out.auxNodeCount; ++prev) {
            if (out.auxNodes[prev].nodeId == record.nodeId ||
                macEquals(out.auxNodes[prev].mac, record.mac)) {
                Serial.printf("[NodeStorage] Bank %c rejected: duplicate nodeId or MAC in %s\n", bank, key);
                return false;
            }
        }

        AuxNodeConfig& node = out.auxNodes[out.auxNodeCount++];
        node.reset();
        node.nodeId = record.nodeId;
        memcpy(node.mac, record.mac, 6);
        node.pinCapacity = record.pinCapacity;
        node.chipType = static_cast<AuxChipType>(record.chipType);
        strlcpy(node.name, record.name, sizeof(node.name));
        node.online = false;
        node.valid = true;
    }

    out.auxNodesProvided = true;
    return true;
}

} // namespace

void NvsAuxNodeStorage::saveAuxNodes(const ParseResult& parsed) {
    Preferences prefs;
    if (!prefs.begin(AUX_NVS_NAMESPACE, false)) {
        Serial.println("[NodeStorage] Failed to open AuxNode Preferences for writing");
        return;
    }

    const String currentBank = prefs.getString("active", "");
    const char targetBank = (currentBank == "a") ? 'b' : 'a';
    const char* bankName = (targetBank == 'a') ? "a" : "b";
    char key[16];
    int savedCount = 0;
    bool writeOk = true;

    for (int i = 0; i < MAX_AUX_NODES; ++i) {
        if (!parsed.auxNodes[i].valid) continue;
        if (savedCount >= MAX_AUX_NODES) {
            writeOk = false;
            break;
        }

        const AuxNodeConfig& node = parsed.auxNodes[i];
        if (!isValidAuxNodeId(node.nodeId) || !isValidUnicastMac(node.mac) ||
            node.pinCapacity < 1 || node.pinCapacity > MAX_AUX_NODE_PIN_CAPACITY) {
            writeOk = false;
            Serial.printf("[NodeStorage] Refusing invalid aux node at slot %d\n", i);
            break;
        }

        StoredAuxNodeV1 record{};
        record.nodeId = node.nodeId;
        memcpy(record.mac, node.mac, 6);
        record.pinCapacity = node.pinCapacity;
        record.chipType = (static_cast<uint8_t>(node.chipType) <= static_cast<uint8_t>(AUX_CHIP_MAX))
            ? static_cast<uint8_t>(node.chipType)
            : static_cast<uint8_t>(AUX_CHIP_UNKNOWN);
        record.reserved = 0;
        strlcpy(record.name, node.name, sizeof(record.name));

        snprintf(key, sizeof(key), "%c%d", targetBank, savedCount);
        if (prefs.putBytes(key, &record, sizeof(record)) != sizeof(record)) {
            writeOk = false;
            Serial.printf("[NodeStorage] Failed writing record %s\n", key);
            break;
        }
        ++savedCount;
    }

    if (writeOk) {
        for (int i = savedCount; i < MAX_AUX_NODES; ++i) {
            snprintf(key, sizeof(key), "%c%d", targetBank, i);
            prefs.remove(key);
        }

        char countKey[8];
        char versionKey[8];
        snprintf(countKey, sizeof(countKey), "%cCount", targetBank);
        snprintf(versionKey, sizeof(versionKey), "%cVer", targetBank);
        writeOk = prefs.putInt(countKey, savedCount) == sizeof(int) &&
                  prefs.putUChar(versionKey, AUX_NODE_STORAGE_VERSION) == sizeof(uint8_t);
    }

    if (writeOk) {
        writeOk = prefs.putString("active", bankName) > 0;
    }

    prefs.end();
    if (writeOk) {
        Serial.printf("[NodeStorage] Saved %d auxiliary ESP node(s) to NVS bank %c\n", savedCount, targetBank);
    } else {
        Serial.println("[NodeStorage] Save failed; previous active NVS bank was preserved");
    }
}

bool NvsAuxNodeStorage::loadAuxNodes(ParseResult& out) {
    for (int i = 0; i < MAX_AUX_NODES; ++i) {
        out.auxNodes[i].reset();
    }
    out.auxNodeCount = 0;
    out.auxNodesProvided = false;

    Preferences prefs;
    if (!prefs.begin(AUX_NVS_NAMESPACE, true)) {
        return false;
    }

    const String activeBank = prefs.getString("active", "");
    if (activeBank == "a" || activeBank == "b") {
        const char active = activeBank[0];
        const char backup = (active == 'a') ? 'b' : 'a';

        if (loadAuxBank(prefs, active, out)) {
            prefs.end();
            Serial.printf("[NodeStorage] Loaded %d auxiliary ESP node(s) from active NVS bank %c\n",
                          out.auxNodeCount, active);
            return true;
        }

        Serial.printf("[NodeStorage] Active bank %c is invalid; checking backup bank %c\n", active, backup);
        if (loadAuxBank(prefs, backup, out)) {
            prefs.end();
            Serial.printf("[NodeStorage] Recovered %d auxiliary ESP node(s) from backup NVS bank %c\n",
                          out.auxNodeCount, backup);
            return true;
        }
    }

    prefs.end();
    for (int i = 0; i < MAX_AUX_NODES; ++i) {
        out.auxNodes[i].reset();
    }
    out.auxNodeCount = 0;
    out.auxNodesProvided = false;
    return false;
}

} // namespace uniuno
