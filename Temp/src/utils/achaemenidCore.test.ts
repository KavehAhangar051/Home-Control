import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_SEGMENTS,
  RuleActionType,
  bytesToHex,
  calculateStackTelemetry,
  decodeMqttBinaryFrame,
  encodeAddSegmentFrame,
  encodeDeleteSegmentFrame,
  encodePresenceFrame,
  encodeTogglePinFrame,
  encodeUpdateRuleFrame,
  evaluateInputRuleTransition,
  hexToBytes,
} from './achaemenidCore';

test('INITIAL_SEGMENTS matches the 5 NVS pins from Output-Of-Serial.md', () => {
  assert.equal(INITIAL_SEGMENTS.length, 5);
  assert.deepEqual(
    INITIAL_SEGMENTS.map((s) => ({ id: s.id, pin: s.pin, type: s.type, value: s.value })),
    [
      { id: 'iszmn6e', pin: 2, type: 'output', value: false },
      { id: 'ocpa1hl', pin: 14, type: 'output', value: false },
      { id: '7xhkvz2', pin: 4, type: 'output', value: false },
      { id: '48ef3dw', pin: 5, type: 'input', value: true },
      { id: 'y0stih7', pin: 19, type: 'input', value: true },
    ]
  );
});

test('0x01 TOGGLE_PIN binary encoding and decoding round-trips accurately', () => {
  const frame = encodeTogglePinFrame(14, true, 30);
  assert.equal(frame.length, 7);
  assert.equal(bytesToHex(frame), '01 0E 01 1E 00 00 00');

  const decoded = decodeMqttBinaryFrame(frame);
  assert.equal(decoded.valid, true);
  assert.equal(decoded.eventType, 'TOGGLE_PIN');
  assert.equal(decoded.payloadData?.pin, 14);
  assert.equal(decoded.payloadData?.state, true);
  assert.equal(decoded.payloadData?.timer, 30);
});

test('0x02 ADD_SEGMENT and 0x03 DELETE_SEGMENT binary protocol round-trip', () => {
  const addFrame = encodeAddSegmentFrame(23, 'relay_pump', 'output');
  const decodedAdd = decodeMqttBinaryFrame(addFrame);
  assert.equal(decodedAdd.valid, true);
  assert.equal(decodedAdd.eventType, 'ADD_SEGMENT');
  assert.equal(decodedAdd.payloadData?.pin, 23);
  assert.equal(decodedAdd.payloadData?.id, 'relay_pump');
  assert.equal(decodedAdd.payloadData?.segmentType, 'output');

  const delFrame = encodeDeleteSegmentFrame('relay_pump');
  const decodedDel = decodeMqttBinaryFrame(delFrame);
  assert.equal(decodedDel.valid, true);
  assert.equal(decodedDel.eventType, 'DELETE_SEGMENT');
  assert.equal(decodedDel.payloadData?.id, 'relay_pump');
});

test('0x04 DASHBOARD_PRESENCE and legacy JSON rejection work per MqttCommandDispatcher.cpp', () => {
  const presenceFrame = encodePresenceFrame(true);
  const decodedPresence = decodeMqttBinaryFrame(presenceFrame);
  assert.equal(decodedPresence.valid, true);
  assert.equal(decodedPresence.eventType, 'DASHBOARD_PRESENCE');
  assert.equal(decodedPresence.payloadData?.isOnline, true);

  const legacyJson = new TextEncoder().encode('{"cmd":"toggle","pin":2}');
  const decodedJson = decodeMqttBinaryFrame(legacyJson);
  assert.equal(decodedJson.valid, false);
  assert.equal(decodedJson.commandName, 'LEGACY_JSON_REJECTED');
});

test('0x05 UPDATE_RULE encodes and validates 11-byte action frames accurately', () => {
  const rule = {
    active: true,
    highActions: [
      {
        targetPin: 2,
        requiredHoldTime: 3 as const,
        actionState: true,
        actionType: RuleActionType.ACTION_FOR_DURATION,
        delay: 15,
      },
    ],
    lowActions: [
      {
        targetPin: 2,
        requiredHoldTime: 0 as const,
        actionState: false,
        actionType: RuleActionType.ACTION_IMMEDIATE,
        delay: 0,
      },
    ],
  };

  const frame = encodeUpdateRuleFrame(5, rule);
  // 1 (opcode) + 1 (inputPin) + 1 (highCount) + 11 (highAction) + 1 (lowCount) + 11 (lowAction) = 26 bytes
  assert.equal(frame.length, 26);

  const decoded = decodeMqttBinaryFrame(frame);
  assert.equal(decoded.valid, true);
  assert.equal(decoded.eventType, 'UPDATE_RULE');
  assert.equal(decoded.payloadData?.pin, 5);
  assert.equal(decoded.payloadData?.rule?.highActions.length, 1);
  assert.equal(decoded.payloadData?.rule?.highActions[0].targetPin, 2);
  assert.equal(decoded.payloadData?.rule?.highActions[0].requiredHoldTime, 3);
  assert.equal(decoded.payloadData?.rule?.highActions[0].delay, 15);
  assert.equal(decoded.payloadData?.rule?.lowActions.length, 1);
});

test('RuleEngine hold-time evaluation triggers matching actions based on hold duration', () => {
  const inputSeg = INITIAL_SEGMENTS.find((s) => s.pin === 5)!;
  // Held for 0s -> only 0s action (GPIO 2 ON) should fire
  const effects0s = evaluateInputRuleTransition(5, true, 0, inputSeg.rule);
  assert.equal(effects0s.length, 1);
  assert.equal(effects0s[0].targetPin, 2);
  assert.equal(effects0s[0].newState, true);

  // Held for 3s -> both 0s (GPIO 2 ON) and 3s (GPIO 14 ON for 10s) fire
  const effects3s = evaluateInputRuleTransition(5, true, 3, inputSeg.rule);
  assert.equal(effects3s.length, 2);
  assert.equal(effects3s[1].targetPin, 14);
  assert.equal(effects3s[1].delaySec, 10);
});

test('ESP32 loopTask stack telemetry detects Guru Meditation stack canary crash on legacy 8KB inline config', () => {
  const legacyCrash = calculateStackTelemetry({
    stackSize16KB: false,
    isolatedNvsFrame: false,
    activeSegmentCount: 5,
  });
  assert.equal(legacyCrash.canaryTriggered, true);
  assert.ok(legacyCrash.freeHeadroomBytes < 0);

  const refactoredSafe = calculateStackTelemetry({
    stackSize16KB: true,
    isolatedNvsFrame: true,
    activeSegmentCount: 5,
  });
  assert.equal(refactoredSafe.canaryTriggered, false);
  assert.ok(refactoredSafe.freeHeadroomBytes > 9000);
});

test('hexToBytes parses formatted hex strings and rejects odd-length strings', () => {
  const parsed = hexToBytes('01 02 01 00 00 00 00');
  assert.ok(parsed);
  assert.equal(parsed.length, 7);
  assert.equal(parsed[1], 2);
  assert.equal(hexToBytes('01 0'), null);
});
