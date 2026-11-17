"use client";

import { useDroppable } from "@dnd-kit/react";
import { Card } from "@/components/ui/card";
import { Trash2 } from "@/components/ui/hugeicons";

export default function TrashDropZone({ activeId }: { activeId: string | null }) {
  const { isDropTarget, ref } = useDroppable({
    id: "trash-dropzone",
    accept: ["Group", "Segment"],
  });

  if (!activeId) return null;

  return (
    <Card
      ref={ref}
      role="status"
      aria-live="polite"
      className={`!mt-12 !gap-0 !ring-0 !p-6 !w-full !max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[112px] text-center !border !border-dashed transition-[border-color,background-color,color] duration-150 ease-out z-10 !rounded-xl ${
        isDropTarget
          ? "!bg-destructive/10 !border-destructive !text-destructive"
          : "!bg-card-bg !border-border-color !text-text-muted"
      }`}
    >
      <Trash2 className="size-6 mx-auto mb-2" strokeWidth={1.5} />
      <span className="text-xs font-medium font-sans">برای حذف اینجا رها کنید</span>
    </Card>
  );
}
