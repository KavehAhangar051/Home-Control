#pragma once

#include <Arduino.h>
#include <Events/IEventDispatcher.h>

#include "MqttCommandDispatcher.h"

namespace uniuno {

class RuleParsers : public IMqttPayloadHandler {
public:
    bool canHandle(uint8_t cmdType) const override;
    void handle(const uint8_t* payload, size_t len, IEventDispatcher* dispatcher) override;

private:
    void parseUpdateRule(const uint8_t* payload, size_t len, IEventDispatcher* dispatcher);
};

} // namespace uniuno
