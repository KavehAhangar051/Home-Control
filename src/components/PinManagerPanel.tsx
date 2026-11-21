import React, { useState } from 'react';
import {
  MAX_SEGMENTS,
  SegmentConfig,
  bytesToHex,
  encodeAddSegmentFrame,
  encodeDeleteSegmentFrame,
  encodeTogglePinFrame,
} from '../utils/achaemenidCore';
import { Cpu, Plus, Trash2, Power, Clock, ArrowRightLeft } from 'lucide-react';

interface PinManagerPanelProps {
  segments: SegmentConfig[];
  onToggleOutput: (pin: number, nextState: boolean, timerSec: number) => void;
  onTriggerInput: (pin: number, nextState: boolean, heldSec: 0 | 3 | 5 | 10) => void;
  onAddSegment: (pin: number, id: string, type: 'output' | 'input') => void;
  onDeleteSegment: (id: string, pin?: number) => void;
  onInspectBinaryFrame: (hex: string) => void;
}

export const PinManagerPanel: React.FC<PinManagerPanelProps> = ({
  segments,
  onToggleOutput,
  onTriggerInput,
  onAddSegment,
  onDeleteSegment,
  onInspectBinaryFrame,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'output' | 'input'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHoldSec, setSelectedHoldSec] = useState<Record<number, 0 | 3 | 5 | 10>>({
    5: 3,
    19: 5,
  });
  const [selectedTimerSec, setSelectedTimerSec] = useState<Record<number, number>>({
    2: 0,
    14: 10,
    4: 0,
  });

  // Add Segment Form state
  const [newId, setNewId] = useState('');
  const [newPin, setNewPin] = useState('23');
  const [newType, setNewType] = useState<'output' | 'input'>('output');
  const [formError, setFormError] = useState<string | null>(null);

  const filteredSegments = segments.filter((seg) => {
    if (filterType !== 'all' && seg.type !== filterType) return false;
    if (
      searchQuery.trim() !== '' &&
      !seg.id.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !String(seg.pin).includes(searchQuery.trim())
    ) {
      return false;
    }
    return true;
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmedId = newId.trim();
    const pinNum = Number(newPin);

    if (!trimmedId) {
      setFormError('Segment ID is required (max 31 ASCII characters).');
      return;
    }
    if (!/^[a-zA-Z0-9_-]{1,31}$/.test(trimmedId)) {
      setFormError('Segment ID must contain only letters, digits, underscores, or hyphens.');
      return;
    }
    if (!Number.isInteger(pinNum) || pinNum < 0 || pinNum > 39) {
      setFormError('ESP32 GPIO pin number must be an integer between 0 and 39.');
      return;
    }
    if (segments.length >= MAX_SEGMENTS) {
      setFormError(`Maximum capacity of ${MAX_SEGMENTS} NVS segments reached.`);
      return;
    }
    if (segments.some((s) => s.id === trimmedId)) {
      setFormError(`Segment ID '${trimmedId}' is already registered in NVS.`);
      return;
    }
    if (segments.some((s) => s.pin === pinNum)) {
      setFormError(`GPIO Pin ${pinNum} is already assigned to another segment.`);
      return;
    }

    onAddSegment(pinNum, trimmedId, newType);
    setNewId('');
  };

  return (
    <div className="space-y-6">
      {/* Section Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">
            01. GPIO Pin Manager &amp; NVS Segment Registry
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Active pins: <span className="font-mono tabular-nums text-slate-200">{segments.length} / {MAX_SEGMENTS}</span> · Instant-boot offline NVS configuration loaded
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
            {(['all', 'output', 'input'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilterType(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  filterType === tab
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab === 'all' ? 'All Segments' : tab === 'output' ? 'Outputs' : 'Inputs'}
              </button>
            ))}
          </div>

          <input
            type="search"
            aria-label="Filter segments by ID or GPIO pin"
            placeholder="Search ID or GPIO..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* High-Density GPIO Segments Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-xs font-medium text-slate-400 bg-slate-950/60">
                <th className="py-3 px-4">Segment ID</th>
                <th className="py-3 px-4">GPIO Pin</th>
                <th className="py-3 px-4">Direction &amp; Rules</th>
                <th className="py-3 px-4">Digital State</th>
                <th className="py-3 px-4">Timing / Hold Configuration</th>
                <th className="py-3 px-4 text-right">Hardware Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-sm">
              {filteredSegments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 px-4 text-center text-slate-400">
                    No GPIO segments match your current filter. Clear the filter or register a new segment below.
                  </td>
                </tr>
              ) : (
                filteredSegments.map((seg) => {
                  const holdVal = selectedHoldSec[seg.pin] ?? 0;
                  const timerVal = selectedTimerSec[seg.pin] ?? seg.autoOffDelay;
                  const toggleHex = bytesToHex(
                    encodeTogglePinFrame(seg.pin, !seg.value, timerVal)
                  );

                  return (
                    <tr
                      key={seg.id}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono text-slate-100 font-medium whitespace-nowrap">
                        {seg.id}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-200 whitespace-nowrap">
                        GPIO {seg.pin}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-300 whitespace-nowrap">
                        <span className="font-medium text-slate-200">
                          {seg.type === 'output' ? 'Output Relay' : 'Digital Input'}
                        </span>
                        {seg.type === 'input' && (
                          <span className="text-slate-400">
                            {' '}
                            · {seg.rule.highActions.length}H / {seg.rule.lowActions.length}L rules
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums">
                        <span
                          className={`text-xs font-semibold ${
                            seg.value ? 'text-emerald-400' : 'text-slate-400'
                          }`}
                        >
                          {seg.value ? 'HIGH (ON)' : 'LOW (OFF)'}
                        </span>
                        {seg.remainingTimerSec && seg.remainingTimerSec > 0 ? (
                          <span className="ml-2 text-xs text-amber-400 font-mono tabular-nums">
                            · Auto-off in {seg.remainingTimerSec}s
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 px-4">
                        {seg.type === 'output' ? (
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <label
                              htmlFor={`timer-pin-${seg.pin}`}
                              className="text-xs text-slate-400 whitespace-nowrap"
                            >
                              Auto-Off:
                            </label>
                            <select
                              id={`timer-pin-${seg.pin}`}
                              aria-label={`Auto-off timer for GPIO ${seg.pin}`}
                              value={timerVal}
                              onChange={(e) =>
                                setSelectedTimerSec((prev) => ({
                                  ...prev,
                                  [seg.pin]: Number(e.target.value),
                                }))
                              }
                              className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-200"
                            >
                              <option value={0}>0s (Continuous)</option>
                              <option value={5}>5s</option>
                              <option value={10}>10s</option>
                              <option value={30}>30s</option>
                            </select>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <label
                              htmlFor={`hold-pin-${seg.pin}`}
                              className="text-xs text-slate-400 whitespace-nowrap"
                            >
                              Hold Duration:
                            </label>
                            <select
                              id={`hold-pin-${seg.pin}`}
                              aria-label={`Hold duration for input GPIO ${seg.pin}`}
                              value={holdVal}
                              onChange={(e) =>
                                setSelectedHoldSec((prev) => ({
                                  ...prev,
                                  [seg.pin]: Number(e.target.value) as 0 | 3 | 5 | 10,
                                }))
                              }
                              className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-200"
                            >
                              <option value={0}>0s (Instant)</option>
                              <option value={3}>3s Hold</option>
                              <option value={5}>5s Hold</option>
                              <option value={10}>10s Hold</option>
                            </select>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {seg.type === 'output' ? (
                            <button
                              type="button"
                              onClick={() => onToggleOutput(seg.pin, !seg.value, timerVal)}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                                seg.value
                                  ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                                  : 'bg-sky-600 text-white hover:bg-sky-500'
                              }`}
                            >
                              <Power className="w-3.5 h-3.5" />
                              {seg.value
                                ? `Turn OFF GPIO ${seg.pin}`
                                : `Turn ON GPIO ${seg.pin}`}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                onTriggerInput(seg.pin, !seg.value, holdVal)
                              }
                              className="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
                            >
                              Simulate {seg.value ? 'LOW' : 'HIGH'} ({holdVal}s) on GPIO {seg.pin}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onInspectBinaryFrame(toggleHex)}
                            title={`Load 0x01 binary frame (${toggleHex}) into MQTT protocol debugger`}
                            className="px-2.5 py-1.5 text-xs font-mono text-slate-300 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
                          >
                            0x01 Hex
                          </button>

                          <button
                            type="button"
                            aria-label={`Delete segment ${seg.id}`}
                            onClick={() => onDeleteSegment(seg.id, seg.pin)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register New Segment via 0x02 Binary Command */}
      <form
        onSubmit={handleAddSubmit}
        className="bg-slate-900 border border-slate-800 rounded-xl p-5"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-sky-400" />
              Register New GPIO Segment in NVS (Binary Opcode 0x02)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Encodes a zero-heap StaticString&lt;32&gt; binary frame and dispatches SegmentAddRequestEvent
            </p>
          </div>
          <div className="text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded border border-slate-800">
            Preview Frame:{' '}
            <span className="text-sky-400">
              {bytesToHex(
                encodeAddSegmentFrame(
                  Number(newPin) || 0,
                  newId.trim() || 'seg_id',
                  newType
                )
              )}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div>
            <label
              htmlFor="new-segment-id"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              Segment ID (StaticString&lt;32&gt;)
            </label>
            <input
              id="new-segment-id"
              type="text"
              maxLength={31}
              placeholder="e.g. valve_z1"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label
              htmlFor="new-segment-pin"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              ESP32 GPIO Pin (0–39)
            </label>
            <input
              id="new-segment-pin"
              type="number"
              min={0}
              max={39}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono tabular-nums focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label
              htmlFor="new-segment-type"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              Pin Mode
            </label>
            <select
              id="new-segment-type"
              value={newType}
              onChange={(e) => setNewType(e.target.value as 'output' | 'input')}
              className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-sky-500"
            >
              <option value="output">Output (GpioSwitch)</option>
              <option value="input">Input (RuleEngine Trigger)</option>
            </select>
          </div>

          <div>
            <button
              type="submit"
              className="w-full px-4 py-2 text-sm font-medium bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              Add GPIO Segment
            </button>
          </div>
        </div>

        {formError && (
          <p role="alert" className="mt-3 text-xs text-rose-400 font-medium">
            {formError}
          </p>
        )}
      </form>
    </div>
  );
};
