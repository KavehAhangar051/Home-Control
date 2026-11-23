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
        <h4 className="text-xs font-semibold text-text-secondary">چیدمان فضای کار</h4>

        <div className="flex flex-col gap-3 rounded-lg border border-border-color bg-card-bg-solid px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <span className="text-xs font-medium text-text-primary">حالت نمایش فضا</span>
            <p className="mt-0.5 text-[11px] text-text-muted">
              ستونی، پنجره‌های آزاد یا بوم بی‌نهایت
            </p>
          </div>

          <div className="shrink-0">
            <WorkspaceViewModeSelector />
          </div>
        </div>

        {workspaceDisplayMode === "grid" && (
          <div className="flex flex-col gap-3 rounded-lg border border-border-color bg-card-bg-solid px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs font-medium text-text-primary">تعداد ستون گروه‌ها</span>

            <div className="shrink-0">
              <GroupColsSelector />
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border-color bg-card-bg-solid p-4">
        <HeaderSettingsContent headerTitle={headerTitle} setHeaderTitle={setHeaderTitle} />
      </div>
    </div>
  );
}
