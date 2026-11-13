"use client";

import React from "react";
import StabilitySectionComponent, {
  InlineStabilitySection,
  StabilitySectionContent,
} from "./stability-section/StabilitySection";
import type { StabilitySectionProps } from "./stability-section/types";

export type { StabilitySectionProps };

export { InlineStabilitySection, StabilitySectionContent };

export default function StabilitySection(props: StabilitySectionProps) {
  return <StabilitySectionComponent {...props} />;
}
