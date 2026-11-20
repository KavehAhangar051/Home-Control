import React, { useState, useEffect } from 'react';
import {
  DecodedMqttCommand,
  bytesToHex,
  decodeMqttBinaryFrame,
  encodeAddSegmentFrame,
  encodePresenceFrame,
  encodeSyncStateFrame,
  encodeTogglePinFrame,
  hexToBytes,
} from '../utils/achaemenidCore';
import { Terminal, Send, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface MqttProtocolPanelProps {
  externalHexFrame: string | null;
  onDispatchDecodedCommand: (decoded: DecodedMqttCommand, rawHex: string) => void;
}

const PRESET_FRAMES = [
  {
    label: '0x01 Toggle GPIO 2 ON (15s Timer)',
    hex: bytesToHex(encodeTogglePinFrame(2, true, 15)),
  },
  {
    label: '0x01 Toggle GPIO 14 ON (Continuous)',
    hex: bytesToHex(encodeTogglePinFrame(14, true, 0)),
  },
  {
    label: '0x02 Add Segment pump_a on GPIO 25',
    hex: bytesToHex(encodeAddSegmentFrame(25, 'pump_a', 'output')),
  },
  {
    label: '0x04 Dashboard Presence ONLINE',
    hex: bytesToHex(encodePresenceFrame(true)),
  },
  {
    label: '0x09 Request Full State Sync',
    hex: bytesToHex(encodeSyncStateFrame()),
  },
  {
    label: 'Legacy JSON Payload (Rejected by Firmware)',
    hex: '7B 22 63 6D 64 22 3A 22 74 6F 67 67 6C 65 22 7D',
  },
];

export const MqttProtocolPanel: React.FC<MqttProtocolPanelProps> = ({
  externalHexFrame,
  onDispatchDecodedCommand,
}) => {
  const [hexInput, setHexInput] = useState<string>(PRESET_FRAMES[0].hex);

  useEffect(() => {
    if (externalHexFrame) {
      setHexInput(externalHexFrame);
    }
  }, [externalHexFrame]);

  const parsedBytes = hexToBytes(hexInput);
  const decoded: DecodedMqttCommand | null = parsedBytes
    ? decodeMqttBinaryFrame(parsedBytes)
    : null;

  const handleDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedBytes || !decoded) return;
    onDispatchDecodedCommand(decoded, bytesToHex(parsedBytes));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">
            03. Binary MQTT Command Dispatcher (Zero-JSON Protocol)
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Topic: <span className="font-mono text-slate-200">KamyarIoT/Achaemenid/Command</span> · Broker: <span className="font-mono text-slate-200">broker.emqx.io:1883</span>
          </p>
        </div>
      </div>

      {/* Preset Command Generator Buttons */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-slate-400">
          Load Preset Binary Frame into Dispatcher:
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESET_FRAMES.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setHexInput(preset.hex)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                hexInput === preset.hex
                  ? 'bg-sky-600/20 border-sky-500 text-sky-300'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Hex Payload Editor & Live Decoder */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <form
          onSubmit={handleDispatch}
          className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label
                htmlFor="mqtt-hex-input"
                className="text-sm font-semibold text-slate-100 flex items-center gap-2"
              >
                <Terminal className="w-4 h-4 text-sky-400" />
                Raw Binary Payload (Hexadecimal Bytes)
              </label>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                {parsedBytes ? `${parsedBytes.length} bytes` : 'Invalid Hex'}
              </span>
            </div>

            <textarea
              id="mqtt-hex-input"
              rows={3}
              value={hexInput}
              onChange={(e) => setHexInput(e.target.value)}
              placeholder="01 02 01 0F 00 00 00"
              className="w-full p-3 text-sm font-mono bg-slate-950 border border-slate-800 rounded-lg text-sky-300 focus:outline-none focus:border-sky-500"
            />

            <p className="text-xs text-slate-400">
              Supported Opcodes: <span className="font-mono text-slate-300">0x01</span> (Toggle Pin),{' '}
              <span className="font-mono text-slate-300">0x02</span> (Add Segment),{' '}
              <span className="font-mono text-slate-300">0x03</span> (Delete Segment),{' '}
              <span className="font-mono text-slate-300">0x04</span> (Dashboard Presence),{' '}
              <span className="font-mono text-slate-300">0x05</span> (Update Rule),{' '}
              <span className="font-mono text-slate-300">0x06</span> (Automation Toggle),{' '}
              <span className="font-mono text-slate-300">0x08</span> (Batch Toggle),{' '}
              <span className="font-mono text-slate-300">0x09</span> (Sync State).
            </p>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={!parsedBytes}
              className="px-4 py-2 text-xs font-medium bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              Dispatch Binary Frame to MqttCommandDispatcher
            </button>
          </div>
        </form>

        {/* Live Parser Inspection Output */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-slate-100">
                IMqttPayloadHandler Inspection
              </h3>
              {decoded?.valid ? (
                <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Valid Frame
                </span>
              ) : (
                <span className="text-xs font-medium text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Rejected
                </span>
              )}
            </div>

            {!parsedBytes ? (
              <p className="text-xs text-rose-400">
                Enter an even number of hexadecimal characters (0–9, A–F).
              </p>
            ) : decoded ? (
              <dl className="space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <dt className="text-slate-400">Opcode Byte [0]:</dt>
                  <dd className="font-mono text-slate-100">{decoded.opcodeHex}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-400">Resolved Handler:</dt>
                  <dd className="font-mono text-slate-200">{decoded.commandName}</dd>
                </div>
                <div className="pt-2 border-t border-slate-800">
                  <dt className="text-slate-400 mb-1">Serial Log Output:</dt>
                  <dd className="font-mono text-slate-200 bg-slate-950 p-2.5 rounded border border-slate-800 break-words">
                    {decoded.summary}
                  </dd>
                </div>
                {decoded.error && (
                  <div className="text-rose-400 font-medium pt-1">
                    Reason: {decoded.error}
                  </div>
                )}
              </dl>
            ) : null}
          </div>

          <div className="text-xs text-slate-400 border-t border-slate-800 pt-3">
            Zero-allocation parsing via <span className="font-mono text-slate-300">StaticString&lt;32&gt;</span> and little-endian <span className="font-mono text-slate-300">readInt32LE</span>.
          </div>
        </div>
      </div>
    </div>
  );
};
