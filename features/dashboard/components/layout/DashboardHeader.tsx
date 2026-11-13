"use client";

import MasterHeader from "@/components/MasterHeader";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";

export default function DashboardHeader() {
  const setIsMenuOpen = useIoTStore((s) => s.setIsMenuOpen);
  const headerTitle = useIoTStore((s) => s.headerTitle);
  const animationsEnabled = useIoTStore((s) => s.animationsEnabled);
  const isSidebarCollapsed = useIoTStore((s) => s.isSidebarCollapsed);
  const setIsSidebarCollapsed = useIoTStore((s) => s.setIsSidebarCollapsed);

  return (
    <aside
      className={`sticky top-0 z-20 flex h-screen shrink-0 flex-col overflow-hidden border-l border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] transition-[width] duration-200 [&::-webkit-scrollbar]:hidden [scrollbar-width:none] ${isSidebarCollapsed ? "w-16 md:w-16" : "w-16 md:w-64"}`}
      aria-label="ناوبری اصلی"
    >
      <MasterHeader
        setIsMenuOpen={setIsMenuOpen}
        headerTitle={headerTitle}
        animationsEnabled={animationsEnabled}
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
      />
    </aside>
  );
}
