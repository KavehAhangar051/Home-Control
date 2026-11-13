"use client";

import dynamic from "next/dynamic";
import React from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";

const AutomationsDrawer = dynamic(() => import("@/features/iot/components/AutomationsDrawer"), {
  ssr: false,
});

export default function DashboardDrawers() {
  const isAutomationsMenuOpen = useIoTStore((s) => s.isAutomationsMenuOpen);
  const setIsAutomationsMenuOpen = useIoTStore((s) => s.setIsAutomationsMenuOpen);
  const animationsEnabled = useIoTStore((s) => s.animationsEnabled);
  const isDark = useIoTStore((s) => s.isDark);

  return (
    <React.Suspense fallback={null}>
      {isAutomationsMenuOpen && (
        <AutomationsDrawer
          isOpen={isAutomationsMenuOpen}
          onClose={() => setIsAutomationsMenuOpen(false)}
          isDark={isDark}
          animationsEnabled={animationsEnabled}
        />
      )}
    </React.Suspense>
  );
}
