import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CANVAS_MAX_ZOOM,
  CANVAS_MIN_ZOOM,
  computeFocalZoomViewport,
} from "../features/iot/components/canvas/canvasGeometry.ts";
import {
  evaluateHardwareBaseline,
  FrameDropMonitor,
  resolveEffectivePerformanceTier,
} from "../lib/performanceTier.ts";

describe("Adaptive Performance Tier Contracts", () => {
  it("evaluates static hardware and data-saver hints conservatively", () => {
    assert.equal(evaluateHardwareBaseline({ saveData: true }), "lite");
    assert.equal(evaluateHardwareBaseline({ prefersReducedData: true }), "lite");
    assert.equal(evaluateHardwareBaseline({ deviceMemory: 2, hardwareConcurrency: 8 }), "lite");
    assert.equal(evaluateHardwareBaseline({ deviceMemory: 8, hardwareConcurrency: 2 }), "lite");

    assert.equal(evaluateHardwareBaseline({ deviceMemory: 4, hardwareConcurrency: 4 }), "full");
    assert.equal(evaluateHardwareBaseline({}), "full");
    assert.equal(
      evaluateHardwareBaseline({ deviceMemory: 0, hardwareConcurrency: Number.NaN }),
      "full",
    );
  });

  it("ignores background pauses and downgrades only on sustained dropped frames", () => {
    const monitor = new FrameDropMonitor();
    assert.equal(monitor.getTier(), "full");

    // Background tab wakeups or invalid deltas should not cause downgrades
    assert.equal(monitor.recordFrame(600), "full");
    assert.equal(monitor.recordFrame(0), "full");
    assert.equal(monitor.recordFrame(-16), "full");
    assert.equal(monitor.recordFrame(Number.NaN), "full");

    // Transient 5 slow frames (< 6 threshold) remain full
    for (let i = 0; i < 5; i += 1) {
      assert.equal(monitor.recordFrame(34), "full");
    }

    // 6th slow frame in the 16-frame sliding window triggers lite tier
    assert.equal(monitor.recordFrame(34), "lite");

    // Interrupted smooth streak must not recover prematurely
    for (let i = 0; i < 60; i += 1) {
      assert.equal(monitor.recordFrame(16), "lite");
    }
    assert.equal(monitor.recordFrame(24), "lite");

    // 89 consecutive smooth frames are still lite; 90th restores full fidelity
    for (let i = 0; i < 89; i += 1) {
      assert.equal(monitor.recordFrame(16), "lite");
    }
    assert.equal(monitor.recordFrame(16), "full");

    monitor.reset("lite");
    assert.equal(monitor.getTier(), "lite");
    monitor.reset("full");
    assert.equal(monitor.getTier(), "full");
  });

  it("combines animationsFps setting, hardware baseline, and runtime tier", () => {
    assert.equal(
      resolveEffectivePerformanceTier({
        animationsFps: 30,
        hardwareTier: "full",
        runtimeTier: "full",
      }),
      "lite",
    );
    assert.equal(
      resolveEffectivePerformanceTier({
        animationsFps: 60,
        hardwareTier: "lite",
        runtimeTier: "full",
      }),
      "lite",
    );
    assert.equal(
      resolveEffectivePerformanceTier({
        animationsFps: 60,
        hardwareTier: "full",
        runtimeTier: "lite",
      }),
      "lite",
    );
    assert.equal(
      resolveEffectivePerformanceTier({
        animationsFps: 60,
        hardwareTier: "full",
        runtimeTier: "full",
      }),
      "full",
    );
  });
});

describe("Focal Zoom Viewport Geometry Contracts", () => {
  it("preserves exact object reference when zoom is unchanged or clamped at bounds", () => {
    const minViewport = { x: 120, y: -40, zoom: CANVAS_MIN_ZOOM };
    assert.equal(computeFocalZoomViewport(minViewport, 0.1, 300, 200), minViewport);

    const maxViewport = { x: 120, y: -40, zoom: CANVAS_MAX_ZOOM };
    assert.equal(computeFocalZoomViewport(maxViewport, 5.0, 300, 200), maxViewport);
  });

  it("keeps the world coordinate under the cursor pinned during focal zoom", () => {
    const prev = { x: 80, y: 120, zoom: 1 };
    const anchorX = 480;
    const anchorY = 360;
    const worldXBefore = (anchorX - prev.x) / prev.zoom;
    const worldYBefore = (anchorY - prev.y) / prev.zoom;

    const next = computeFocalZoomViewport(prev, 1.5, anchorX, anchorY);
    assert.equal(next.zoom, 1.5);

    const worldXAfter = (anchorX - next.x) / next.zoom;
    const worldYAfter = (anchorY - next.y) / next.zoom;

    assert.ok(Math.abs(worldXAfter - worldXBefore) <= 1);
    assert.ok(Math.abs(worldYAfter - worldYBefore) <= 1);
  });
});
