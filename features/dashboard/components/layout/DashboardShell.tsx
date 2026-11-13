"use client";

import { DashboardProvider, useDashboard } from "../../context/DashboardContext";
import DashboardContainer from "./DashboardContainer";

export { DashboardProvider, useDashboard };

export default function DashboardShell() {
  return (
    <DashboardProvider>
      <DashboardContainer />
    </DashboardProvider>
  );
}
