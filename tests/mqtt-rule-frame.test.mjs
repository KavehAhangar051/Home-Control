import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAddSegmentFrame,
  buildReadAnalogInputFrame,
  buildUpdateAnalogInputConfigFrame,
  buildUpdateRuleFrame,
} from "../features/iot/services/mqtt/segmentPublishers.ts";

describe("MQTT input rule frame", () => {
  it("identifies the input segment by GPIO without a string ID", () => {
    const frame = buildUpdateRuleFrame(5);

    assert.deepEqual(Array.from(frame), [0x05, 5, 0, 0]);
  });

  it("encodes HIGH and LOW actions after the input GPIO", () => {
    const frame = buildUpdateRuleFrame(
      5,
      [{ reqHold: 3, targetPin: "2", actionOn: true, actionType: 0, delay: 0 }],
      [],
    );

    assert.deepEqual(Array.from(frame), [
      0x05, 5, 1,
      2, 3, 0, 0, 0, 1, 0, 0, 0, 0,
      0,
    ]);
  });

  it("rejects invalid input GPIO values", () => {
    assert.throws(() => buildUpdateRuleFrame(40), RangeError);
  });
});

describe("MQTT analog_input (ADC1) binary frames", () => {
  it("encodes extended 0x02 ADD_SEGMENT frame with exact 9-byte Little-Endian ADC tail", () => {
    const frame = buildAddSegmentFrame("seg_ldr", "analog_input", 34, true, undefined, {
      adcResolution: 12,
      adcSampleIntervalMs: 500,
      adcDeltaThreshold: 40,
      adcHighThreshold: 2800,
      adcLowThreshold: 2200,
    });

    const idBytes = Array.from(new TextEncoder().encode("seg_ldr"));
    const typeBytes = Array.from(new TextEncoder().encode("analog_input"));

    assert.deepEqual(Array.from(frame), [
      0x02,
      34,
      0x00,
      ...idBytes,
      0x00,
      ...typeBytes,
      0x00,
      12, // res: uint8
      0xf4,
      0x01, // sint = 500 (u16LE)
      0x28,
      0x00, // delta = 40 (u16LE)
      0xf0,
      0x0a, // ath = 2800 (u16LE)
      0x98,
      0x08, // atl = 2200 (u16LE)
    ]);
  });

  it("clamps ADC options and enforces 0 <= atl <= ath <= maxVal in 0x02 frame", () => {
    const frame = buildAddSegmentFrame("s1", "analog_input", 32, false, undefined, {
      adcResolution: 8,
      adcSampleIntervalMs: 10, // clamped to 50
      adcDeltaThreshold: 999, // clamped to 255
      adcHighThreshold: 0, // disabled -> forces atl = 0
      adcLowThreshold: 120,
    });

    const tail = Array.from(frame.slice(frame.length - 9));
    assert.deepEqual(tail, [
      8, // res
      50,
      0, // sint = 50
      255,
      0, // delta = 255
      0,
      0, // ath = 0
      0,
      0, // atl = 0
    ]);
  });

  it("encodes 0x0C UPDATE_ANALOG_INPUT_CONFIG as 10 bytes without res and 11 bytes with res", () => {
    const frame10 = buildUpdateAnalogInputConfigFrame(34, {
      adcSampleIntervalMs: 1000,
      adcDeltaThreshold: 50,
      adcHighThreshold: 3000,
      adcLowThreshold: 2000,
    });
    assert.equal(frame10.length, 10);
    assert.deepEqual(Array.from(frame10), [
      0x0c,
      34,
      0xe8,
      0x03, // 1000
      0x32,
      0x00, // 50
      0xb8,
      0x0b, // 3000
      0xd0,
      0x07, // 2000
    ]);

    const frame11 = buildUpdateAnalogInputConfigFrame(35, {
      adcResolution: 10,
      adcSampleIntervalMs: 250,
      adcDeltaThreshold: 15,
      adcHighThreshold: 900,
      adcLowThreshold: 700,
    });
    assert.equal(frame11.length, 11);
    assert.deepEqual(Array.from(frame11), [
      0x0c,
      35,
      0xfa,
      0x00, // 250
      0x0f,
      0x00, // 15
      0x84,
      0x03, // 900
      0xbc,
      0x02, // 700
      10, // res = 10-bit
    ]);
  });

  it("encodes 0x0D READ_ANALOG_INPUT as a 2-byte frame", () => {
    assert.deepEqual(Array.from(buildReadAnalogInputFrame(39)), [0x0d, 39]);
  });
});
