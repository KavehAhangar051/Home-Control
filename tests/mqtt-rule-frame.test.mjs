import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  validateAnalogRangeRuleList,
  validateRuleActionList,
} from "../features/iot/hooks/achaemenidState/core/segmentOperations.ts";
import {
  buildAddSegmentFrame,
  buildReadAnalogInputFrame,
  buildUpdateAnalogInputConfigFrame,
  buildUpdateRuleAnalogFrame,
  buildUpdateRuleFrame,
  encodeUpdateAnalogRangeRulesFrame,
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
      2, 3, 0, 0, 0, 1, 0, 0, 0, 0, 0,
      0,
    ]);
  });

  it("encodes double-click reqHold = -1 as int32 LE 0xFF 0xFF 0xFF 0xFF in 0x05 and 0x0B frames", () => {
    const frame05 = buildUpdateRuleFrame(
      4,
      [{ reqHold: -1, targetPin: "12", actionOn: true, actionType: 0, delay: 0 }],
      [],
    );

    assert.deepEqual(Array.from(frame05), [
      0x05,
      4,
      1,
      12,
      0xff,
      0xff,
      0xff,
      0xff,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
    ]);

    const frame0B = buildUpdateRuleAnalogFrame(
      4,
      [{ reqHold: -1, targetPin: "18", actionOn: true, actionType: 2, delay: 5, targetValue: 180 }],
      [],
    );

    assert.deepEqual(Array.from(frame0B), [
      0x0b,
      4,
      1,
      18,
      0xff,
      0xff,
      0xff,
      0xff,
      1,
      2,
      5,
      0,
      0,
      0,
      180,
      0,
      0,
    ]);
  });

  it("rejects invalid input GPIO values", () => {
    assert.doesNotThrow(() => buildUpdateRuleFrame(40));
    assert.doesNotThrow(() => buildUpdateRuleFrame(127));
    assert.throws(() => buildUpdateRuleFrame(-1), RangeError);
    assert.throws(() => buildUpdateRuleFrame(128), RangeError);
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

describe("Rule Engine V2 binary frame (0x0E) and validators", () => {
  it("encodes 3-byte clear-all 0x0E frame when no enabled analog ranges remain", () => {
    assert.deepEqual(Array.from(encodeUpdateAnalogRangeRulesFrame(34, [])), [0x0e, 34, 0x00]);
    assert.deepEqual(
      Array.from(
        encodeUpdateAnalogRangeRulesFrame(34, [
          {
            minValue: 100,
            maxValue: 500,
            hysteresis: 20,
            triggerMode: 0,
            targetPin: "2",
            actionState: true,
            enabled: false,
          },
        ]),
      ),
      [0x0e, 34, 0x00],
    );
  });

  it("encodes 3 multi-range rules into 39-byte 0x0E Little-Endian frame and caps at 6", () => {
    const frame = encodeUpdateAnalogRangeRulesFrame(34, [
      {
        // min=0, max=1000, hyst=30, targetPin=2, enter(0), actionState=true, actionType=0, delay=0, boolean(-1)
        minValue: 0,
        maxValue: 1000,
        hysteresis: 30,
        triggerMode: 0,
        targetPin: "2",
        actionState: true,
        targetValue: -1,
        actionType: 0,
        delay: 0,
        enabled: true,
      },
      {
        // swapped min/max -> 1500..2500, hyst=40, targetPin=18, exit(1), PWM=200 (actionState=1), actionType=1, delay=5
        minValue: 2500,
        maxValue: 1500,
        hysteresis: 40,
        triggerMode: 1,
        targetPin: 18,
        actionState: false, // overridden to true because targetValue=200 > 0
        targetValue: 200,
        actionType: 1,
        delay: 5,
        enabled: true,
      },
      {
        minValue: 3000,
        maxValue: 4095,
        hysteresis: 50,
        triggerMode: 0,
        targetPin: "4",
        actionState: false,
        actionType: 2,
        delay: 10,
        enabled: false, // skipped
      },
      {
        // enter(0), targetPin=5, actionState=false, actionType=2, delay=12, boolean(-1)
        minValue: 3100,
        maxValue: 4000,
        hysteresis: 25,
        triggerMode: 0,
        targetPin: "5",
        actionState: false,
        actionType: 2,
        delay: 12,
        enabled: true,
      },
    ]);

    assert.equal(frame.length, 3 + 3 * 12);
    assert.deepEqual(Array.from(frame.slice(0, 3)), [0x0e, 34, 3]);

    // Record 0: 0..1000, hyst=30, pin=2, flags=0x01 (state=1 | type=0 | trig=0), delay=0, targetValue=-1 (0xFFFF), resv=0
    assert.deepEqual(Array.from(frame.slice(3, 15)), [
      0x00, 0x00, 0xe8, 0x03, 0x1e, 0x00, 2, 0x01, 0, 0xff, 0xff, 0,
    ]);

    // Record 1: 1500..2500, hyst=40, pin=18, flags = 1 | (1 << 1) | (1 << 3) = 0x0b, delay=5, targetValue=200, resv=0
    assert.deepEqual(Array.from(frame.slice(15, 27)), [
      0xdc, 0x05, 0xc4, 0x09, 0x28, 0x00, 18, 0x0b, 5, 200, 0x00, 0,
    ]);

    // Record 2: 3100..4000, hyst=25, pin=5, flags = 0 | (2 << 1) | (0 << 3) = 0x04, delay=12, targetValue=-1, resv=0
    assert.deepEqual(Array.from(frame.slice(27, 39)), [
      0x1c, 0x0c, 0xa0, 0x0f, 0x19, 0x00, 5, 0x04, 12, 0xff, 0xff, 0,
    ]);

    const sevenRanges = Array.from({ length: 7 }, (_, i) => ({
      minValue: i * 100,
      maxValue: i * 100 + 50,
      hysteresis: 5,
      triggerMode: 0,
      targetPin: "2",
      actionState: true,
    }));
    const capped = encodeUpdateAnalogRangeRulesFrame(34, sevenRanges);
    assert.equal(capped[2], 6);
    assert.equal(capped.length, 3 + 6 * 12);
  });

  it("validates digital double-click (-1) and rejects invalid holds or input targets", () => {
    const segments = [
      { id: "in1", pin: "4", title: "دکمه", type: "input", group: "تست" },
      { id: "out1", pin: "2", title: "لامپ", type: "relay", group: "تست" },
    ];

    assert.equal(
      validateRuleActionList([{ targetPin: "2", reqHold: -1, actionType: 0, delay: 0 }], segments),
      null,
    );
    assert.notEqual(
      validateRuleActionList([{ targetPin: "2", reqHold: 2, actionType: 0, delay: 0 }], segments),
      null,
    );
    assert.notEqual(
      validateRuleActionList([{ targetPin: "4", reqHold: -1, actionType: 0, delay: 0 }], segments),
      null,
    );
  });

  it("validates analogRanges resolution bounds, hysteresis, self-target, delay, and PWM duty", () => {
    const segments = [
      { id: "adc1", pin: "34", title: "نور", type: "analog_input", adcResolution: 10, group: "تست" },
      { id: "rel1", pin: "2", title: "رله", type: "relay", group: "تست" },
      { id: "pwm1", pin: "18", title: "دیمر", type: "analog_output", pwmResolution: 8, group: "تست" },
    ];

    assert.equal(
      validateAnalogRangeRuleList(
        [
          {
            minValue: 100,
            maxValue: 900,
            hysteresis: 30,
            triggerMode: 0,
            targetPin: "18",
            actionState: true,
            targetValue: 200,
            actionType: 1,
            delay: 5,
            enabled: true,
          },
        ],
        "34",
        10,
        segments,
      ),
      null,
    );

    // Exceeds 10-bit max (1023)
    assert.notEqual(
      validateAnalogRangeRuleList(
        [
          {
            minValue: 100,
            maxValue: 2000,
            hysteresis: 10,
            triggerMode: 0,
            targetPin: "2",
            actionState: true,
            targetValue: -1,
            actionType: 0,
            delay: 0,
            enabled: true,
          },
        ],
        "34",
        10,
        segments,
      ),
      null,
    );

    // Exceeds max hysteresis (floor(1023/2) = 511)
    assert.notEqual(
      validateAnalogRangeRuleList(
        [
          {
            minValue: 100,
            maxValue: 500,
            hysteresis: 512,
            triggerMode: 0,
            targetPin: "2",
            actionState: true,
            targetValue: -1,
            actionType: 0,
            delay: 0,
            enabled: true,
          },
        ],
        "34",
        10,
        segments,
      ),
      null,
    );

    // Self-target blocked
    assert.notEqual(
      validateAnalogRangeRuleList(
        [
          {
            minValue: 100,
            maxValue: 500,
            hysteresis: 10,
            triggerMode: 0,
            targetPin: "34",
            actionState: true,
            targetValue: -1,
            actionType: 0,
            delay: 0,
            enabled: true,
          },
        ],
        "34",
        10,
        segments,
      ),
      null,
    );

    // Delay < 1 when actionType > 0 blocked
    assert.notEqual(
      validateAnalogRangeRuleList(
        [
          {
            minValue: 100,
            maxValue: 500,
            hysteresis: 10,
            triggerMode: 0,
            targetPin: "2",
            actionState: true,
            targetValue: -1,
            actionType: 1,
            delay: 0,
            enabled: true,
          },
        ],
        "34",
        10,
        segments,
      ),
      null,
    );

    // PWM duty > target 8-bit max (255) blocked
    assert.notEqual(
      validateAnalogRangeRuleList(
        [
          {
            minValue: 100,
            maxValue: 500,
            hysteresis: 10,
            triggerMode: 0,
            targetPin: "18",
            actionState: true,
            targetValue: 300,
            actionType: 0,
            delay: 0,
            enabled: true,
          },
        ],
        "34",
        10,
        segments,
      ),
      null,
    );
  });
});

