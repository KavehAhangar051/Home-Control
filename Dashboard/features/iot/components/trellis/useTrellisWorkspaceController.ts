import type { LayoutDocument, WorkspaceHandle } from "@danfessler/trellis-react";
import React from "react";
import type { Segment } from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { usePreferencesStore } from "@/features/iot/hooks/usePreferencesStore";
import { scheduleIdleStorageWrite } from "@/lib/asyncScheduler";
import { triggerHaptic } from "@/lib/haptics";
import {
  buildGroupDockDocument,
  buildSegmentFractalDocument,
  buildWallPanelDocument,
  getTrellisPresetStorageKey,
  getTrellisStorageKey,
  groupViewId,
  isTrellisLayoutPreset,
  sanitizeTrellisDocument,
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

    if (isTrellisLayoutPreset(saved)) {
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
  const segmentSet = new Set<string>();

  for (let i = 0; i < segments.length; i++) {
    segmentSet.add(segments[i].id);
  }

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

function formatTrellisSegmentTitle(segment: Segment): string {
  return segment.type === "placeholder"
    ? `جایگاه خالی (${segment.group || "Test"})`
    : segment.title;
}

function buildTrellisPresetDocument(
  preset: TrellisLayoutPreset,
  groupsOrder: string[],
  segments: Segment[],
) {
  if (preset === "segments") {
    return buildSegmentFractalDocument(groupsOrder, segments);
  }

  if (preset === "wall-panel") {
    return buildWallPanelDocument(groupsOrder, segments);
  }

  return buildGroupDockDocument(groupsOrder);
}

function syncSegmentPresetViews(
  ws: WorkspaceHandle,
  existingIds: Set<string>,
  segments: Segment[],
) {
  const segmentIds = new Set<string>();

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    segmentIds.add(seg.id);
    const viewId = segmentViewId(seg.id);

    if (!existingIds.has(viewId)) {
      ws.open("segment", {
        id: viewId,
        params: { segmentId: seg.id },
        title: formatTrellisSegmentTitle(seg),
        placement: "stage",
        focus: false,
      });
    }
  }

  for (const view of ws.views({ type: "segment" })) {
    const segId = String(view.params.segmentId || "");

    if (!segmentIds.has(segId)) {
      void ws.close(view.id, { force: true });
    }
  }
}

function frameWorkspaceByGroupFilter(
  ws: WorkspaceHandle,
  preset: TrellisLayoutPreset,
  segments: Segment[],
  selectedGroupFilter: string | null,
) {
  if (!selectedGroupFilter) {
    if (ws.navigation.framed) {
      ws.navigation.overview();
    }

    return;
  }

  if (preset !== "segments") {
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
  const pendingDocumentRef = React.useRef<LayoutDocument | null>(null);

  const savedLayouts = usePreferencesStore((s) => s.savedTrellisLayouts);
  const saveTrellisLayout = usePreferencesStore((s) => s.saveTrellisLayout);
  const deleteTrellisLayout = usePreferencesStore((s) => s.deleteTrellisLayout);
  const showToast = useIoTStore((s) => s.showToast);

  const storedPreset = React.useSyncExternalStore(
    subscribePreset,
    getStoredPreset,
    getServerPreset,
  );

  const [presetOverride, setPresetOverride] = React.useState<TrellisLayoutPreset | null>(null);
  const preset = presetOverride ?? storedPreset;
  const [workspaceMounted, setWorkspaceMounted] = React.useState(false);
  const [activeSavedLayoutId, setActiveSavedLayoutId] = React.useState<string | null>(null);

  const handleWorkspaceRef = React.useCallback((instance: WorkspaceHandle | null) => {
    wsRef.current = instance;
    setWorkspaceMounted(Boolean(instance));
  }, []);

  const handleChangePreset = React.useCallback((nextPreset: TrellisLayoutPreset) => {
    triggerHaptic("tap");
    setActiveSavedLayoutId(null);
    pendingDocumentRef.current = null;
    setWorkspaceMounted(false);
    setPresetOverride(nextPreset);

    scheduleIdleStorageWrite(getTrellisPresetStorageKey(), () => nextPreset);
  }, []);

  const defaultLayout = React.useMemo(
    () => buildTrellisPresetDocument(preset, groupsOrder, segments),
    [preset, groupsOrder, segments],
  );

  React.useEffect(() => {
    const ws = wsRef.current;

    if (!ws || !workspaceMounted) return;

    if (pendingDocumentRef.current) {
      const docToApply = sanitizeTrellisDocument(pendingDocumentRef.current);
      pendingDocumentRef.current = null;
      ws.setDocument(docToApply, { animate: true });
    }

    const existingIds = getAllWorkspaceViewIds(ws);

    if (preset !== "segments") {
      syncGroupPresetViews(ws, existingIds, groupsOrder, segments);

      return;
    }

    syncSegmentPresetViews(ws, existingIds, segments);
  }, [groupsOrder, segments, preset, workspaceMounted]);

  React.useEffect(() => {
    const ws = wsRef.current;

    if (!ws || !workspaceMounted) return;

    frameWorkspaceByGroupFilter(ws, preset, segments, selectedGroupFilter);
  }, [selectedGroupFilter, preset, segments, workspaceMounted]);

  const handleResetLayout = React.useCallback(() => {
    const ws = wsRef.current;

    if (!ws) return;

    triggerHaptic("tap");
    setActiveSavedLayoutId(null);

    try {
      window.localStorage.removeItem(getTrellisStorageKey(preset));
    } catch {
      // Ignore storage remove failures
    }

    const freshDoc = buildTrellisPresetDocument(preset, groupsOrder, segments);
    ws.setDocument(freshDoc, { animate: true });
  }, [preset, groupsOrder, segments]);

  const handleSaveCurrentLayout = React.useCallback(
    (name: string) => {
      const ws = wsRef.current;

      if (!ws) return;

      const snapshot = sanitizeTrellisDocument(ws.getDocument());
      const saved = saveTrellisLayout({
        name,
        preset,
        document: snapshot,
      });

      setActiveSavedLayoutId(saved.id);
      triggerHaptic("success");
      showToast(`چیدمان «${saved.name}» ذخیره شد`, "success");
    },
    [preset, saveTrellisLayout, showToast],
  );

  const handleApplySavedLayout = React.useCallback(
    (id: string) => {
      const found = savedLayouts.find((item) => item.id === id);

      if (!found) return;

      triggerHaptic("tap");
      setActiveSavedLayoutId(found.id);
      const sanitized = sanitizeTrellisDocument(found.document);

      if (found.preset !== preset) {
        pendingDocumentRef.current = sanitized;
        setWorkspaceMounted(false);
        setPresetOverride(found.preset);

        try {
          window.localStorage.setItem(getTrellisPresetStorageKey(), found.preset);
        } catch {
          // Ignore storage write failures
        }
      } else if (wsRef.current) {
        wsRef.current.setDocument(sanitized, { animate: true });
      }

      showToast(`چیدمان «${found.name}» اعمال شد`, "success");
    },
    [preset, savedLayouts, showToast],
  );

  const handleDeleteSavedLayout = React.useCallback(
    (id: string) => {
      triggerHaptic("tap");
      deleteTrellisLayout(id);
      setActiveSavedLayoutId((current) => (current === id ? null : current));
    },
    [deleteTrellisLayout],
  );

  const segmentById = React.useMemo(() => {
    const map = new Map<string, Segment>();

    for (let i = 0; i < segments.length; i++) {
      const item = segments[i];
      map.set(item.id, item);
    }

    return map;
  }, [segments]);

  const segmentTitleLookup = React.useCallback(
    (segmentId: string) => {
      const found = segmentById.get(segmentId);

      return found ? formatTrellisSegmentTitle(found) : "قطعه";
    },
    [segmentById],
  );

  return {
    preset,
    defaultLayout,
    savedLayouts,
    activeSavedLayoutId,
    handleWorkspaceRef,
    handleChangePreset,
    handleResetLayout,
    handleSaveCurrentLayout,
    handleApplySavedLayout,
    handleDeleteSavedLayout,
    segmentTitleLookup,
  };
}
