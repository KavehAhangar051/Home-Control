import { publishMqttCommand } from "./client";
import { PRESENCE_OFFLINE_FRAME, PRESENCE_ONLINE_FRAME } from "./protocol";

export const publishPresence = (isVisible: boolean) => {
  const presenceBuf = isVisible ? PRESENCE_ONLINE_FRAME : PRESENCE_OFFLINE_FRAME;

  publishMqttCommand(presenceBuf, `Published presence: ${isVisible}`);
};
