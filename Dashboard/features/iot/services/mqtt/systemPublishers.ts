import { publishMqttCommand } from "./client";
import { MQTT_OPCODES, PIN_STATE_HIGH, PIN_STATE_LOW } from "./protocol";

export const publishPresence = (isVisible: boolean) => {
  const presenceBuf = new Uint8Array([
    MQTT_OPCODES.PRESENCE,
    isVisible ? PIN_STATE_HIGH : PIN_STATE_LOW,
  ]);
  publishMqttCommand(presenceBuf, `Published presence: ${isVisible}`);
};
