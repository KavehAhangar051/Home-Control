import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { executeCloudflareInitSync } from "../features/iot/hooks/achaemenidState/core/cloudflareSyncCoordinator.ts";

function makeConfig(title, segmentTitle = "لامپ") {
  return {
    version: "1.2.0",
    device: {
      name: "ESP32",
      chip: "ESP32-S3",
      firmware: "1",
      reboot_count: 0,
      last_boot: "",
    },
    preferences: {
      theme_mode: "dark",
      accent_color_3: "#fff",
      accent_color_4: "#000",
      font_family: "dana",
      animations_enabled: true,
      header_title: title,
    },
    layout: { groups_order: ["پذیرایی"], groups_cols: 1, group_configs: {} },
    segments: [{ id: "seg_1", type: "relay", pin: "2", title: segmentTitle, group: "پذیرایی" }],
  };
}

describe("Cloudflare SWR Init Sync", () => {
  it("hydrates valid cache synchronously before remote settles and applies differing remote update", async () => {
    const cached = makeConfig("کش قبلی", "چراغ کش");
    const remote = makeConfig("ابری جدید", "چراغ ابری");
    const applied = [];
    const syncStatuses = [];
    let readyCount = 0;
    let epochCount = 0;
    let writtenCache = null;

    let resolveFetch;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    const syncPromise = executeCloudflareInitSync({
      maxAttempts: 1,
      configLocalCacheEnabled: true,
      isCloudflareEnabled: () => true,
      isOnline: () => true,
      isBypassed: () => false,
      fetchConfig: () => fetchPromise,
      readLocalCache: () => cached,
      writeLocalCache: (cfg) => {
        writtenCache = cfg;
      },
      clearLocalCache: () => {},
      applyConfig: (cfg) => applied.push(cfg),
      onWorkerUrlChange: () => {},
      onResetEmptyState: () => {
        throw new Error("should not reset when cache exists");
      },
      onSyncStatus: (loading, progress, msg) => syncStatuses.push({ loading, progress, msg }),
      onBumpRemoteEpoch: () => {
        epochCount += 1;
      },
      onReady: () => {
        readyCount += 1;
      },
      sleep: async () => {},
    });

    // Before remote resolves, UI is already marked ready with cached config!
    assert.equal(readyCount, 1);
    assert.equal(epochCount, 1);
    assert.equal(applied.length, 1);
    assert.equal(applied[0].preferences.header_title, "کش قبلی");
    assert.equal(syncStatuses[0].loading, false);

    resolveFetch(remote);
    const outcome = await syncPromise;

    assert.deepEqual(outcome, { kind: "remote_applied", attempts: 1 });
    assert.equal(readyCount, 1);
    assert.equal(epochCount, 2);
    assert.equal(applied.length, 2);
    assert.equal(applied[1].preferences.header_title, "ابری جدید");
    assert.equal(writtenCache.preferences.header_title, "ابری جدید");
  });

  it("skips redundant re-apply and epoch bump when background remote matches cached config", async () => {
    const cached = makeConfig("مشابه");
    const remote = makeConfig("مشابه");
    let applyCount = 0;
    let epochCount = 0;

    const outcome = await executeCloudflareInitSync({
      maxAttempts: 1,
      configLocalCacheEnabled: true,
      isCloudflareEnabled: () => true,
      isOnline: () => true,
      isBypassed: () => false,
      fetchConfig: async () => remote,
      readLocalCache: () => cached,
      writeLocalCache: () => {},
      clearLocalCache: () => {},
      applyConfig: () => {
        applyCount += 1;
      },
      onWorkerUrlChange: () => {},
      onResetEmptyState: () => {},
      onSyncStatus: () => {},
      onBumpRemoteEpoch: () => {
        epochCount += 1;
      },
      onReady: () => {},
      sleep: async () => {},
    });

    assert.deepEqual(outcome, { kind: "remote_applied", attempts: 1 });
    assert.equal(applyCount, 1);
    assert.equal(epochCount, 1);
  });

  it("preserves cached config instead of resetting empty if background fetch fails", async () => {
    const cached = makeConfig("آفلاین");
    let resetCalled = 0;
    let readyCount = 0;

    const outcome = await executeCloudflareInitSync({
      maxAttempts: 2,
      configLocalCacheEnabled: true,
      isCloudflareEnabled: () => true,
      isOnline: () => true,
      isBypassed: () => false,
      fetchConfig: async () => {
        throw new Error("network timeout");
      },
      readLocalCache: () => cached,
      writeLocalCache: () => {},
      clearLocalCache: () => {},
      applyConfig: () => {},
      onWorkerUrlChange: () => {},
      onResetEmptyState: () => {
        resetCalled += 1;
      },
      onSyncStatus: () => {},
      onBumpRemoteEpoch: () => {},
      onReady: () => {
        readyCount += 1;
      },
      sleep: async () => {},
    });

    assert.deepEqual(outcome, { kind: "cache_recovered" });
    assert.equal(resetCalled, 0);
    assert.equal(readyCount, 1);
  });
});
