"use client";

import { isValidElement, type ReactElement, type ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarTooltipProps {
  label: string;
  enabled: boolean;
  children: ReactNode;
}

export default function SidebarTooltip({ label, enabled, children }: SidebarTooltipProps) {
  if (!enabled || !isValidElement(children)) {
    return children;
  }

  // SAFETY: isValidElement(children) guard verified children is a ReactElement
  const triggerElement = children as ReactElement;

  return (
    <Tooltip>
      <TooltipTrigger render={triggerElement} />
      <TooltipContent side="left" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
