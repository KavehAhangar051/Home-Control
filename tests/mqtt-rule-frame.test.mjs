import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildUpdateRuleFrame } from "../features/iot/services/mqtt/segmentPublishers.ts";

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
