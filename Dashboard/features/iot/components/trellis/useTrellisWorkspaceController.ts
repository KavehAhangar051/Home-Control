import type { WorkspaceHandle } from "@danfessler/trellis-react";
import React from "react";
import type { Segment } from "@/features/iot/hooks/store/types";
import {
  buildGroupDockDocument,
  buildSegmentFractalDocument,
  getTrellisPresetStorageKey,
  getTrellisStorageKey,
  groupViewId,
  segmentViewId,
  type TrellisLayoutPreset,
} from "./trellisLayout";

export const TRELLIS_TOKENS = {
  "--trellis-bg": "var(--bg-main)",
  "--trellis-stage": "var(--bg-main)",
  "--trellis-panel": "var(--card-bg-solid)",
  "--trellis-tabbar": "var(--sidebar-bg)",
  "--trellis-tab-active": "var(--card-bg-solid)",
  "--trellis-tab-hover": "var(--card-hover-bg)",
  "--trellis-text": "var(--text-primary)",
  "--trellis-text-muted": "var(--text-muted)",
  "--trellis-border": "var(--border-color)",
  "--trellis-accent": "var(--accent3)",
  "--trellis-accent-contrast": "var(--accent3-foreground)",
  "--trellis-menu": "var(--card-bg-solid)",
  "--trellis-menu-hover": "var(--card-hover-bg)",
  "--trellis-font": "var(--selected-font, var(--font-dana), system-ui, -apple-system, sans-serif)",
  "--trellis-font-size": "12.5px",
  "--trellis-radius": "14px",
  "--trellis-tab-radius": "9px",
  "--trellis-tabbar-height": "36px",
  "--trellis-gap": "8px",
} as const;

const subscribePreset = () => () => {};
const getServerPreset = (): TrellisLayoutPreset => "groups";

function getStoredPreset(): TrellisLayoutPreset {
  try {
    const saved = window.localStorage.getItem(getTrellisPresetStorageKey());

    if (saved === "segments" || saved === "groups") {
      return saved;
    }
  } catch {
    // Ignore storage read failures in restricted contexts
  }

  return "groups";
}

function getAllWorkspaceViewIds(ws: WorkspaceHandle): Set<string> {
  const snapshot = ws.getSnapshot();
  const ids = new Set<string>();

  for (const view of snapshot.views) {
    ids.add(view.id);
  }

  for (const hiddenPanel of snapshot.hidden) {
    for (const view of hiddenPanel.views) {
      ids.add(view.id);
    }
  }

  return ids;
}

function syncGroupPresetViews(
  ws: WorkspaceHandle,
  existingIds: Set<string>,
  groupsOrder: string[],
  segments: Segment[],
) {
  const groupSet = new Set(groupsOrder);
  const segmentSet = new Set(segments.map((item) => item.id));

  for (const groupName of groupsOrder) {
    const viewId = groupViewId(groupName);

    if (!existingIds.has(viewId)) {
      ws.open("group", {
        id: viewId,
        params: { groupName },
        title: groupName,
        placement: "stage",
        focus: false,
      });
    }
  }

  for (const view of ws.views({ type: "group" })) {
    const groupName = String(view.params.groupName || "");

    if (!groupSet.has(groupName)) {
      void ws.close(view.id, { force: true });
    }
  }

  for (const view of ws.views({ type: "segment" })) {
    const segId = String(view.params.segmentId || "");

    if (!segmentSet.has(segId)) {
      void ws.close(view.id, { force: true });
    }
  }
}

function syncSegmentPresetViews(
  ws: WorkspaceHandle,
  existingIds: Set<string>,
  segments: Segment[],
) {
  const segmentById = new Map(segments.map((item) => [item.id, item]));

  for (const seg of segments) {
    const viewId = segmentViewId(seg.id);

    if (!existingIds.has(viewId)) {
      ws.open("segment", {
        id: viewId,
        params: { segmentId: seg.id },
        title: seg.type === "placeholder" ? `جایگاه خالی (${seg.group || "Test"})` : seg.title,
        placement: "stage",
        focus: false,
      });
    }
  }

  for (const view of ws.views({ type: "segment" })) {
    const segId = String(view.params.segmentId || "");

    if (!segmentById.has(segId)) {
      void ws.close(view.id, { force: true });
    }
  }
}

