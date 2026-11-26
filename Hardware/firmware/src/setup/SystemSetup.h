#ifndef SYSTEM_SETUP_H
#define SYSTEM_SETUP_H

#include <cstdint>

void setupErrorHandler();
void setupWatchdog(uint32_t timeoutSec = 15);
void pollWatchdogAndOtaHealth();
void setupNetworkAndTime();
void setupTimer();
void setupMqtt();
void setupWebSocket();
void setupRuleEngine();

#endif // SYSTEM_SETUP_H
