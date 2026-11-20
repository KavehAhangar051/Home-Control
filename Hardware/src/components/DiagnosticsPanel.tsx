import React, { useState } from 'react';
import {
  MqttConfig,
  SerialLogEntry,
  WifiNetworkConfig,
  calculateStackTelemetry,
} from '../utils/achaemenidCore';
import { ShieldAlert, ShieldCheck, Wifi, RotateCcw, Trash2 } from 'lucide-react';

interface DiagnosticsPanelProps {
  activeSegmentCount: number;
  serialLogs: SerialLogEntry[];
  wifiNetworks: WifiNetworkConfig[];
  mqttConfig: MqttConfig;
  onSaveProvisioning: (networks: WifiNetworkConfig[], mqtt: MqttConfig) => void;
  onClearLogs: () => void;
  onSimulateCrashOrBoot: (stackSize16KB: boolean, isolatedNvsFrame: boolean) => void;
}

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({
  activeSegmentCount,
  serialLogs,
  wifiNetworks,
  mqttConfig,
  onSaveProvisioning,
  onClearLogs,
  onSimulateCrashOrBoot,
}) => {
  const [stackSize16KB, setStackSize16KB] = useState(true);
  const [isolatedNvsFrame, setIsolatedNvsFrame] = useState(true);

  const [ssid0, setSsid0] = useState(wifiNetworks[0]?.ssid || 'Achaemenid-Lab-2.4G');
  const [pass0, setPass0] = useState(wifiNetworks[0]?.password || 'esp32modular');
  const [ssid1, setSsid1] = useState(wifiNetworks[1]?.ssid || 'Factory-Floor-AP');
  const [pass1, setPass1] = useState(wifiNetworks[1]?.password || 'industrial99');
  const [brokerHost, setBrokerHost] = useState(mqttConfig.host);
  const [baseTopic, setBaseTopic] = useState(mqttConfig.baseTopic);
  const [provStatus, setProvStatus] = useState<string | null>(null);

  const telemetry = calculateStackTelemetry({
    stackSize16KB,
    isolatedNvsFrame,
    activeSegmentCount,
  });

  const usagePercent = Math.min(
    100,
    Math.round((telemetry.peakConcurrentBytes / telemetry.totalStackBytes) * 100)
  );

  const handleTriggerBootTest = (next16K: boolean, nextIsolated: boolean) => {
    setStackSize16KB(next16K);
    setIsolatedNvsFrame(nextIsolated);
    onSimulateCrashOrBoot(next16K, nextIsolated);
  };

  const handleSaveNetwork = (e: React.FormEvent) => {
    e.preventDefault();
    setProvStatus(null);
    if (!ssid0.trim()) {
      setProvStatus('Primary Wi-Fi SSID cannot be empty.');
      return;
    }
    const updatedWifi: WifiNetworkConfig[] = [
      { ssid: ssid0.trim(), password: pass0, valid: true },
      ...(ssid1.trim() ? [{ ssid: ssid1.trim(), password: pass1, valid: true }] : []),
    ];
    const updatedMqtt: MqttConfig = {
      ...mqttConfig,
      host: brokerHost.trim() || 'broker.emqx.io',
      baseTopic: baseTopic.trim() || 'KamyarIoT/Achaemenid',
      valid: true,
    };
    onSaveProvisioning(updatedWifi, updatedMqtt);
    setProvStatus('Saved Wi-Fi & MQTT configuration to NVS Preferences (AchaemenidNet).');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">
            04. ESP32 LoopTask Stack Analyzer &amp; UART Serial Monitor
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Diagnose the <span className="font-mono text-slate-300">Output-Of-Serial.md</span> Stack Canary panic during <span className="font-mono text-slate-300">esp_wifi_init()</span> and verify the 16KB + isolated NVS frame fix
          </p>
        </div>
      </div>

      {/* Stack Telemetry Comparison & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100">
              Arduino-ESP32 loopTask Stack Memory Budget
            </h3>
            {telemetry.canaryTriggered ? (
              <span className="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                GURU MEDITATION PANIC
              </span>
            ) : (
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                STACK CANARY SAFE
              </span>
            )}
          </div>

          <div className="divide-y divide-slate-800/80 border-t border-b border-slate-800/80 text-xs">
            <label className="flex items-center justify-between py-3 cursor-pointer">
              <div>
                <div className="font-medium text-slate-200">
                  getArduinoLoopTaskStackSize() = 16384 (main.cpp:21)
                </div>
                <div className="text-slate-400">
                  Overrides default 8,192B loopTask stack with 16,384B
                </div>
              </div>
              <input
                type="checkbox"
                checked={stackSize16KB}
                onChange={(e) =>
                  handleTriggerBootTest(e.target.checked, isolatedNvsFrame)
                }
                className="h-4 w-4 accent-sky-500"
              />
            </label>

            <label className="flex items-center justify-between py-3 cursor-pointer">
              <div>
                <div className="font-medium text-slate-200">
                  __attribute__((noinline)) loadOfflineConfigFromNvs()
                </div>
                <div className="text-slate-400">
                  Reclaims 4,512B ParseResult struct before esp_wifi_init() runs
                </div>
              </div>
              <input
                type="checkbox"
                checked={isolatedNvsFrame}
                onChange={(e) =>
                  handleTriggerBootTest(stackSize16KB, e.target.checked)
                }
                className="h-4 w-4 accent-sky-500"
              />
            </label>
          </div>

          {/* Stack bar & breakdown */}
          <div className="space-y-3 pt-1">
            <div className="flex justify-between text-xs font-mono tabular-nums">
              <span className="text-slate-400">
                Peak Stack Demand: {telemetry.peakConcurrentBytes} B / {telemetry.totalStackBytes} B
              </span>
              <span
                className={
                  telemetry.canaryTriggered ? 'text-rose-400 font-semibold' : 'text-emerald-400'
                }
              >
                {telemetry.freeHeadroomBytes >= 0
                  ? `${telemetry.freeHeadroomBytes} B Free Headroom`
                  : `Overflow by ${Math.abs(telemetry.freeHeadroomBytes)} B`}
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden">
              <div
                className={`h-full transition-transform duration-150 origin-left ${
                  telemetry.canaryTriggered ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
                style={{ transform: `scaleX(${usagePercent / 100})` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-800/80 text-xs font-mono tabular-nums">
              <div>
                <div className="text-slate-400">ParseResult</div>
                <div className="text-slate-200 font-semibold mt-0.5">
                  {telemetry.nvsParseResultBytes} B
                </div>
              </div>
              <div>
                <div className="text-slate-400">esp_wifi_init</div>
                <div className="text-slate-200 font-semibold mt-0.5">
                  {telemetry.wifiInitPeakBytes} B
                </div>
              </div>
              <div>
                <div className="text-slate-400">FastFunction SBO</div>
                <div className="text-slate-200 font-semibold mt-0.5">
                  {telemetry.fastFunctionSboBytes} B
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Local SoftAP Provisioning Portal (192.168.4.1 replica from BootManager.cpp) */}
        <form
          onSubmit={handleSaveNetwork}
          className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-sky-400" />
                  NVS Provisioning Portal (BootManager SoftAP 192.168.4.1)
                </h3>
                <p className="text-xs text-slate-400">
                  Fallback captive portal &amp; MQTT broker settings persisted in NVS namespace <span className="font-mono text-slate-300">AchaemenidNet</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label htmlFor="wifi-ssid-0" className="block text-slate-300 mb-1">
                  Primary Wi-Fi SSID (ssid0)
                </label>
                <input
                  id="wifi-ssid-0"
                  type="text"
                  value={ssid0}
                  onChange={(e) => setSsid0(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono"
                />
              </div>
              <div>
                <label htmlFor="wifi-pass-0" className="block text-slate-300 mb-1">
                  Primary Password (pass0)
                </label>
                <input
                  id="wifi-pass-0"
                  type="password"
                  value={pass0}
                  onChange={(e) => setPass0(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono"
                />
              </div>
              <div>
                <label htmlFor="wifi-ssid-1" className="block text-slate-300 mb-1">
                  Failover Wi-Fi SSID (ssid1)
                </label>
                <input
                  id="wifi-ssid-1"
                  type="text"
                  value={ssid1}
                  onChange={(e) => setSsid1(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono"
                />
              </div>
              <div>
                <label htmlFor="mqtt-broker-host" className="block text-slate-300 mb-1">
                  MQTT Broker Host
                </label>
                <input
                  id="mqtt-broker-host"
                  type="text"
                  value={brokerHost}
                  onChange={(e) => setBrokerHost(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Save to NVS &amp; Reconnect
            </button>
            {provStatus && (
              <span className="text-xs text-emerald-400">{provStatus}</span>
            )}
          </div>
        </form>
      </div>

      {/* UART 115200 Serial Output Console */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
          <div className="text-xs font-mono text-slate-300">
            UART0 Serial Stream (115200 baud) · {serialLogs.length} events logged
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleTriggerBootTest(false, false)}
              className="px-2.5 py-1 text-xs font-medium bg-rose-950/80 text-rose-300 border border-rose-800/70 hover:bg-rose-900/60 rounded transition-colors whitespace-nowrap shrink-0"
            >
              Reproduce Legacy 8KB Stack Crash
            </button>
            <button
              type="button"
              onClick={() => handleTriggerBootTest(true, true)}
              className="px-2.5 py-1 text-xs font-medium bg-slate-800 text-slate-200 hover:bg-slate-700 rounded transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              Reboot with 16KB Fix
            </button>
            <button
              type="button"
              onClick={onClearLogs}
              className="px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-slate-200 rounded transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-3 h-3" />
              Clear Serial
            </button>
          </div>
        </div>

        <div className="p-4 max-h-72 overflow-y-auto font-mono text-xs space-y-1.5 bg-slate-950/80">
          {serialLogs.length === 0 ? (
            <div className="text-slate-500 py-4 text-center">
              Serial buffer empty. Interact with GPIO pins, MQTT frames, or reboot sequence to inspect firmware logs.
            </div>
          ) : (
            serialLogs.map((entry) => (
              <div key={entry.id} className="leading-relaxed break-all">
                <span className="text-slate-500 tabular-nums">[{entry.timestamp}]</span>{' '}
                <span
                  className={
                    entry.level === 'ERROR'
                      ? 'text-rose-400 font-semibold'
                      : entry.level === 'WARN'
                        ? 'text-amber-400'
                        : entry.level === 'SYS'
                          ? 'text-sky-400'
                          : 'text-emerald-400'
                  }
                >
                  [{entry.level}]
                </span>
                ::<span className="text-slate-400">[{entry.source}]</span>:{' '}
                <span className="text-slate-200">{entry.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
