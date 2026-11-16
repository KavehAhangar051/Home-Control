"use client";

import GroupColsSelector from "@/components/MasterHeader/GroupColsSelector";
import WorkspaceViewModeSelector from "@/components/MasterHeader/WorkspaceViewModeSelector";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import HeaderSettingsContent from "../header-settings/HeaderSettingsContent";

interface LayoutSectionProps {
  headerTitle: string;
  setHeaderTitle: (val: string) => void;
}

export default function LayoutSection({ headerTitle, setHeaderTitle }: LayoutSectionProps) {
  const workspaceDisplayMode = useIoTStore((s) => s.workspaceDisplayMode);

  return (
    <div className="space-y-6 text-right" dir="rtl">
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-[var(--text-secondary)]">چیدمان فضای کار</h4>

        <div className="flex flex-col gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg-solid)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <span className="text-xs font-medium text-[var(--text-primary)]">
              فرم نمایش سگمنت‌ها و گروه‌ها
            </span>
            <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
              انتخاب بین چیدمان ستونی کلاسیک، پنجره‌های آزاد، یا شیت بوم بی‌نهایت (مشابه n8n)
            </p>
          </div>

          <div className="shrink-0">
            <WorkspaceViewModeSelector />
          </div>
        </div>

        {workspaceDisplayMode === "grid" && (
          <div className="flex flex-col gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg-solid)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <span className="text-xs font-medium text-[var(--text-primary)]">
                تعداد ستون گروه‌ها
              </span>
              <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                تعیین تعداد ستون‌های نمایش گروه‌ها در حالت ستونی
              </p>
            </div>

            <div className="shrink-0">
              <GroupColsSelector />
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-[var(--border-color)] bg-[var(--card-bg-solid)] p-4">
        <HeaderSettingsContent headerTitle={headerTitle} setHeaderTitle={setHeaderTitle} />
      </div>
    </div>
  );
}
