import React from "react";
import { SegmentData } from "../core/types";
import { CardFooter as ReUICardFooter } from "@/components/ui/card";

interface CardFooterProps {
  segment: SegmentData;
  isPinOn: boolean;
}

export default function CardFooter({ segment, isPinOn }: CardFooterProps) {
  return (
    <ReUICardFooter className="!gap-0 !rounded-b-xl !px-3 !py-2 border-t border-[var(--border)] bg-[var(--muted)]/30 min-h-[28px]">
      <div className="flex w-full justify-between items-center text-[11px] tabular-nums text-[var(--muted-foreground)] transition-colors">
        <span>وضعیت: {isPinOn ? "روشن" : "خاموش"}</span>
        <span>پایه {segment.pin}</span>
      </div>
    </ReUICardFooter>
  );
}
