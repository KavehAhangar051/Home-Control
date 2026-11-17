import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import { Card } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";
import { Sliders } from "@/components/ui/hugeicons";
import { getStaggerDelay, TRANSITION_ENTER_STANDARD, TRANSITION_EXIT_STANDARD } from "@/lib/ease";
import type { Segment } from "../core/types";

const MotionCard = m.create(Card);

interface SegmentListProps {
  segments: Segment[];
  onRemoveSegment: (id: string) => void;
}

export default function SegmentList({ segments, onRemoveSegment }: SegmentListProps) {
  return (
    <div className="@container/seglist space-y-3">
      <div className="flex items-center justify-between border-b border-border-color pb-2">
        <div className="flex items-center gap-2">
          <Sliders strokeWidth={1.5} className="size-3.5 text-accent3" />
          <span className="text-xs font-medium text-text-secondary">قطعات ثبت‌شده</span>
        </div>
        <span className="text-xs tabular-nums text-text-muted">{segments.length} مورد</span>
      </div>

      <AnimatePresence initial={false} mode="popLayout">
        {segments.length === 0 ? (
          <m.div
            key="empty-segments"
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98, transition: TRANSITION_EXIT_STANDARD }}
            transition={TRANSITION_ENTER_STANDARD}
            className="py-6 px-4 text-center border border-dashed border-border-color rounded-xl bg-card-hover-bg space-y-1"
          >
            <p className="text-xs font-medium text-text-secondary">هنوز قطعه‌ای اضافه نشده است</p>
            <p className="text-xs text-text-muted leading-relaxed">
              از فرم کناری اولین کلید کنترل یا ورودی دیجیتال خانه را ایجاد کنید
            </p>
          </m.div>
        ) : (
          <div className="grid grid-cols-1 @xl/seglist:grid-cols-2 gap-2.5 max-h-[360px] overflow-y-auto pe-1">
            {segments.map((seg, index) => (
              <MotionCard
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{
                  opacity: 0,
                  y: -8,
                  transition: TRANSITION_EXIT_STANDARD,
                }}
                transition={{
                  ...TRANSITION_ENTER_STANDARD,
                  delay: getStaggerDelay(index),
                }}
                key={seg.id}
                className="!gap-3 !rounded-xl !border-border-color !bg-card-bg-solid !p-3 flex items-center justify-between text-right group md:hover:!border-accent3-medium transition-colors shadow-none"
              >
                <DeleteButton
                  size="sm"
                  left
                  resetAfter={0}
                  onConfirm={() => onRemoveSegment(seg.id)}
                  label={`حذف ${seg.title}`}
                />

                <div className="flex-1 min-w-0">
                  <span className="block text-xs font-medium text-text-primary truncate">
                    {seg.title}
                  </span>
                  <span className="block text-xs tabular-nums text-text-muted mt-0.5">
                    <span className="font-mono text-[11px]" dir="ltr">
                      GPIO {seg.pin}
                    </span>{" "}
                    ·{" "}
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
