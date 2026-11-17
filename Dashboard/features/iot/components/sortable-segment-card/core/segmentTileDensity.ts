export interface SegmentTileDensity {
  container: string;
  badge: string;
  icon: string;
  title: string;
}

/**
 * Computes responsive container-query density classes for segment card tiles
 * across standard, compact, and ultra-compact layouts.
 */
export function getSegmentTileDensity(
  isUltraCompact: boolean,
  isCompact: boolean,
  hasExternalHeader: boolean,
): SegmentTileDensity {
  if (isUltraCompact) {
    return {
      container: hasExternalHeader ? "min-h-0 px-2.5 py-2 gap-1.5" : "min-h-[78px] p-2.5 gap-2",
      badge: "size-8",
      icon: "size-4",
      title: "text-xs",
    };
  }

  if (isCompact) {
    return {
      container: hasExternalHeader ? "min-h-0 px-3 py-2.5 gap-2" : "min-h-[96px] p-3 gap-2.5",
      badge: "size-9",
      icon: "size-4.5",
      title: "text-xs @[12rem]/segment:text-sm",
    };
  }

  return {
    container: hasExternalHeader
      ? "min-h-0 px-3.5 py-3 gap-2.5"
      : "min-h-[108px] p-3.5 sm:p-4 gap-3",
    badge: "size-10 @[13rem]/segment:size-11",
    icon: "size-5",
    title: "text-xs @[11rem]/segment:text-sm @[15rem]/segment:text-[15px]",
  };
}