interface UseTrellisWorkspaceControllerProps {
  groupsOrder: string[];
  segments: Segment[];
  selectedGroupFilter: string | null;
}

export function useTrellisWorkspaceController({
  groupsOrder,
  segments,
  selectedGroupFilter,
}: UseTrellisWorkspaceControllerProps) {
  const wsRef = React.useRef<WorkspaceHandle | null>(null);

  const storedPreset = React.useSyncExternalStore(
    subscribePreset,
    getStoredPreset,
    getServerPreset,
  );

  const [presetOverride, setPresetOverride] = React.useState<TrellisLayoutPreset | null>(null);
  const preset = presetOverride ?? storedPreset;
  const [workspaceMounted, setWorkspaceMounted] = React.useState(false);

  const handleWorkspaceRef = React.useCallback((instance: WorkspaceHandle | null) => {
    wsRef.current = instance;
    setWorkspaceMounted(Boolean(instance));
  }, []);

  const handleChangePreset = React.useCallback((nextPreset: TrellisLayoutPreset) => {
    setWorkspaceMounted(false);
    setPresetOverride(nextPreset);

    try {
      window.localStorage.setItem(getTrellisPresetStorageKey(), nextPreset);
    } catch {
      // Ignore storage write failures in restricted contexts
    }
  }, []);

  const defaultLayout = React.useMemo(() => {
    if (preset === "segments") {
      return buildSegmentFractalDocument(groupsOrder, segments);
    }

    return buildGroupDockDocument(groupsOrder);
  }, [preset, groupsOrder, segments]);

  React.useEffect(() => {
    const ws = wsRef.current;

    if (!ws || !workspaceMounted) return;

    const existingIds = getAllWorkspaceViewIds(ws);

    if (preset === "groups") {
      syncGroupPresetViews(ws, existingIds, groupsOrder, segments);

      return;
    }

    syncSegmentPresetViews(ws, existingIds, segments);
  }, [groupsOrder, segments, preset, workspaceMounted]);

  React.useEffect(() => {
    const ws = wsRef.current;

    if (!ws || !workspaceMounted) return;

    if (!selectedGroupFilter) {
      if (ws.navigation.framed) {
        ws.navigation.overview();
      }

      return;
    }

    if (preset === "groups") {
      const groupView = ws.view(groupViewId(selectedGroupFilter));

      if (groupView) {
        ws.navigation.frame(groupView.panelId);
      }

      return;
    }

    const targetPanelIds: string[] = [];

    for (const seg of segments) {
      if ((seg.group || "Test") === selectedGroupFilter) {
        const segView = ws.view(segmentViewId(seg.id));

        if (segView) {
          targetPanelIds.push(segView.panelId);
        }
      }
    }

    if (targetPanelIds.length > 0) {
      ws.navigation.frame(targetPanelIds);
    }
  }, [selectedGroupFilter, preset, segments, workspaceMounted]);

  const handleResetLayout = React.useCallback(() => {
    const ws = wsRef.current;

    if (!ws) return;

    try {
      window.localStorage.removeItem(getTrellisStorageKey(preset));
    } catch {
      // Ignore storage remove failures
    }

    const freshDoc =
      preset === "segments"
        ? buildSegmentFractalDocument(groupsOrder, segments)
        : buildGroupDockDocument(groupsOrder);

    ws.setDocument(freshDoc, { animate: true });
  }, [preset, groupsOrder, segments]);

  const segmentTitleLookup = React.useCallback(
    (segmentId: string) => {
      const found = segments.find((item) => item.id === segmentId);

      if (!found) return "قطعه";

      return found.type === "placeholder" ? `جایگاه خالی (${found.group || "Test"})` : found.title;
    },
    [segments],
  );

  return {
    preset,
    defaultLayout,
    handleWorkspaceRef,
    handleChangePreset,
    handleResetLayout,
    segmentTitleLookup,
  };
}
