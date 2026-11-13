import { AnimatePresence, m } from "motion/react";
import { Card } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";
import { Sliders } from "@/components/ui/hugeicons";
import type { Segment } from "../core/types";

const MotionCard = m.create(Card);

interface SegmentListProps {
  segments: Segment[];
  onRemoveSegment: (id: string) => void;
}

export default function SegmentList({ segments, onRemoveSegment }: SegmentListProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-2">
        <div className="flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5 text-[var(--accent3)]" />
          <span className="text-xs font-bold theme-text-secondary">قطعات ثبت‌شده</span>
        </div>
        <span className="text-xs tabular-nums theme-text-muted">{segments.length} مورد</span>
      </div>

      <AnimatePresence initial={false} mode="popLayout">
        {segments.length === 0 ? (
          <m.div
            key="empty-segments"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-6 px-4 text-center border border-dashed border-[var(--border-color)] rounded-xl bg-[var(--card-hover-bg)] space-y-1"
          >
            <p className="text-xs font-semibold theme-text-secondary">هنوز قطعه‌ای اضافه نشده است</p>
            <p className="text-[11px] theme-text-muted leading-relaxed">
              از فرم کناری اولین کلید کنترل یا ورودی دیجیتال خانه را ایجاد کنید.
            </p>
          </m.div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {segments.map((seg) => (
              <MotionCard
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{
                  opacity: 0,
                  y: -8,
                  transition: { duration: 0.15, ease: "easeOut" },
                }}
                key={seg.id}
                className="!gap-3 !rounded-xl !border-[var(--border-color)] !bg-[var(--card-bg-solid)] !p-3 flex items-center justify-between text-right group md:hover:!border-[var(--accent3-medium)] transition-colors shadow-none"
              >
                <DeleteButton
                  size="sm"
                  left
                  resetAfter={0}
                  onConfirm={() => onRemoveSegment(seg.id)}
                  label={`حذف ${seg.title}`}
                />

                <div className="flex-1 min-w-0">
                  <span className="block text-xs font-bold theme-text-primary truncate">
                    {seg.title}
                  </span>
                  <span className="block text-[11px] tabular-nums theme-text-muted mt-0.5">
                    پایه {seg.pin} ·{" "}
                    {seg.type === "input"
                      ? "ورودی دیجیتال"
                      : seg.mode === "push"
                        ? "شستی لحظه‌ای"
                        : "کلید دوحالته"}
                  </span>
                </div>
              </MotionCard>
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
