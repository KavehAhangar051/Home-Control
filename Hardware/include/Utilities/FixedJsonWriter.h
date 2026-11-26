#pragma once

#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstring>

namespace uniuno {

/**
 * @brief Zero-heap bounded JSON writer over a caller-provided char buffer.
 * Guarantees NUL-termination when capacity > 0 and tracks truncation via overflowed().
 */
class FixedJsonWriter {
public:
  FixedJsonWriter(char* buf, size_t capacity, size_t initialOffset = 0)
      : buf_(buf), cap_(capacity), len_(0), overflow_(false) {
    if (buf_ == nullptr || cap_ == 0) {
      overflow_ = true;
      return;
    }
    if (initialOffset >= cap_) {
      len_ = cap_ - 1;
      overflow_ = true;
    } else {
      len_ = initialOffset;
    }
    buf_[len_] = '\0';
  }

  void appendChar(char c) {
    if (buf_ == nullptr || cap_ == 0 || len_ + 1 >= cap_) {
      overflow_ = true;
      return;
    }
    buf_[len_++] = c;
    buf_[len_] = '\0';
  }

  void appendRaw(const char* text) {
    if (text == nullptr) return;
    const size_t n = std::strlen(text);
    if (n == 0) return;
    if (buf_ == nullptr || cap_ == 0 || len_ >= cap_ - 1) {
      overflow_ = true;
      return;
    }
    const size_t avail = (cap_ - 1) - len_;
    const size_t toCopy = (n <= avail) ? n : avail;
    if (toCopy < n) {
      overflow_ = true;
    }
    std::memcpy(buf_ + len_, text, toCopy);
    len_ += toCopy;
    buf_[len_] = '\0';
  }

  void appendJsonEscaped(const char* text) {
    if (text == nullptr) return;
    for (const char* p = text; *p != '\0'; ++p) {
      const unsigned char c = static_cast<unsigned char>(*p);
      if (c == '"' || c == '\\') {
        appendChar('\\');
        appendChar(static_cast<char>(c));
      } else if (c >= 0x20) {
        appendChar(static_cast<char>(c));
      }
    }
  }

  void appendBool(bool value) { appendRaw(value ? "true" : "false"); }

  void appendInt(int value) {
    char tmp[16];
    std::snprintf(tmp, sizeof(tmp), "%d", value);
    appendRaw(tmp);
  }

  void appendUInt(unsigned int value) {
    char tmp[16];
    std::snprintf(tmp, sizeof(tmp), "%u", value);
    appendRaw(tmp);
  }

  void appendULong(unsigned long value) {
    char tmp[24];
    std::snprintf(tmp, sizeof(tmp), "%lu", value);
    appendRaw(tmp);
  }

  size_t length() const { return len_; }
  bool overflowed() const { return overflow_; }

private:
  char* buf_;
  size_t cap_;
  size_t len_;
  bool overflow_;
};

} // namespace uniuno
