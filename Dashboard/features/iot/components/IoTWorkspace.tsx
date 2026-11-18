"use client";

import dynamic from "next/dynamic";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { retryDynamicImport } from "@/lib/dynamicRetry";
import type { IoTWorkspaceProps } from "./workspace";
import WorkspaceSkeleton from "./workspace/components/WorkspaceSkeleton";

export type { IoTWorkspaceProps };

const DndGridWorkspace = dynamic(
  () => retryDynamicImport(() => import("./workspace/components/DndGridWorkspace")),
  {
    ssr: false,
    loading: () => <WorkspaceSkeleton mode="grid" groupsCols={2} />,
  },
);

const TrellisWorkspace = dynamic(
  () => retryDynamicImport(() => import("./trellis/TrellisWorkspace")),
  {
    ssr: false,
    loading: () => <WorkspaceSkeleton mode="trellis" />,
  },
);

const CanvasWorkspace = dynamic(
  () => retryDynamicImport(() => import("./canvas/CanvasWorkspace")),
  {
    ssr: false,
    loading: () => <WorkspaceSkeleton mode="canvas" />,
  },
);

export default function IoTWorkspace(props: IoTWorkspaceProps) {
  const workspaceDisplayMode = useIoTStore((s) => s.workspaceDisplayMode);

  if (workspaceDisplayMode === "trellis") {
    return <TrellisWorkspace {...props} />;
  }

  if (workspaceDisplayMode === "canvas") {
    return <CanvasWorkspace {...props} />;
  }

  return <DndGridWorkspace {...props} />;
}
