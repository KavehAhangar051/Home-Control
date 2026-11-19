import React, { useState } from 'react';
import {
  RuleAction,
  RuleActionType,
  RuleConfig,
  SegmentConfig,
  bytesToHex,
  encodeUpdateRuleFrame,
} from '../utils/achaemenidCore';
import { GitBranch, Play, Plus, Trash2, CheckCircle2 } from 'lucide-react';

interface RuleEnginePanelProps {
  segments: SegmentConfig[];
  onUpdateRule: (inputPin: number, rule: RuleConfig) => void;
  onSimulateInput: (pin: number, nextState: boolean, heldSec: 0 | 3 | 5 | 10) => void;
}

export const RuleEnginePanel: React.FC<RuleEnginePanelProps> = ({
  segments,
  onUpdateRule,
  onSimulateInput,
}) => {
  const inputSegments = segments.filter((s) => s.type === 'input');
  const outputSegments = segments.filter((s) => s.type === 'output');

  const [selectedInputPin, setSelectedInputPin] = useState<number>(
    inputSegments[0]?.pin ?? 5
  );
  const activeInputSeg =
    inputSegments.find((s) => s.pin === selectedInputPin) ?? inputSegments[0];

  const [branch, setBranch] = useState<'HIGH' | 'LOW'>('HIGH');
  const [targetPin, setTargetPin] = useState<number>(outputSegments[0]?.pin ?? 2);
  const [holdTime, setHoldTime] = useState<0 | 3 | 5 | 10>(0);
  const [actionState, setActionState] = useState<boolean>(true);
  const [actionType, setActionType] = useState<RuleActionType>(
    RuleActionType.ACTION_IMMEDIATE
  );
  const [delaySec, setDelaySec] = useState<number>(5);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  if (!activeInputSeg) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
        <h2 className="text-lg font-semibold text-slate-100">
          No Input Segments Configured
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Register at least one input GPIO segment in the Pin Manager tab to configure automation rules.
        </p>
      </div>
    );
  }

  const encodedRuleHex = bytesToHex(
    encodeUpdateRuleFrame(activeInputSeg.pin, activeInputSeg.rule)
  );

  const handleAddAction = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    const currentList =
      branch === 'HIGH'
        ? activeInputSeg.rule.highActions
        : activeInputSeg.rule.lowActions;

    if (currentList.length >= 4) {
      setStatusMsg(`Maximum 4 ${branch} actions allowed per input pin in RuleConfig.`);
      return;
    }

    const newAction: RuleAction = {
      targetPin,
      requiredHoldTime: holdTime,
      actionState,
      actionType,
      delay: actionType === RuleActionType.ACTION_IMMEDIATE ? 0 : Math.min(60, Math.max(0, delaySec)),
    };

    const updatedRule: RuleConfig = {
      active: true,
      highActions:
        branch === 'HIGH'
          ? [...activeInputSeg.rule.highActions, newAction]
          : [...activeInputSeg.rule.highActions],
      lowActions:
        branch === 'LOW'
          ? [...activeInputSeg.rule.lowActions, newAction]
          : [...activeInputSeg.rule.lowActions],
    };

    onUpdateRule(activeInputSeg.pin, updatedRule);
    setStatusMsg(
      `Dispatched 0x05 UPDATE_RULE for GPIO ${activeInputSeg.pin} (${branch} -> GPIO ${targetPin})`
    );
  };

  const handleRemoveAction = (group: 'HIGH' | 'LOW', index: number) => {
    const nextHigh =
      group === 'HIGH'
        ? activeInputSeg.rule.highActions.filter((_, i) => i !== index)
        : [...activeInputSeg.rule.highActions];
    const nextLow =
      group === 'LOW'
        ? activeInputSeg.rule.lowActions.filter((_, i) => i !== index)
        : [...activeInputSeg.rule.lowActions];

    onUpdateRule(activeInputSeg.pin, {
      highActions: nextHigh,
      lowActions: nextLow,
      active: nextHigh.length > 0 || nextLow.length > 0,
    });
  };

  const formatActionType = (act: RuleAction) => {
    if (act.actionType === RuleActionType.ACTION_IMMEDIATE) {
      return 'Immediate (ACTION_IMMEDIATE)';
    }
    if (act.actionType === RuleActionType.ACTION_AFTER_DELAY) {
      return `After ${act.delay}s Delay (ACTION_AFTER_DELAY)`;
    }
    return `For ${act.delay}s Duration (ACTION_FOR_DURATION)`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">
            02. RuleEngine &amp; HoldTimeEvaluator Studio
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Configure symmetrical HIGH/LOW input transitions, hold-time thresholds (0s, 3s, 5s, 10s), and 11-byte binary action structs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="rule-input-select"
            className="text-xs font-medium text-slate-400 whitespace-nowrap"
          >
            Source Input Pin:
          </label>
          <select
            id="rule-input-select"
            value={activeInputSeg.pin}
            onChange={(e) => setSelectedInputPin(Number(e.target.value))}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-100"
          >
            {inputSegments.map((seg) => (
              <option key={seg.id} value={seg.pin}>
                GPIO {seg.pin} ({seg.id}) — Currently {seg.value ? 'HIGH' : 'LOW'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Binary 0x05 Frame Inspector Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-slate-400">
            0x05 UPDATE_RULE Binary Frame (RuleParsers.cpp · 11 bytes per RuleAction)
          </div>
          <div className="font-mono text-xs text-sky-400 mt-1 break-all">
            {encodedRuleHex}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {([0, 3, 5, 10] as const).map((sec) => (
            <button
              key={sec}
              type="button"
              onClick={() => onSimulateInput(activeInputSeg.pin, true, sec)}
              className="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Play className="w-3 h-3" />
              Test HIGH ({sec}s Hold)
            </button>
          ))}
          <button
            type="button"
            onClick={() => onSimulateInput(activeInputSeg.pin, false, 0)}
            className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Test LOW (0s Release)
          </button>
        </div>
      </div>

      {/* High & Low Action Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(['HIGH', 'LOW'] as const).map((group) => {
          const actions =
            group === 'HIGH'
              ? activeInputSeg.rule.highActions
              : activeInputSeg.rule.lowActions;

          return (
            <div
              key={group}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">
                    {group} State Actions ({actions.length} / 4)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Executed when GPIO {activeInputSeg.pin} transitions to {group}
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  {group === 'HIGH' ? 'rule.highActions' : 'rule.lowActions'}
                </span>
              </div>

              {actions.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  No {group} actions configured for GPIO {activeInputSeg.pin}.
                </p>
              ) : (
                <div className="divide-y divide-slate-800/80">
                  {actions.map((act, idx) => (
                    <div
                      key={`${group}-${idx}`}
                      className="py-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="font-mono text-slate-200">
                          Hold &ge; <span className="text-sky-400">{act.requiredHoldTime}s</span>{' '}
                          &rarr; Target <span className="text-emerald-400">GPIO {act.targetPin}</span>{' '}
                          set to <span className="font-semibold">{act.actionState ? 'ON (HIGH)' : 'OFF (LOW)'}</span>
                        </div>
                        <div className="text-slate-400">
                          Strategy: {formatActionType(act)}
                        </div>
                      </div>

                      <button
                        type="button"
                        aria-label={`Remove ${group} action ${idx + 1}`}
                        onClick={() => handleRemoveAction(group, idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add RuleAction Builder Form */}
      <form
        onSubmit={handleAddAction}
        className="bg-slate-900 border border-slate-800 rounded-xl p-5"
      >
        <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-4">
          <GitBranch className="w-4 h-4 text-sky-400" />
          Append 11-Byte RuleAction to GPIO {activeInputSeg.pin}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
          <div>
            <label htmlFor="rule-branch" className="block text-xs text-slate-300 mb-1.5">
              Input Trigger State
            </label>
            <select
              id="rule-branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value as 'HIGH' | 'LOW')}
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100"
            >
              <option value="HIGH">When Input HIGH</option>
              <option value="LOW">When Input LOW</option>
            </select>
          </div>

          <div>
            <label htmlFor="rule-hold-time" className="block text-xs text-slate-300 mb-1.5">
              Required Hold Time
            </label>
            <select
              id="rule-hold-time"
              value={holdTime}
              onChange={(e) => setHoldTime(Number(e.target.value) as 0 | 3 | 5 | 10)}
              className="w-full px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-800 rounded-lg text-slate-100"
            >
              <option value={0}>0s (Immediate)</option>
              <option value={3}>3 Seconds</option>
              <option value={5}>5 Seconds</option>
              <option value={10}>10 Seconds</option>
            </select>
          </div>

          <div>
            <label htmlFor="rule-target-pin" className="block text-xs text-slate-300 mb-1.5">
              Target Output GPIO
            </label>
            <select
              id="rule-target-pin"
              value={targetPin}
              onChange={(e) => setTargetPin(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-800 rounded-lg text-slate-100"
            >
              {outputSegments.map((out) => (
                <option key={out.id} value={out.pin}>
                  GPIO {out.pin} ({out.id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="rule-target-state" className="block text-xs text-slate-300 mb-1.5">
              Target Pin State
            </label>
            <select
              id="rule-target-state"
              value={actionState ? '1' : '0'}
              onChange={(e) => setActionState(e.target.value === '1')}
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100"
            >
              <option value="1">Turn ON (0x01)</option>
              <option value="0">Turn OFF (0x00)</option>
            </select>
          </div>

          <div>
            <label htmlFor="rule-action-type" className="block text-xs text-slate-300 mb-1.5">
              Action Strategy
            </label>
            <select
              id="rule-action-type"
              value={actionType}
              onChange={(e) => setActionType(Number(e.target.value) as RuleActionType)}
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100"
            >
              <option value={RuleActionType.ACTION_IMMEDIATE}>Immediate (0)</option>
              <option value={RuleActionType.ACTION_AFTER_DELAY}>After Delay (1)</option>
              <option value={RuleActionType.ACTION_FOR_DURATION}>For Duration (2)</option>
            </select>
          </div>

          <div>
            <button
              type="submit"
              className="w-full px-4 py-2 text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Append RuleAction
            </button>
          </div>
        </div>

        {actionType !== RuleActionType.ACTION_IMMEDIATE && (
          <div className="mt-4 max-w-xs">
            <label htmlFor="rule-delay-sec" className="block text-xs text-slate-300 mb-1">
              Timer Delay / Duration (0–60s)
            </label>
            <input
              id="rule-delay-sec"
              type="number"
              min={0}
              max={60}
              value={delaySec}
              onChange={(e) => setDelaySec(Number(e.target.value))}
              className="w-full px-3 py-1.5 text-xs font-mono bg-slate-950 border border-slate-800 rounded-lg text-slate-100"
            />
          </div>
        )}

        {statusMsg && (
          <p className="mt-3 text-xs text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {statusMsg}
          </p>
        )}
      </form>
    </div>
  );
};
