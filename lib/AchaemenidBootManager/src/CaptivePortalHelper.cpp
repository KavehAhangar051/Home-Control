#include "CaptivePortalHelper.h"
#include <cstdio>
#include <cstring>

namespace uniuno {

namespace {

inline char toLowerAscii(char c) {
    return (c >= 'A' && c <= 'Z') ? static_cast<char>(c + ('a' - 'A')) : c;
}

bool equalsIgnoreCaseN(const char* a, size_t aLen, const char* b, size_t bLen) {
    if (aLen != bLen) return false;
    for (size_t i = 0; i < aLen; ++i) {
        if (toLowerAscii(a[i]) != toLowerAscii(b[i])) {
            return false;
        }
    }
    return true;
}

bool equalsIgnoreCase(const char* a, const char* b) {
    if (!a || !b) return false;
    return equalsIgnoreCaseN(a, strlen(a), b, strlen(b));
}

} // namespace

void sanitizeMdnsHostname(const char* raw, char* out, size_t outSize) {
    if (!out || outSize == 0) return;

    const size_t maxChars = (outSize - 1 < MAX_MDNS_HOSTNAME_LEN) ? (outSize - 1) : MAX_MDNS_HOSTNAME_LEN;
    size_t len = 0;

    if (raw != nullptr) {
        bool prevDash = false;
        for (const char* p = raw; *p != '\0' && len < maxChars; ++p) {
            const char c = toLowerAscii(*p);
            const bool isAlphaNum = (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9');
            if (isAlphaNum) {
                out[len++] = c;
                prevDash = false;
            } else if ((c == '-' || c == '_' || c == ' ') && len > 0 && !prevDash) {
                out[len++] = '-';
                prevDash = true;
            }
        }
    }

    while (len > 0 && out[len - 1] == '-') {
        --len;
    }

    if (len == 0) {
        const size_t defLen = strlen(DEFAULT_MDNS_HOSTNAME);
        const size_t copyLen = defLen < maxChars ? defLen : maxChars;
        memcpy(out, DEFAULT_MDNS_HOSTNAME, copyLen);
        out[copyLen] = '\0';
    } else {
        out[len] = '\0';
    }
}

void buildPortalUrl(const char* mdnsHost, char* out, size_t outSize) {
    if (!out || outSize == 0) return;
    char cleanHost[MAX_MDNS_HOSTNAME_LEN + 1];
    sanitizeMdnsHostname(mdnsHost, cleanHost, sizeof(cleanHost));
    snprintf(out, outSize, "http://%s.local/", cleanHost);
}

bool isPortalHost(const char* hostHeader, const char* mdnsHost, const char* apIp) {
    if (hostHeader == nullptr || hostHeader[0] == '\0') {
        return true;
    }

    // Trim leading whitespace
    while (*hostHeader == ' ' || *hostHeader == '\t') {
        ++hostHeader;
    }
    if (*hostHeader == '\0') {
        return true;
    }

    // Strip optional ":port" suffix
    size_t hostLen = 0;
    while (hostHeader[hostLen] != '\0' && hostHeader[hostLen] != ':' &&
           hostHeader[hostLen] != ' ' && hostHeader[hostLen] != '\t') {
        ++hostLen;
    }
    // Strip optional trailing DNS root dot (e.g., "achaemenid.local.")
    while (hostLen > 0 && hostHeader[hostLen - 1] == '.') {
        --hostLen;
    }
    if (hostLen == 0) {
        return true;
    }

    char expectedLocal[MAX_MDNS_HOSTNAME_LEN + 8];
    char cleanHost[MAX_MDNS_HOSTNAME_LEN + 1];
    sanitizeMdnsHostname(mdnsHost, cleanHost, sizeof(cleanHost));
    snprintf(expectedLocal, sizeof(expectedLocal), "%s.local", cleanHost);

    if (equalsIgnoreCaseN(hostHeader, hostLen, expectedLocal, strlen(expectedLocal))) {
        return true;
    }
    if (apIp != nullptr && apIp[0] != '\0' &&
        equalsIgnoreCaseN(hostHeader, hostLen, apIp, strlen(apIp))) {
        return true;
    }
    return false;
}

bool isCaptivePortalProbePath(const char* uri) {
    if (uri == nullptr || uri[0] == '\0') return false;

    // Strip query string if present
    char path[64];
    size_t len = 0;
    while (uri[len] != '\0' && uri[len] != '?' && len + 1 < sizeof(path)) {
        path[len] = uri[len];
        ++len;
    }
    path[len] = '\0';

    static const char* const kProbePaths[] = {
        "/generate_204",
        "/gen_204",
        "/mobile/status.php",
        "/hotspot-detect.html",
        "/library/test/success.html",
        "/connecttest.txt",
        "/ncsi.txt",
        "/redirect",
        "/fwlink",
        "/canonical.html",
        "/success.txt",
        "/check_network_status.txt",
        "/nm",
        "/wpad.dat",
    };

    for (size_t i = 0; i < sizeof(kProbePaths) / sizeof(kProbePaths[0]); ++i) {
        if (equalsIgnoreCase(path, kProbePaths[i])) {
            return true;
        }
    }
    return false;
}

bool shouldRedirectToPortal(
    const char* hostHeader,
    const char* uri,
    const char* mdnsHost,
    const char* apIp
) {
    if (isCaptivePortalProbePath(uri)) {
        return true;
    }
    return !isPortalHost(hostHeader, mdnsHost, apIp);
}

unsigned long computeReconnectBackoffMs(uint8_t consecutiveFailures) {
    if (consecutiveFailures == 0) return 5000UL;
    if (consecutiveFailures == 1) return 10000UL;
    if (consecutiveFailures == 2) return 20000UL;
    return 30000UL;
}

void escapeHtmlToBuffer(const char* input, char* out, size_t outSize) {
    if (!out || outSize == 0) return;
    if (!input) {
        out[0] = '\0';
        return;
    }

    size_t pos = 0;
    for (const char* p = input; *p != '\0' && pos + 1 < outSize; ++p) {
        const char* rep = nullptr;
        switch (*p) {
            case '&': rep = "&amp;"; break;
            case '<': rep = "&lt;"; break;
            case '>': rep = "&gt;"; break;
            case '"': rep = "&quot;"; break;
            case '\'': rep = "&#39;"; break;
            default: break;
        }
        if (rep != nullptr) {
            const size_t repLen = strlen(rep);
            if (pos + repLen >= outSize) break;
            memcpy(out + pos, rep, repLen);
            pos += repLen;
        } else if (static_cast<unsigned char>(*p) >= 0x20) {
            out[pos++] = *p;
        }
    }
    out[pos] = '\0';
}

void escapeJsonToBuffer(const char* input, char* out, size_t outSize) {
    if (!out || outSize == 0) return;
    if (!input) {
        out[0] = '\0';
        return;
    }

    size_t pos = 0;
    for (const char* p = input; *p != '\0' && pos + 1 < outSize; ++p) {
        const unsigned char c = static_cast<unsigned char>(*p);
        if (c == '"' || c == '\\') {
            if (pos + 2 >= outSize) break;
            out[pos++] = '\\';
            out[pos++] = static_cast<char>(c);
        } else if (c >= 0x20) {
            out[pos++] = static_cast<char>(c);
        }
    }
    out[pos] = '\0';
}

} // namespace uniuno
