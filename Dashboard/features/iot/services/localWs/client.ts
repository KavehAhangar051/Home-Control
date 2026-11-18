export interface MinimalLocalSocket {
  readyState: number;
  send: (data: string) => void;
  close: () => void;
}

let localWs: MinimalLocalSocket | null = null;

type StateCallback = (pin: string, state: boolean) => void;

const stateCallbacks = new Set<StateCallback>();

export const getLocalWs = () => localWs;

export const setLocalWs = (ws: MinimalLocalSocket | null) => {
  localWs = ws;
};

export const onLocalStateUpdate = (callback: StateCallback) => {
  stateCallbacks.add(callback);

  return () => {
    stateCallbacks.delete(callback);
  };
};

export const dispatchLocalState = (pin: string, state: boolean) => {
  for (const callback of stateCallbacks) callback(pin, state);
};
