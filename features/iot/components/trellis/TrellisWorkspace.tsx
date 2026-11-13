"use client";

import { ViewType, Workspace } from "@danfessler/trellis-react";
import "@danfessler/trellis/style.css";
import { Cpu, Layers, Plus } from "lucide-react";
import type { IoTWorkspaceProps } from "@/features/iot/components/workspace/core/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import TrellisChromeBar from "./TrellisChromeBar";
import TrellisGroupView from "./TrellisGroupView";
import TrellisSegmentView from "./TrellisSegmentView";
import {
  getTrellisStorageKey,
  TRELLIS_LAYOUT_VERSION,
  translateTrellisMenuEntries,
} from "./trellisLayout";
import { TRELLIS_TOKENS, useTrellisWorkspaceController } from "./useTrellisWorkspaceController";

type TrellisWorkspaceProps = Omit<
  IoTWorkspaceProps,
  | "sensors"
  | "handleDragStart"
  | "handleDragOver"
  | "handleDragEnd"
  | "activeSegmentId"
  | "activeGroupId"
>;

export default function TrellisWorkspace({
  groupsOrder,
  animationsEnabled = true,
  selectedGroupFilter = null,
  handleAddPlaceholder,
  handleRemoveGroup,
  handleRemoveSegment,
  handleTogglePin,
  handleSetPinState,
  handleUpdateSegmentMode,
  handleUpdateSegmentAutoOff,
  handleSetupPlaceholder,
}: TrellisWorkspaceProps) {
  const isDark = useIoTStore((s) => s.isDark);
  const segments = useIoTStore((s) => s.segments);
  const setActiveWorkspaceView = useIoTStore((s) => s.setActiveWorkspaceView);
  const setActiveModulesTab = useIoTStore((s) => s.setActiveModulesTab);

  const {
    preset,
    defaultLayout,
    handleWorkspaceRef,
    handleChangePreset,
    handleResetLayout,
    segmentTitleLookup,
  } = useTrellisWorkspaceController({
    groupsOrder,
    segments,
    selectedGroupFilter,
  });

  return (
    <div
      dir="ltr"
      className="trellis-rtl-host relative h-full min-h-[460px] w-full flex-1 overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-main)] shadow-xs"
    >
      <Workspace
        key={preset}
        ref={handleWorkspaceRef}
        theme={isDark ? "dark" : "light"}
        tokens={TRELLIS_TOKENS}
        navigation="free"
        floating="overlay"
        motion={animationsEnabled ? "full" : "reduced"}
        tabs={{ fill: false, inset: 4 }}
        detail={{ size: 48, outline: 2 }}
        storageKey={getTrellisStorageKey(preset)}
        version={TRELLIS_LAYOUT_VERSION}
        defaultLayout={defaultLayout}
        label="فضای کاری آزاد گروه‌ها و قطعات"
        panelMenu={(entries) => translateTrellisMenuEntries(entries)}
        onMissingType={() => "drop"}
      >
        <ViewType
          id="group"
          title={(view) => String(view.params.groupName || "گروه")}
          icon={<Layers className="h-3.5 w-3.5" aria-hidden="true" />}
          closable={false}
          minSize={{ width: 240, height: 190 }}
          placement="stage"
        >
          <TrellisGroupView
            animationsEnabled={animationsEnabled}
            onAddPlaceholder={handleAddPlaceholder}
            onDeleteGroup={handleRemoveGroup}
            onRemoveSegment={handleRemoveSegment}
            onTogglePin={handleTogglePin}
            onSetPinState={handleSetPinState}
            onUpdateSegmentMode={handleUpdateSegmentMode}
            onUpdateSegmentAutoOff={handleUpdateSegmentAutoOff}
            onSetupPlaceholder={handleSetupPlaceholder}
          />
        </ViewType>

        <ViewType
          id="segment"
          title={(view) => segmentTitleLookup(String(view.params.segmentId || ""))}
          icon={<Cpu className="h-3.5 w-3.5" aria-hidden="true" />}
          closable={preset === "groups"}
          minSize={{ width: 170, height: 120 }}
          placement="stage"
        >
          <TrellisSegmentView
            animationsEnabled={animationsEnabled}
            onRemoveSegment={handleRemoveSegment}
            onTogglePin={handleTogglePin}
            onSetPinState={handleSetPinState}
            onUpdateSegmentMode={handleUpdateSegmentMode}
            onUpdateSegmentAutoOff={handleUpdateSegmentAutoOff}
            onSetupPlaceholder={handleSetupPlaceholder}
          />
        </ViewType>

        <Workspace.Empty>
          <div dir="rtl" className="flex flex-col items-center gap-3 p-6 text-center">
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              هیچ پنلی در فضای آزاد باز نیست.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleResetLayout}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-[var(--accent3)] px-4 text-xs font-bold text-[var(--accent3-foreground)]"
              >
                بازگردانی پنل‌ها
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveModulesTab("add");
                  setActiveWorkspaceView("modules");
                }}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] px-4 text-xs font-semibold text-[var(--text-primary)]"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                افزودن قطعه
              </button>
            </div>
          </div>
        </Workspace.Empty>

        <Workspace.Chrome>
          <TrellisChromeBar
            preset={preset}
            onChangePreset={handleChangePreset}
            onResetLayout={handleResetLayout}
          />
        </Workspace.Chrome>
      </Workspace>
    </div>
  );
}
