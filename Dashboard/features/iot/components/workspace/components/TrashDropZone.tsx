"use client";

import { useDroppable } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Trash2 } from "@/components/ui/hugeicons";

export default function TrashDropZone({ activeId }: { activeId: string | null }) {
  const { isOver, setNodeRef } = useDroppable({
    id: "trash-dropzone",
  });

  if (!activeId) return null;

  return (
    <Card
      ref={setNodeRef}
      role="status"
      aria-live="polite"
      className={`!mt-12 !gap-0 !ring-0 !p-6 !w-full !max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[112px] text-center !border !border-dashed transition-[border-color,background-color,color] duration-150 ease-[var(--ease-out)] z-10 !rounded-xl ${
        isOver
          ? "!bg-[var(--destructive)]/10 !border-[var(--destructive)] !text-[var(--destructive)]"
          : "!bg-[var(--card-bg)] !border-[var(--border-color)] !text-[var(--text-muted)]"
      }`}
    >
      <Trash2 className="w-6 h-6 mx-auto mb-2" strokeWidth={1.5} />
      <span className="text-xs font-medium font-sans">برای حذف اینجا رها کنید</span>
    </Card>
  );
}
