import { useRef } from "react";

export interface TouchPoint {
  x: number;
  y: number;
}

export function resolveSwipeGroupFilter(params: {
  touchStart: TouchPoint | null;
  touchEnd: TouchPoint | null;
  selectedGroupFilter: string | null;
  groupsOrder: readonly string[];
  minSwipeDistance?: number;
}): string | null | undefined {
  const { touchStart, touchEnd, selectedGroupFilter, groupsOrder, minSwipeDistance = 50 } = params;

  if (!touchStart || !touchEnd) return undefined;

  const distanceX = touchStart.x - touchEnd.x;
  const distanceY = touchStart.y - touchEnd.y;

  // Only trigger horizontal swipe if X movement is greater than Y movement
  if (Math.abs(distanceX) <= Math.abs(distanceY)) return undefined;

  const isLeftSwipe = distanceX > minSwipeDistance;
  const isRightSwipe = distanceX < -minSwipeDistance;

  if (!isLeftSwipe && !isRightSwipe) return undefined;

  const allGroups: Array<string | null> = [null, ...groupsOrder];
  const currIndex = allGroups.indexOf(selectedGroupFilter);
  const safeCurrIndex = currIndex === -1 ? 0 : currIndex;

  if (isRightSwipe) {
    const nextIndex = (safeCurrIndex + 1) % allGroups.length;

    return allGroups[nextIndex];
  }

  const prevIndex = (safeCurrIndex - 1 + allGroups.length) % allGroups.length;

  return allGroups[prevIndex];
}

export function useWorkspaceSwipe(
  selectedGroupFilter: string | null,
  setSelectedGroupFilter: (val: string | null) => void,
  groupsOrder: string[],
) {
  const touchStart = useRef<TouchPoint | null>(null);
  const touchEnd = useRef<TouchPoint | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    touchEnd.current = null;
    touchStart.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEnd.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  const onTouchEnd = () => {
    const nextFilter = resolveSwipeGroupFilter({
      touchStart: touchStart.current,
      touchEnd: touchEnd.current,
      selectedGroupFilter,
      groupsOrder,
    });

    if (nextFilter !== undefined) {
      setSelectedGroupFilter(nextFilter);
    }
  };

  return { onTouchStart, onTouchMove, onTouchEnd };
}
