/**
 * Calculates the effective number of columns a group should span
 * based on its position in the grid and the total number of items,
 * preventing orphaned items on the last row.
 *
 * @param groupIndex The index of the group in the filtered list
 * @param totalGroups The total number of groups being rendered
 * @param maxCols The maximum number of columns the grid supports
 * @returns The effective number of columns the group should occupy
 */
export function getEffectiveGroupsCols(
  groupIndex: number,
  totalGroups: number,
  maxCols: number,
): number {
  let actualParentGroupsCols = maxCols;

  if (maxCols > 1 && totalGroups > 0) {
    const totalRows = Math.ceil(totalGroups / maxCols);
    const currentRow = Math.floor(groupIndex / maxCols);
    const isLastRow = currentRow === totalRows - 1;

    if (isLastRow) {
      const itemsInLastRow = totalGroups % maxCols || maxCols;
      actualParentGroupsCols = itemsInLastRow;
    }
  }

  return Math.min(totalGroups, actualParentGroupsCols);
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);

  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }

  return x || 1;
}

function lcm(a: number, b: number): number {
  return (a * b) / gcd(a, b);
}

export interface SegmentGridLayout {
  gridTracks: number;
  getItemSpan: (index: number) => number;
}

/**
 * Computes CSS Grid track count and per-item column span so any incomplete
 * final row of segments expands evenly to fill the full group width.
 */
export function getSegmentGridLayout(totalItems: number, maxCols: number): SegmentGridLayout {
  if (totalItems <= 0) {
    return { gridTracks: 1, getItemSpan: () => 1 };
  }

  const effectiveCols = Math.min(Math.max(1, totalItems), Math.max(1, maxCols));
  const remainder = totalItems % effectiveCols;

  if (remainder === 0) {
    return {
      gridTracks: effectiveCols,
      getItemSpan: () => 1,
    };
  }

  const gridTracks = lcm(effectiveCols, remainder);
  const fullRowItemCount = Math.floor(totalItems / effectiveCols) * effectiveCols;
  const fullRowSpan = gridTracks / effectiveCols;
  const lastRowSpan = gridTracks / remainder;

  return {
    gridTracks,
    getItemSpan: (index: number) => (index >= fullRowItemCount ? lastRowSpan : fullRowSpan),
  };
}
