"use client";

import { isValidElement, type ReactElement, type ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SidebarTooltipProps {
  label: string;
  enabled: boolean;
  children: ReactNode;
}

export default function SidebarTooltip({ label, enabled, children }: SidebarTooltipProps) {
  if (!enabled || !isValidElement(children)) {
    return children;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={children as ReactElement}>
          {null}
        </TooltipTrigger>
        <TooltipContent side="left" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
