#ifndef logging_h
#define logging_h
#pragma once

#include <ProjectConfig.h>
#include <stdarg.h>
#include <stdio.h>

#define LOG_LEVEL_TRACE 0
#define LOG_LEVEL_DEBUG 100
#define LOG_LEVEL_INFO 200
#define LOG_LEVEL_NOTICE 250
#define LOG_LEVEL_WARNING 300
#define LOG_LEVEL_ERROR 400
#define LOG_LEVEL_CRITICAL 500
#define LOG_LEVEL_ALERT 550
#define LOG_LEVEL_EMERGENCY 600

#ifndef LOG_LEVEL
#define LOG_LEVEL ACHAEMENID_LOG_LEVEL
#endif

#ifdef ARDUINO
#include <Arduino.h>
#endif

namespace uniuno {
namespace log_detail {

inline const char* levelName(int level) {
  switch (level) {
  case LOG_LEVEL_DEBUG:
    return "DEBUG";
  case LOG_LEVEL_INFO:
    return "INFO";
  case LOG_LEVEL_NOTICE:
    return "NOTICE";
  case LOG_LEVEL_WARNING:
    return "WARNING";
  case LOG_LEVEL_ERROR:
    return "ERROR";
  case LOG_LEVEL_CRITICAL:
    return "CRITICAL";
  case LOG_LEVEL_ALERT:
    return "ALERT";
  case LOG_LEVEL_EMERGENCY:
    return "EMERGENCY";
  default:
    return "TRACE";
  }
}

// Single linkonce cold helper: shrinks every log call site from 5 Serial calls to 1
// and acquires the HardwareSerial mutex only once per line (faster + atomic + huge Flash savings).
inline __attribute__((noinline, cold)) void emitMsg(int level, const char* file, int line, const char* msg) {
#if ACHAEMENID_LOG_INCLUDE_FILE_LINE
#ifdef ARDUINO
  Serial.printf("[%s]::[%s:%d]:%s\n", levelName(level), file, line, msg);
#else
  printf("[%s]::[%s:%d]:%s\n", levelName(level), file, line, msg);
#endif
#else
  (void)file;
  (void)line;
#ifdef ARDUINO
  Serial.printf("[%s]: %s\n", levelName(level), msg);
#else
  printf("[%s]: %s\n", levelName(level), msg);
#endif
#endif
}

inline __attribute__((noinline, cold)) void emitFmt(int level, const char* file, int line, const char* fmt, ...) {
  char buf[ACHAEMENID_LOG_LINE_BUF_SIZE];
  va_list args;
  va_start(args, fmt);
  vsnprintf(buf, sizeof(buf), fmt, args);
  va_end(args);
  emitMsg(level, file, line, buf);
}

} // namespace log_detail
} // namespace uniuno

#if ACHAEMENID_LOG_INCLUDE_FILE_LINE
#define LOG(level, msg)                                                                                                \
  do {                                                                                                                 \
    if (LOG_LEVEL <= (level)) {                                                                                        \
      ::uniuno::log_detail::emitMsg((level), __FILE__, __LINE__, (msg));                                               \
    }                                                                                                                  \
  } while (0)
#define LOGF(level, f_, ...)                                                                                           \
  do {                                                                                                                 \
    if (LOG_LEVEL <= (level)) {                                                                                        \
      ::uniuno::log_detail::emitFmt((level), __FILE__, __LINE__, (f_), __VA_ARGS__);                                   \
    }                                                                                                                  \
  } while (0)
#else
#define LOG(level, msg)                                                                                                \
  do {                                                                                                                 \
    if (LOG_LEVEL <= (level)) {                                                                                        \
      ::uniuno::log_detail::emitMsg((level), nullptr, 0, (msg));                                                       \
    }                                                                                                                  \
  } while (0)
#define LOGF(level, f_, ...)                                                                                           \
  do {                                                                                                                 \
    if (LOG_LEVEL <= (level)) {                                                                                        \
      ::uniuno::log_detail::emitFmt((level), nullptr, 0, (f_), __VA_ARGS__);                                           \
    }                                                                                                                  \
  } while (0)
#endif

#if LOG_LEVEL <= LOG_LEVEL_TRACE
#define TRACE(msg)                                                                                                     \
  {                                                                                                                    \
    LOG(LOG_LEVEL_TRACE, msg);                                                                                         \
  }
