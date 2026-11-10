import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sliders, Trash2 } from "lucide-react";
import { Segment } from "../core/types";
import { Card } from "@/components/ui/card";

const MotionCard = motion(Card);

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

      {segments.length === 0 ? (
        <div className="py-6 px-4 text-center border border-dashed border-[var(--border-color)] rounded-xl bg-black/10 space-y-1">
          <p className="text-xs font-semibold theme-text-secondary">هنوز قطعه‌ای اضافه نشده است</p>
          <p className="text-[11px] theme-text-muted leading-relaxed">
            از فرم کناری اولین کلید کنترل یا ورودی دیجیتال خانه را ایجاد کنید.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {segments.map((seg) => (
              <MotionCard
                initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{
                  opacity: 0,
                  y: -8,
                  filter: "blur(4px)",
                  transition: { duration: 0.15, ease: "easeOut" },
                }}
                key={seg.id}
                className="!gap-3 !rounded-xl !border-[var(--border-color)] !bg-[var(--card-bg-solid)] !p-3 flex items-center justify-between text-right group md:hover:!border-[var(--accent3-medium)] transition-colors shadow-none"
              >
                <button
                  type="button"
                  onClick={() => onRemoveSegment(seg.id)}
                  className="p-1.5 bg-red-500/10 md:hover:bg-red-500/20 text-red-500 md:hover:text-red-400 transition-[background-color,color,scale] duration-150 ease-out active:scale-[0.96] cursor-pointer rounded-lg"
                  title="حذف قطعه"
                  aria-label={`حذف ${seg.title}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

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
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
