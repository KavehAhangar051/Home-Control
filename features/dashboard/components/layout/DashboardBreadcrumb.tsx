"use client";

import { House } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/reui/breadcrumb";
import { WORKSPACE_VIEW_META } from "@/features/dashboard/navigation";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";

export default function DashboardBreadcrumb() {
  const activeView = useIoTStore((s) => s.activeWorkspaceView);
  const setActiveWorkspaceView = useIoTStore((s) => s.setActiveWorkspaceView);
  const activeMeta = WORKSPACE_VIEW_META[activeView];
  const ActiveIcon = activeMeta.navIcon;

  return (
    <Breadcrumb dir="rtl" className="mt-3 mb-5 px-1 md:mt-5">
      <BreadcrumbList className="gap-2 text-[var(--text-secondary)]">
        <BreadcrumbItem>
          <BreadcrumbLink
            href="#"
            onClick={(event) => {
              event.preventDefault();
              setActiveWorkspaceView("home");
            }}
            className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[var(--card-hover-bg)] hover:text-[var(--accent3)]"
          >
            <House className="size-4" aria-hidden="true" />
            <span>خانه</span>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="text-[var(--text-muted)]" />
        <BreadcrumbItem>
          <BreadcrumbPage className="inline-flex items-center gap-2 text-[var(--text-primary)]">
            <ActiveIcon className="size-4 text-[var(--accent3)]" aria-hidden="true" />
            {activeMeta.title}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
