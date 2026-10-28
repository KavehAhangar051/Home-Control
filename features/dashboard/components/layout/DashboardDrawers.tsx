"use client";

import React from "react";
import dynamic from "next/dynamic";

const ModulesDrawer = dynamic(
  () => import("@/features/iot/components/ModulesDrawer"),
  { ssr: false }
);
const AutomationsDrawer = dynamic(
  () => import("@/features/iot/components/AutomationsDrawer"),
  { ssr: false }
);
import { useDashboard } from "@/features/dashboard/context/DashboardContext";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";

export default function DashboardDrawers() {
  const isModulesMenuOpen = useIoTStore(s => s.isModulesMenuOpen);
  const setIsModulesMenuOpen = useIoTStore(s => s.setIsModulesMenuOpen);
  const isAutomationsMenuOpen = useIoTStore(s => s.isAutomationsMenuOpen);
  const setIsAutomationsMenuOpen = useIoTStore(s => s.setIsAutomationsMenuOpen);
  const accent3 = useIoTStore(s => s.accent3);
  const accent4 = useIoTStore(s => s.accent4);
  const animationsEnabled = useIoTStore(s => s.animationsEnabled);
  const isDark = useIoTStore(s => s.isDark);
  const { handleAddSegment, handleRemoveSegment } = useDashboard();
  const segments = useIoTStore(s => s.segments);

  return (
    <React.Suspense fallback={null}>
      {isModulesMenuOpen && (
        <ModulesDrawer
          isOpen={isModulesMenuOpen}
          onClose={() => setIsModulesMenuOpen(false)}
          onAddSegment={handleAddSegment}
          segments={segments}
          onRemoveSegment={handleRemoveSegment}
          isDark={isDark}
          accent3={accent3}
          accent4={accent4}
          animationsEnabled={animationsEnabled}
        />
      )}

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
