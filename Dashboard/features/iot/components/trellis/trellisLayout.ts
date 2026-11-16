import { emptyDocument } from "@danfessler/trellis";
import {
  createDocument,
  layout as L,
  type LayoutDocument,
  type LayoutSpec,
  type MenuEntry,
  type MenuItem,
} from "@danfessler/trellis-react";
import type { Segment } from "@/features/iot/hooks/store/types";

export type TrellisLayoutPreset = "groups" | "segments";

export const TRELLIS_LAYOUT_VERSION = 1;

export function getTrellisStorageKey(preset: TrellisLayoutPreset): string {
  return `iot_trellis_workspace_${preset}_v${TRELLIS_LAYOUT_VERSION}`;
}

export function getTrellisPresetStorageKey(): string {
  return "iot_trellis_preset";
}

export function groupViewId(groupName: string): string {
  return `group:${groupName}`;
}

export function segmentViewId(segmentId: string): string {
  return `segment:${segmentId}`;
}

function buildBalancedFractal(nodes: LayoutSpec[], primaryAxis: "x" | "y" = "x"): LayoutSpec {
  if (nodes.length === 1) {
    return nodes[0];
  }

  if (nodes.length === 2) {
    return primaryAxis === "x"
      ? L.row([nodes[0], nodes[1]], [1, 1])
      : L.column([nodes[0], nodes[1]], [1, 1]);
  }

  if (nodes.length === 3) {
    const sub =
      primaryAxis === "x"
        ? L.column([nodes[1], nodes[2]], [1, 1])
        : L.row([nodes[1], nodes[2]], [1, 1]);

    return primaryAxis === "x"
      ? L.row([nodes[0], sub], [1.1, 1])
      : L.column([nodes[0], sub], [1.1, 1]);
  }

  const midpoint = Math.ceil(nodes.length / 2);
  const firstHalf = buildBalancedFractal(nodes.slice(0, midpoint), primaryAxis === "x" ? "y" : "x");
  const secondHalf = buildBalancedFractal(nodes.slice(midpoint), primaryAxis === "x" ? "y" : "x");

  return primaryAxis === "x"
    ? L.row([firstHalf, secondHalf], [1, 1])
    : L.column([firstHalf, secondHalf], [1, 1]);
}

export function buildGroupDockDocument(groupsOrder: string[]): LayoutDocument {
  if (groupsOrder.length === 0) {
    return emptyDocument();
  }

  const groupViews: LayoutSpec[] = [];

  for (const groupName of groupsOrder) {
    groupViews.push(
      L.view("group", {
        id: groupViewId(groupName),
        params: { groupName },
        title: groupName,
      }),
    );
  }

  const rootTree = buildBalancedFractal(groupViews, "x");

  return createDocument(L.stage(rootTree), { version: TRELLIS_LAYOUT_VERSION });
}

export function buildSegmentFractalDocument(
  groupsOrder: string[],
  segments: Segment[],
): LayoutDocument {
  if (segments.length === 0) {
    return emptyDocument();
  }

  const segmentsByGroup = new Map<string, Segment[]>();

  for (const groupName of groupsOrder) {
    segmentsByGroup.set(groupName, []);
  }

  for (const segment of segments) {
    const groupKey = segment.group || "Test";
    const bucket = segmentsByGroup.get(groupKey);

    if (bucket) {
      bucket.push(segment);
    } else {
      segmentsByGroup.set(groupKey, [segment]);
    }
  }

  const groupTrees: LayoutSpec[] = [];

  for (const [groupName, groupSegments] of segmentsByGroup.entries()) {
    if (groupSegments.length === 0) continue;

    const segmentSpecs: LayoutSpec[] = [];

    for (const seg of groupSegments) {
      segmentSpecs.push(
        L.view("segment", {
          id: segmentViewId(seg.id),
          params: { segmentId: seg.id },
          title: seg.type === "placeholder" ? `جایگاه خالی (${groupName})` : seg.title,
        }),
      );
    }

    const groupTree = buildBalancedFractal(segmentSpecs, "x");

    if (groupTree.kind === "split") {
      groupTrees.push({
        ...groupTree,
        id: `split-group:${groupName}`,
      });
    } else {
      groupTrees.push(groupTree);
    }
  }

  if (groupTrees.length === 0) {
    return emptyDocument();
  }

  const rootTree = buildBalancedFractal(groupTrees, "y");

  return createDocument(L.stage(rootTree), { version: TRELLIS_LAYOUT_VERSION });
}

function getTranslatedBuiltinLabel(id: string | undefined, fallbackLabel: string): string {
  switch (id) {
    case "maximize":
      return "بزرگ‌نمایی / بازگردانی";
    case "float":
      return "شناور کردن پنل";
    case "dock":
      return "چسباندن پنل";
    case "move":
      return "انتقال برگه به";
    case "split-right":
      return "تقسیم جدید در کنار";
    case "split-below":
      return "تقسیم جدید در پایین";
    case "hide":
      return "پنهان کردن پنل";
    case "close":
      return "بستن برگه";
    case "close-others":
      return "بستن سایر برگه‌ها";
    default:
      break;
  }

  switch (fallbackLabel) {
    case "Restore size":
      return "بازگردانی اندازه";
    case "Maximize":
      return "بزرگ‌نمایی";
    case "Dock beside stage":
      return "چسباندن در فضای کار";
    default:
      return fallbackLabel;
  }
}

function translateMenuItem(item: MenuItem): MenuItem {
  return {
    ...item,
    label: getTranslatedBuiltinLabel(item.id, item.label),
    items: item.items ? item.items.map(translateMenuItem) : undefined,
  };
}

export function translateTrellisMenuEntries(entries: MenuEntry[]): MenuEntry[] {
  const result: MenuEntry[] = [];

  for (const entry of entries) {
    if (entry === "separator") {
      result.push(entry);
      continue;
    }

    result.push(translateMenuItem(entry));
  }

  return result;
}
