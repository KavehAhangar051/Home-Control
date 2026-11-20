#pragma once

#include <Arduino.h>
#include <cstdint>
#include <cstring>
#include <map>
#include <string>
#include <vector>

class Preferences {
public:
    static std::map<std::string, std::map<std::string, std::vector<uint8_t>>>& store() {
        static std::map<std::string, std::map<std::string, std::vector<uint8_t>>> instance;
        return instance;
    }

    static void resetAll() {
        store().clear();
    }

    bool begin(const char* name, bool readOnly = false) {
        (void)readOnly;
        _ns = name ? name : "";
        return true;
    }

    void end() {}

    bool clear() {
        store()[_ns].clear();
        return true;
    }

    bool remove(const char* key) {
        if (!key) return false;
        return store()[_ns].erase(key) > 0;
    }

    bool isKey(const char* key) const {
        if (!key) return false;
        auto nsIt = store().find(_ns);
        if (nsIt == store().end()) return false;
        return nsIt->second.find(key) != nsIt->second.end();
    }

    size_t putInt(const char* key, int32_t value) {
        return putBytes(key, &value, sizeof(value));
    }

    int32_t getInt(const char* key, int32_t defaultValue = 0) const {
        int32_t out = defaultValue;
        if (getBytesLength(key) == sizeof(out)) {
            getBytes(key, &out, sizeof(out));
        }
        return out;
    }

    size_t putUChar(const char* key, uint8_t value) {
        return putBytes(key, &value, sizeof(value));
    }

    uint8_t getUChar(const char* key, uint8_t defaultValue = 0) const {
        uint8_t out = defaultValue;
        if (getBytesLength(key) == sizeof(out)) {
            getBytes(key, &out, sizeof(out));
        }
        return out;
    }

    size_t putBool(const char* key, bool value) {
        return putUChar(key, value ? 1 : 0);
    }

    bool getBool(const char* key, bool defaultValue = false) const {
        return getUChar(key, defaultValue ? 1 : 0) != 0;
    }

    size_t putString(const char* key, const char* value) {
        if (!value) value = "";
        return putBytes(key, value, std::strlen(value) + 1);
    }

    size_t putString(const char* key, const String& value) {
        return putString(key, value.c_str());
    }

    String getString(const char* key, const String& defaultValue = String("")) const {
        if (!key) return defaultValue;
        auto nsIt = store().find(_ns);
        if (nsIt == store().end()) return defaultValue;
        auto keyIt = nsIt->second.find(key);
        if (keyIt == nsIt->second.end() || keyIt->second.empty()) return defaultValue;
        return String(reinterpret_cast<const char*>(keyIt->second.data()));
    }

    size_t putBytes(const char* key, const void* value, size_t len) {
        if (!key || (!value && len > 0)) return 0;
        const uint8_t* ptr = static_cast<const uint8_t*>(value);
        store()[_ns][key].assign(ptr, ptr + len);
        return len;
    }

    size_t getBytesLength(const char* key) const {
        if (!key) return 0;
        auto nsIt = store().find(_ns);
        if (nsIt == store().end()) return 0;
        auto keyIt = nsIt->second.find(key);
        if (keyIt == nsIt->second.end()) return 0;
        return keyIt->second.size();
    }

    size_t getBytes(const char* key, void* buf, size_t maxLen) const {
        if (!key || !buf) return 0;
        auto nsIt = store().find(_ns);
        if (nsIt == store().end()) return 0;
        auto keyIt = nsIt->second.find(key);
        if (keyIt == nsIt->second.end()) return 0;
        const size_t n = std::min(maxLen, keyIt->second.size());
        std::memcpy(buf, keyIt->second.data(), n);
        return n;
    }

private:
    std::string _ns;
};