#define TRACEF(f_, ...)                                                                                                \
  {                                                                                                                    \
    LOGF(LOG_LEVEL_TRACE, f_, __VA_ARGS__);                                                                            \
  }
#else
#define TRACE(msg)
#define TRACEF(f_, ...)
#endif

#if LOG_LEVEL <= LOG_LEVEL_DEBUG
#define DEBUG(msg)                                                                                                     \
  {                                                                                                                    \
    LOG(LOG_LEVEL_DEBUG, msg);                                                                                         \
  }
#define DEBUGF(f_, ...)                                                                                                \
  {                                                                                                                    \
    LOGF(LOG_LEVEL_DEBUG, f_, __VA_ARGS__);                                                                            \
  }
#else
#define DEBUG(msg)
#define DEBUGF(f_, ...)
#endif

#if LOG_LEVEL <= LOG_LEVEL_INFO
#define INFO(msg)                                                                                                      \
  {                                                                                                                    \
    LOG(LOG_LEVEL_INFO, msg);                                                                                          \
  }
#define INFOF(f_, ...)                                                                                                 \
  {                                                                                                                    \
    LOGF(LOG_LEVEL_INFO, f_, __VA_ARGS__);                                                                             \
  }
#else
#define INFO(msg)
#define INFOF(f_, ...)
#endif

#if LOG_LEVEL <= LOG_LEVEL_NOTICE
#define NOTICE(msg)                                                                                                    \
  {                                                                                                                    \
    LOG(LOG_LEVEL_NOTICE, msg);                                                                                        \
  }
#define NOTICEF(f_, ...)                                                                                               \
  {                                                                                                                    \
    LOGF(LOG_LEVEL_NOTICE, f_, __VA_ARGS__);                                                                           \
  }
#else
#define NOTICE(msg)
#define NOTICEF(f_, ...)
#endif

#if LOG_LEVEL <= LOG_LEVEL_WARNING
#define WARNING(msg)                                                                                                   \
  {                                                                                                                    \
    LOG(LOG_LEVEL_WARNING, msg);                                                                                       \
  }
#define WARNINGF(f_, ...)                                                                                              \
  {                                                                                                                    \
    LOGF(LOG_LEVEL_WARNING, f_, __VA_ARGS__);                                                                          \
  }
#else
#define WARNING(msg)
#define WARNINGF(f_, ...)
#endif

#if LOG_LEVEL <= LOG_LEVEL_ERROR
#define ERROR(msg)                                                                                                     \
  {                                                                                                                    \
    LOG(LOG_LEVEL_ERROR, msg);                                                                                         \
  }
#define ERRORF(f_, ...)                                                                                                \
  {                                                                                                                    \
    LOGF(LOG_LEVEL_ERROR, f_, __VA_ARGS__);                                                                            \
  }
#else
#define ERROR(msg)
#define ERRORF(f_, ...)
#endif

#if LOG_LEVEL <= LOG_LEVEL_CRITICAL
#define CRITICAL(msg)                                                                                                  \
  {                                                                                                                    \
    LOG(LOG_LEVEL_CRITICAL, msg);                                                                                      \
  }
#define CRITICALF(f_, ...)                                                                                             \
  {                                                                                                                    \
    LOGF(LOG_LEVEL_CRITICAL, f_, __VA_ARGS__);                                                                         \
  }
#else
#define CRITICAL(msg)
#define CRITICALF(f_, ...)
#endif

#if LOG_LEVEL <= LOG_LEVEL_ALERT
#define ALERT(msg)                                                                                                     \
  {                                                                                                                    \
    LOG(LOG_LEVEL_ALERT, msg);                                                                                         \
  }
#define ALERTF(f_, ...)                                                                                                \
  {                                                                                                                    \
    LOGF(LOG_LEVEL_ALERT, f_, __VA_ARGS__);                                                                            \
  }
#else
#define ALERT(msg)
#define ALERTF(f_, ...)
#endif

#if LOG_LEVEL <= LOG_LEVEL_EMERGENCY
#define EMERGENCY(msg)                                                                                                 \
  {                                                                                                                    \
    LOG(LOG_LEVEL_EMERGENCY, msg);                                                                                     \
  }
#define EMERGENCYF(f_, ...)                                                                                            \
  {                                                                                                                    \
    LOGF(LOG_LEVEL_EMERGENCY, f_, __VA_ARGS__);                                                                        \
  }
#else
#define EMERGENCY(msg)
#define EMERGENCYF(f_, ...)
#endif

#endif