"use client";

import React from "react";
import SortableSegmentCardComponent from "./sortable-segment-card";
import type { SortableSegmentCardProps } from "./sortable-segment-card/core/types";

export type { SortableSegmentCardProps };

export default function SortableSegmentCard(props: SortableSegmentCardProps) {
  return <SortableSegmentCardComponent {...props} />;
}
