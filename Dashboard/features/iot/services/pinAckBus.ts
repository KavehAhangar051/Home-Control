type PinAckListener = () => void;

const pinAckListeners = new Map<string, Set<PinAckListener>>();

/**
 * Subscribe a UI indicator (e.g. a segment card status dot) to hardware `command_ack`
 * confirmations for a specific GPIO pin without mutating or subscribing to store state.
 */
export function subscribePinCommandAck(pinId: string, listener: PinAckListener): () => void {
  if (!pinId) {
    return () => {};
  }

  let listeners = pinAckListeners.get(pinId);

  if (!listeners) {
    listeners = new Set();
    pinAckListeners.set(pinId, listeners);
  }

  listeners.add(listener);

  return () => {
    const activeListeners = pinAckListeners.get(pinId);

    if (!activeListeners) return;

    activeListeners.delete(listener);

    if (activeListeners.size === 0) {
      pinAckListeners.delete(pinId);
    }
  };
}

/**
 * Emit a non-state-mutating `command_ack` pulse to UI subscribers for a specific GPIO pin.
 */
export function notifyPinCommandAck(pinId: string): void {
  if (!pinId) return;

  const listeners = pinAckListeners.get(pinId);

  if (!listeners || listeners.size === 0) return;

  for (const listener of Array.from(listeners)) {
    listener();
  }
}
