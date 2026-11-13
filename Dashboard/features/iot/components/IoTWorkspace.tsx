"use client";

import dynamic from "next/dynamic";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import type { IoTWorkspaceProps } from "./workspace";

export type { IoTWorkspaceProps };

const DndGridWorkspace = dynamic(() => import("./workspace/components/DndGridWorkspace"), {
  ssr: false,
});

const TrellisWorkspace = dynamic(() => import("./trellis/TrellisWorkspace"), {
  ssr: false,
  loading: () => (
    <div className="h-full min-h-[460px] w-full flex-1 animate-pulse rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)]" />
  ),
});

export default function IoTWorkspace(props: IoTWorkspaceProps) {
  const workspaceDisplayMode = useIoTStore((s) => s.workspaceDisplayMode);

  if (workspaceDisplayMode === "trellis") {
    return <TrellisWorkspace {...props} />;
  }

  return <DndGridWorkspace {...props} />;
}
