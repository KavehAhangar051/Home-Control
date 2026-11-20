/**
 * @file components/motion/expandable-tabs-layout.ts
 * @description Pure layout geometry and navigation resolution helpers for ExpandableTabs / MobileDock.
 */

export interface BoxSize {
  width: number;
  height: number;
}

export const EXPANDABLE_TABS_METRICS = {
  barHeight: 52,
  tabWidth: 40,
  barPaddingX: 16,
  barGap: 4,
  rootBorder: 2,
  iconWidth: 18,
  activePaddingStart: 12,
  activePaddingEnd: 14,
  panelDockGap: 6,
  viewportMarginX: 24,
} as const;

/**
 * Computes the closed bar dimensions so the morphing shell hugs the icon buttons
 * plus any optional trailing Dock controls (e.g. separator + voice command button).
 */
export function computeClosedShellSize(itemCount: number, trailingWidth = 0): BoxSize {
  const safeCount = Math.max(1, itemCount);
  const { tabWidth, barGap, barPaddingX, rootBorder, barHeight } = EXPANDABLE_TABS_METRICS;
  const tabsWidth = safeCount * tabWidth + Math.max(0, safeCount - 1) * barGap;
  const trailingSection = trailingWidth > 0 ? trailingWidth + barGap : 0;

  return {
    width: tabsWidth + trailingSection + barPaddingX + rootBorder,
    height: barHeight + rootBorder,
  };
}

/**
 * Computes the expanded pill width for an active tab given its measured label width.
 * Label gap is included inside the measured span (`ps-1.5`) so RTL and LTR match identically.
 */
export function computeActiveTabWidth(measuredLabelWidth: number): number {
  const { tabWidth, activePaddingStart, iconWidth, activePaddingEnd } = EXPANDABLE_TABS_METRICS;
  const safeLabelWidth = Math.max(0, Math.ceil(measuredLabelWidth));

  if (safeLabelWidth === 0) {
    return tabWidth;
  }

  return Math.max(tabWidth, activePaddingStart + iconWidth + safeLabelWidth + activePaddingEnd);
}

/**
 * Computes the maximum width the expanded active tab can occupy inside a given shell width
 * without clipping sibling tabs or trailing controls on narrow mobile screens.
 */
export function computeMaxActiveTabWidth(params: {
  shellWidth: number;
  itemCount: number;
  trailingWidth?: number;
}): number {
  const { shellWidth, itemCount, trailingWidth = 0 } = params;
  const safeCount = Math.max(1, itemCount);
  const { tabWidth, barGap, barPaddingX, rootBorder } = EXPANDABLE_TABS_METRICS;
  const otherTabsWidth = Math.max(0, safeCount - 1) * (tabWidth + barGap);
  const trailingSection = trailingWidth > 0 ? trailingWidth + barGap : 0;
  const available = shellWidth - rootBorder - barPaddingX - otherTabsWidth - trailingSection;

  return Math.max(tabWidth, Math.floor(available));
}

/**
 * Computes the target morphing shell dimensions while clamping width strictly inside
 * the available mobile viewport so panels never cause horizontal overflow.
 */
export function computeTargetShellSize(params: {
  isOpen: boolean;
  contentSize: BoxSize | null;
  closedSize: BoxSize;
  activeTabWidth?: number;
  maxViewportWidth?: number | null;
}): BoxSize {
  const { isOpen, contentSize, closedSize, activeTabWidth, maxViewportWidth } = params;
  const { rootBorder, tabWidth, viewportMarginX } = EXPANDABLE_TABS_METRICS;
  const maxWidth =
    maxViewportWidth && Number.isFinite(maxViewportWidth) && maxViewportWidth > 0
      ? Math.max(closedSize.width, maxViewportWidth - viewportMarginX)
      : null;

  if (!isOpen || !contentSize) {
    return {
      width: maxWidth ? Math.min(closedSize.width, maxWidth) : closedSize.width,
      height: closedSize.height,
    };
  }

  const openBarMinWidth =
    activeTabWidth && activeTabWidth > tabWidth
      ? closedSize.width - tabWidth + activeTabWidth
      : closedSize.width;
  const rawWidth = Math.max(contentSize.width + rootBorder, openBarMinWidth);
  const clampedWidth = maxWidth ? Math.min(rawWidth, maxWidth) : rawWidth;

  return {
    width: clampedWidth,
    height: Math.max(contentSize.height + rootBorder, closedSize.height),
  };
}

/**
 * Resolves the next open panel ID and whether to navigate immediately when a mobile dock tab is tapped.
 * Tapping "home" from another section jumps straight to Home without opening a submenu;
 * tapping "home" while already on Home toggles the Home quick-controls panel.
 */
export function resolveMobileDockTabAction<TView extends string>(params: {
  clickedTabId: TView;
  activeWorkspaceView: TView;
  openPanelId: TView | null;
  directNavigateViews?: readonly TView[];
}): {
  nextOpenPanelId: TView | null;
  navigateToView: TView | null;
} {
  const { clickedTabId, activeWorkspaceView, openPanelId, directNavigateViews = [] } = params;

  if (directNavigateViews.includes(clickedTabId) && activeWorkspaceView !== clickedTabId) {
    return {
      nextOpenPanelId: null,
      navigateToView: clickedTabId,
    };
  }

  return {
    nextOpenPanelId: openPanelId === clickedTabId ? null : clickedTabId,
    navigateToView: null,
  };
}
