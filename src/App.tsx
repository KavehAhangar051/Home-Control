import React, { useState, useEffect, useCallback } from 'react';
import {
  DecodedMqttCommand,
  INITIAL_SEGMENTS,
  INITIAL_SERIAL_LOGS,
  MAX_SEGMENTS,
  MqttConfig,
  RuleActionType,
  RuleConfig,
  SegmentConfig,
  SerialLogEntry,
  WifiNetworkConfig,
  bytesToHex,
  deleteSimulatorSegment,
  encodeSyncStateFrame,
  evaluateInputRuleTransition,
  upsertSimulatorSegment,
} from './utils/achaemenidCore';
import { PinManagerPanel } from './components/PinManagerPanel';
import { RuleEnginePanel } from './components/RuleEnginePanel';
import { MqttProtocolPanel } from './components/MqttProtocolPanel';
import { DiagnosticsPanel } from './components/DiagnosticsPanel';
import { Cpu, GitBranch, Terminal, Activity, RefreshCw } from 'lucide-react';

type ActiveSection = 'pins' | 'rules' | 'mqtt' | 'diagnostics';

export function App() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('pins');
  const [segments, setSegments] = useState<SegmentConfig[]>(INITIAL_SEGMENTS);
  const [serialLogs, setSerialLogs] = useState<SerialLogEntry[]>(INITIAL_SERIAL_LOGS);
  const [dashboardOnline, setDashboardOnline] = useState<boolean>(true);
  const [externalHexFrame, setExternalHexFrame] = useState<string | null>(null);
  const [uptimeSeconds, setUptimeSeconds] = useState<number>(42);

  const [wifiNetworks, setWifiNetworks] = useState<WifiNetworkConfig[]>([
    { ssid: 'Achaemenid-Lab-2.4G', password: 'esp32modular', valid: true },
  ]);
  const [mqttConfig, setMqttConfig] = useState<MqttConfig>({
    host: 'broker.emqx.io',
    port: 1883,
    baseTopic: 'KamyarIoT/Achaemenid',
    qos: 1,
    valid: true,
  });

  const appendLog = useCallback(
    (level: SerialLogEntry['level'], source: string, message: string) => {
      setSerialLogs((prev) => {
        const now = new Date();
        const ts = `${String(now.getMinutes()).padStart(2, '0')}:${String(
          now.getSeconds()
        ).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;
        const nextEntry: SerialLogEntry = {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: ts,
          level,
          source,
          message,
        };
        return [...prev.slice(-79), nextEntry];
      });
    },
    []
  );

  // 1-second hardware timer tick for auto-off countdowns & uptime
  useEffect(() => {
    const interval = window.setInterval(() => {
      setUptimeSeconds((u) => u + 1);
      setSegments((prev) => {
        let changed = false;
        const expiredPins: number[] = [];

        const next = prev.map((seg) => {
          if (seg.remainingTimerSec && seg.remainingTimerSec > 0) {
            changed = true;
            const rem = seg.remainingTimerSec - 1;
            if (rem <= 0) {
              expiredPins.push(seg.pin);
              return {
                ...seg,
                value: false,
                remainingTimerSec: 0,
              };
            }
            return {
              ...seg,
              remainingTimerSec: rem,
            };
          }
          return seg;
        });

        if (expiredPins.length > 0) {
          for (const p of expiredPins) {
            appendLog(
              'INFO',
              'Hardware/lib/PinManager/src/timers/PinTimerManager.cpp:44',
              `[PinTimerManager] Auto-off timer expired for GPIO ${p} -> OFF`
            );
          }
        }

        return changed ? next : prev;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [appendLog]);

  const handleToggleOutput = useCallback(
    (pin: number, nextState: boolean, timerSec: number, origin = 'DashboardCommand') => {
      setSegments((prev) =>
        prev.map((seg) => {
          if (seg.pin !== pin) return seg;
          return {
            ...seg,
            value: nextState,
            autoOffDelay: timerSec,
            remainingTimerSec: nextState && timerSec > 0 ? timerSec : 0,
          };
        })
      );
      appendLog(
        'INFO',
        'Hardware/lib/PinManager/src/state/PinStateManager.cpp:31',
        `[PinManager] GPIO ${pin} -> ${nextState ? 'ON (HIGH)' : 'OFF (LOW)'} (Origin: ${origin}${
          nextState && timerSec > 0 ? `, autoOff=${timerSec}s` : ''
        })`
      );
    },
    [appendLog]
  );

  const handleTriggerInput = useCallback(
    (pin: number, nextState: boolean, heldSec: 0 | 3 | 5 | 10) => {
      const targetInput = segments.find((s) => s.pin === pin);
      if (!targetInput) return;

      const effects = evaluateInputRuleTransition(
        pin,
        nextState,
        heldSec,
        targetInput.rule
      );

      setSegments((prev) =>
        prev.map((seg) => {
          if (seg.pin === pin) {
            return { ...seg, value: nextState, holdDurationSec: heldSec };
          }
          const matchingEffects = effects.filter((ef) => ef.targetPin === seg.pin);
          if (matchingEffects.length > 0) {
            const lastEf = matchingEffects[matchingEffects.length - 1];
            const remTimer =
              lastEf.actionType === RuleActionType.ACTION_FOR_DURATION &&
              lastEf.newState &&
              lastEf.delaySec > 0
                ? lastEf.delaySec
                : 0;
            return {
              ...seg,
              value: lastEf.newState,
              remainingTimerSec: remTimer,
            };
          }
          return seg;
        })
      );

      appendLog(
        'INFO',
        'Hardware/lib/AchaemenidRuleEngine/src/RuleEngine.cpp:58',
        `[Input] Pin ${pin} state changed to ${nextState ? 'HIGH' : 'LOW'} (duration: ${heldSec}s)`
      );

      for (const ef of effects) {
        appendLog(
          'INFO',
          'Hardware/lib/AchaemenidRuleEngine/src/strategies/ActionStrategies.cpp:27',
          ef.reason
        );
      }
    },
    [segments, appendLog]
  );

  const handleAddSegment = useCallback(
    (pin: number, id: string, type: 'output' | 'input') => {
      let replacedId: string | undefined;
      setSegments((prev) => {
        const result = upsertSimulatorSegment(prev, pin, id, type);
        replacedId = result.replacedId;
        return result.segments;
      });
      appendLog(
        'INFO',
        'Hardware/lib/PinManager/src/core/PinManager_Setup.cpp:147',
        replacedId
          ? `[PinManager] Replaced segment '${replacedId}' on pin ${pin} with '${id}' (Type: ${type})`
          : `[PinManager] Added segment '${id}' on pin ${pin} (Type: ${type})`
      );
    },
    [appendLog]
  );

  const handleDeleteSegment = useCallback(
    (id: string, fallbackPin?: number) => {
      let resolvedBy: 'id' | 'fallback_pin' | 'canonical_id' | 'none' = 'none';
      let removedSeg: SegmentConfig | undefined;
      setSegments((prev) => {
        const result = deleteSimulatorSegment(prev, id, fallbackPin);
        resolvedBy = result.resolvedBy;
        removedSeg = result.removed;
        return result.segments;
      });
      if (resolvedBy === 'none') {
        appendLog(
          'WARN',
          'Hardware/lib/PinManager/src/core/PinManager_Setup.cpp:365',
          `[PinManager] Segment '${id}'${fallbackPin !== undefined ? ` (fallback pin ${fallbackPin})` : ''} not found.`
        );
      } else if (resolvedBy === 'fallback_pin' || resolvedBy === 'canonical_id') {
        appendLog(
          'WARN',
          'Hardware/lib/PinManager/src/core/PinManager_Setup.cpp:344',
          `[PinManager] Segment '${id}' not found; resolved via GPIO ${removedSeg?.pin} (stored id='${removedSeg?.id}') and removed from PinRegistry and NVS`
        );
      } else {
        appendLog(
          'INFO',
          'Hardware/lib/AchaemenidMQTT/src/parsers/SegmentParsers.cpp:190',
          `[MQTT Handler] Binary Delete: id=${id}${fallbackPin !== undefined ? ` pin=${fallbackPin}` : ''} removed from PinRegistry and NVS`
        );
      }
    },
    [appendLog]
  );

  const handleUpdateRule = useCallback(
    (inputPin: number, rule: RuleConfig) => {
      setSegments((prev) =>
        prev.map((seg) => (seg.pin === inputPin ? { ...seg, rule } : seg))
      );
      appendLog(
        'INFO',
        'Hardware/lib/AchaemenidMQTT/src/parsers/RuleParsers.cpp:109',
        `[MQTT Handler] Binary Update Rule: input_gpio=${inputPin} high=${rule.highActions.length} low=${rule.lowActions.length} active=${
          rule.active ? 1 : 0
        }`
      );
    },
    [appendLog]
  );

  const handleDispatchDecodedCommand = useCallback(
    (decoded: DecodedMqttCommand, rawHex: string) => {
      if (!decoded.valid) {
        appendLog(
          'WARN',
          'Hardware/lib/AchaemenidMQTT/src/parsers/MqttCommandDispatcher.cpp:44',
          `${decoded.summary} (Frame: ${rawHex})`
        );
        return;
      }

      appendLog(
        'INFO',
        'Hardware/lib/AchaemenidMQTT/src/parsers/MqttCommandDispatcher.cpp:36',
        `${decoded.summary} [Hex: ${rawHex}]`
      );

      switch (decoded.eventType) {
        case 'TOGGLE_PIN':
        case 'AUTOMATION_TOGGLE': {
          const { pin, state, timer } = decoded.payloadData!;
          handleToggleOutput(
            pin!,
            Boolean(state),
            timer ?? 0,
            decoded.eventType === 'AUTOMATION_TOGGLE'
              ? 'Automation'
              : 'DashboardCommand'
          );
          break;
        }
        case 'ADD_SEGMENT': {
          const { pin, id, segmentType } = decoded.payloadData!;
          if (pin !== undefined && id && segmentType) {
            handleAddSegment(pin, id, segmentType);
          }
          break;
        }
        case 'DELETE_SEGMENT': {
          const { id, pin } = decoded.payloadData!;
          if (id || pin !== undefined) {
            handleDeleteSegment(id ?? '', pin);
          }
          break;
        }
        case 'DASHBOARD_PRESENCE': {
          const isOnline = Boolean(decoded.payloadData?.isOnline);
          setDashboardOnline(isOnline);
          break;
        }
        case 'UPDATE_RULE': {
          const { pin, rule } = decoded.payloadData!;
          if (pin !== undefined && rule) {
            handleUpdateRule(pin, rule);
          }
          break;
        }
        case 'BATCH_TOGGLE': {
          const batch = decoded.payloadData?.batch ?? [];
          for (const op of batch) {
            handleToggleOutput(op.pin, op.state, op.timer, 'BatchDashboardCommand');
          }
          break;
        }
        case 'SYNC_STATE': {
          appendLog(
            'INFO',
            'Hardware/src/events/EventHandlers.cpp:94',
            `[StateSync] Published binary pin snapshot for ${segments.length} active NVS segments.`
          );
          break;
        }
      }
    },
    [
      appendLog,
      handleAddSegment,
      handleDeleteSegment,
      handleToggleOutput,
      handleUpdateRule,
      segments.length,
    ]
  );

  const handleInspectBinaryFrame = (hex: string) => {
    setExternalHexFrame(hex);
    setActiveSection('mqtt');
  };

  const handleSimulateCrashOrBoot = (
    stackSize16KB: boolean,
    isolatedNvsFrame: boolean
  ) => {
    if (!stackSize16KB && !isolatedNvsFrame) {
      appendLog(
        'ERROR',
        'Hardware/lib/AchaemenidNetwork/AchaemenidNetwork.cpp:23',
        "Guru Meditation Error: Core 1 panic'ed (Unhandled debug exception). Debug exception reason: Stack canary watchpoint triggered (loopTask)"
      );
    } else {
      appendLog(
        'SYS',
        'Hardware/lib/AchaemenidBootManager/src/BootManager.cpp:229',
        `Instant Boot Verified — loopTask stack=${
          stackSize16KB ? '16384B' : '8192B'
        }, isolatedFrame=${isolatedNvsFrame ? 'ENABLED' : 'INLINE'}`
      );
    }
  };

  const handleSyncStateRequest = () => {
    const hex = bytesToHex(encodeSyncStateFrame());
    appendLog(
      'INFO',
      'Hardware/lib/AchaemenidMQTT/src/parsers/StateParsers.cpp:76',
      `[MQTT Handler] Received State Sync Request (0x09) [Hex: ${hex}] — All ${segments.length} pins synchronized`
    );
  };

  const activeOutputsCount = segments.filter(
    (s) => s.type === 'output' && s.value
  ).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-800 bg-slate-950">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('pins');
          }}
          className="text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
        >
          Achaemenid IoT Node
        </a>

        {/* Zone 2: 4 clean single-line text navigation links */}
        <nav
          aria-label="Primary firmware workspaces"
          className="flex items-center gap-6 text-sm font-medium text-slate-400 overflow-x-auto"
        >
          <a
            href="#pins"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('pins');
            }}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 py-1 ${
              activeSection === 'pins'
                ? 'text-slate-100 underline underline-offset-8 decoration-sky-500 decoration-2'
                : ''
            }`}
          >
            Pin Manager
          </a>
          <a
            href="#rules"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('rules');
            }}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 py-1 ${
              activeSection === 'rules'
                ? 'text-slate-100 underline underline-offset-8 decoration-sky-500 decoration-2'
                : ''
            }`}
          >
            Rule Engine
          </a>
          <a
            href="#mqtt"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('mqtt');
            }}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 py-1 ${
              activeSection === 'mqtt'
                ? 'text-slate-100 underline underline-offset-8 decoration-sky-500 decoration-2'
                : ''
            }`}
          >
            MQTT Protocol
          </a>
          <a
            href="#diagnostics"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('diagnostics');
            }}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 py-1 ${
              activeSection === 'diagnostics'
                ? 'text-slate-100 underline underline-offset-8 decoration-sky-500 decoration-2'
                : ''
            }`}
          >
            Stack &amp; Serial
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={handleSyncStateRequest}
            className="px-4 py-2 text-xs font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-500 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Sync Node (0x09)
          </button>
        </div>
      </header>

      {/* Workspace Body: Sidebar + Main Viewport */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-[1440px] w-full mx-auto">
        {/* Sidebar Navigation & Node Hardware Summary */}
        <aside className="w-full lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-800 p-5 flex flex-col justify-between gap-6 bg-slate-950/50">
          <div className="space-y-6">
            <div>
              <div className="text-xs font-medium text-slate-400 mb-2">
                Firmware Modules
              </div>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setActiveSection('pins')}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    activeSection === 'pins'
                      ? 'bg-slate-800 text-slate-100'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-sky-400" />
                    GPIO Pin Manager
                  </span>
                  <span className="font-mono tabular-nums text-slate-400">
                    {segments.length}/{MAX_SEGMENTS}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('rules')}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    activeSection === 'rules'
                      ? 'bg-slate-800 text-slate-100'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-indigo-400" />
                    RuleEngine Studio
                  </span>
                  <span className="font-mono tabular-nums text-slate-400">
                    {segments.filter((s) => s.type === 'input').length} In
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('mqtt')}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    activeSection === 'mqtt'
                      ? 'bg-slate-800 text-slate-100'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    Binary MQTT Bus
                  </span>
                  <span className="font-mono text-slate-400">0x01–0x09</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('diagnostics')}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    activeSection === 'diagnostics'
                      ? 'bg-slate-800 text-slate-100'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-amber-400" />
                    Stack &amp; UART Logs
                  </span>
                  <span className="font-mono tabular-nums text-slate-400">
                    16KB
                  </span>
                </button>
              </div>
            </div>

            {/* Clean unboxed telemetry summary */}
            <div className="pt-4 border-t border-slate-800 space-y-3 text-xs">
              <div className="font-medium text-slate-300">
                Hardware Node Telemetry
              </div>
              <dl className="space-y-2 text-slate-400">
                <div className="flex justify-between">
                  <dt>Target MCU</dt>
                  <dd className="font-mono text-slate-200">ESP32 Xtensa LX6</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Hardware Timer</dt>
                  <dd className="font-mono tabular-nums text-slate-200">1ms (1000Hz)</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Active Relays</dt>
                  <dd className="font-mono tabular-nums text-emerald-400">
                    {activeOutputsCount} HIGH
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>MQTT Presence</dt>
                  <dd className="font-mono text-slate-200">
                    {dashboardOnline ? 'Online (0x01)' : 'Offline (0x00)'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>Primary SSID</dt>
                  <dd className="font-mono text-slate-200 truncate max-w-[120px]">
                    {wifiNetworks[0]?.ssid || 'None'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>Node Uptime</dt>
                  <dd className="font-mono tabular-nums text-slate-200">
                    {uptimeSeconds}s
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="text-xs text-slate-500 pt-4 border-t border-slate-800/80">
            <div>Achaemenid Modular Async</div>
            <div className="font-mono text-slate-400 mt-0.5 truncate">
              {mqttConfig.host}:{mqttConfig.port}
            </div>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="flex-1 p-6 lg:p-8 space-y-6 overflow-x-hidden">
          {/* Unboxed Metadata Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400 pb-4 border-b border-slate-800/80">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-200 font-medium">
                ESP32 Modular Async Firmware
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">Topic: {mqttConfig.baseTopic}/Command</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                loopTask Stack: 16,384 Bytes
              </span>
            </div>

            <div className="font-mono tabular-nums text-slate-300">
              Last UART Event: {serialLogs[serialLogs.length - 1]?.timestamp ?? '00:00.000'}
            </div>
          </div>

          {activeSection === 'pins' && (
            <PinManagerPanel
              segments={segments}
              onToggleOutput={handleToggleOutput}
              onTriggerInput={handleTriggerInput}
              onAddSegment={handleAddSegment}
              onDeleteSegment={handleDeleteSegment}
              onInspectBinaryFrame={handleInspectBinaryFrame}
            />
          )}

          {activeSection === 'rules' && (
            <RuleEnginePanel
              segments={segments}
              onUpdateRule={handleUpdateRule}
              onSimulateInput={handleTriggerInput}
            />
          )}

          {activeSection === 'mqtt' && (
            <MqttProtocolPanel
              externalHexFrame={externalHexFrame}
              onDispatchDecodedCommand={handleDispatchDecodedCommand}
            />
          )}

          {activeSection === 'diagnostics' && (
            <DiagnosticsPanel
              activeSegmentCount={segments.length}
              serialLogs={serialLogs}
              wifiNetworks={wifiNetworks}
              mqttConfig={mqttConfig}
              onSaveProvisioning={(nets, mqtt) => {
                setWifiNetworks(nets);
                setMqttConfig(mqtt);
                appendLog(
                  'INFO',
                  'Hardware/src/setup/NetworkStorage.cpp:92',
                  `Network configuration saved to NVS (Preferences) — SSID: '${nets[0]?.ssid}', MQTT: '${mqtt.host}'`
                );
              }}
              onClearLogs={() => setSerialLogs([])}
              onSimulateCrashOrBoot={handleSimulateCrashOrBoot}
            />
          )}
        </main>
      </div>
    </div>
  );
}
export default App;
