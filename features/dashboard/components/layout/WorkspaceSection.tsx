"use client";

import type { LucideIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { Activity, useDeferredValue } from "react";
import { Alert } from "@/components/reui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Container } from "@/components/ui/grid";
import { Cpu } from "@/components/ui/hugeicons-groups/controls";
import { useDashboard, useDashboardActions } from "@/features/dashboard/context/DashboardContext";
import {
  AUTOMATIONS_TABS,
  MODULES_TABS,
  resolveSettingsTabId,
  SETTINGS_TABS,
  WORKSPACE_VIEW_META,
} from "@/features/dashboard/navigation";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import {
  FormPanelSkeleton,
  ListPanelSkeleton,
  WorkflowStudioSkeleton,
} from "./WorkspaceSectionSkeletons";

const AutomationForm = dynamic(
  () => import("@/features/iot/components/AutomationsDrawer/components/AutomationForm"),
  { ssr: false, loading: () => <FormPanelSkeleton /> },
);

const AutomationList = dynamic(
  () => import("@/features/iot/components/AutomationsDrawer/components/AutomationList"),
  { ssr: false, loading: () => <ListPanelSkeleton /> },
);

const AutomationProvider = dynamic(
  () =>
    import("@/features/iot/components/AutomationsDrawer/context/AutomationContext").then(
      (mod) => mod.AutomationProvider,
    ),
  { ssr: false },
);

const WorkflowStudio = dynamic(() => import("@/features/iot/components/workflows/WorkflowStudio"), {
  ssr: false,
  loading: () => <WorkflowStudioSkeleton />,
});

const AddSegmentForm = dynamic(
  () => import("@/features/iot/components/modules-drawer/components/AddSegmentForm"),
  { ssr: false, loading: () => <FormPanelSkeleton /> },
);

const SegmentList = dynamic(
  () => import("@/features/iot/components/modules-drawer/components/SegmentList"),
  { ssr: false, loading: () => <ListPanelSkeleton /> },
);

const AudioSection = dynamic(
  () => import("@/features/settings/components/audio-section/AudioSection"),
  { ssr: false, loading: () => <FormPanelSkeleton /> },
);

const ColorsSection = dynamic(
  () => import("@/features/settings/components/colors-section/ColorsSection"),
  { ssr: false, loading: () => <FormPanelSkeleton /> },
);

const ConditionsSection = dynamic(
  () => import("@/features/settings/components/conditions-section/ConditionsSection"),
  { ssr: false, loading: () => <FormPanelSkeleton /> },
);

const LayoutSection = dynamic(
  () => import("@/features/settings/components/layout-section/LayoutSection"),
  { ssr: false, loading: () => <FormPanelSkeleton /> },
);

const MacrosSection = dynamic(
  () => import("@/features/settings/components/macros-section/MacrosSection"),
  { ssr: false, loading: () => <FormPanelSkeleton /> },
);

const MqttSection = dynamic(
  () => import("@/features/settings/components/mqtt-section/MqttSection"),
  { ssr: false, loading: () => <FormPanelSkeleton /> },
);

const InlineStabilitySection = dynamic(
  () =>
    import("@/features/settings/components/StabilitySection").then(
      (mod) => mod.InlineStabilitySection,
    ),
  { ssr: false, loading: () => <FormPanelSkeleton /> },
);

const VoiceCommandsSection = dynamic(
  () => import("@/features/settings/components/voice-commands-section/VoiceCommandsSection"),
  { ssr: false, loading: () => <FormPanelSkeleton /> },
);

const WifiSection = dynamic(
  () => import("@/features/settings/components/wifi-section/WifiSection"),
  { ssr: false, loading: () => <FormPanelSkeleton /> },
);

type WorkspaceSectionView = "modules" | "automations" | "settings";

function useActiveSubsectionMeta(view: WorkspaceSectionView): {
  title: string;
  icon: LucideIcon;
} {
  const activeModulesTab = useIoTStore((state) => state.activeModulesTab);
  const activeAutomationsTab = useIoTStore((state) => state.activeAutomationsTab);
  const rawActiveSettingsTab = useIoTStore((state) => state.activeSettingsTab);

  if (view === "modules") {
    const found = MODULES_TABS.find((t) => t.id === activeModulesTab) ?? MODULES_TABS[0];

    return { title: found.title, icon: found.icon };
  }

  if (view === "automations") {
    const found =
      AUTOMATIONS_TABS.find((t) => t.id === activeAutomationsTab) ?? AUTOMATIONS_TABS[0];

    return { title: found.title, icon: found.icon };
  }

  const resolvedSettingsTab = resolveSettingsTabId(rawActiveSettingsTab);
  const found = SETTINGS_TABS.find((t) => t.id === resolvedSettingsTab) ?? SETTINGS_TABS[0];

  return { title: found.title, icon: found.icon };
}

export default function WorkspaceSection({ view }: { view: WorkspaceSectionView }) {
  const meta = WORKSPACE_VIEW_META[view];
  const Icon = meta.sectionIcon;
  const activeSubsection = useActiveSubsectionMeta(view);
  const SubsectionIcon = activeSubsection.icon;
  const activeAutomationsTab = useIoTStore((state) => state.activeAutomationsTab);
  const openAuxNodeModal = useIoTStore((state) => state.openAuxNodeModal);

  if (view === "automations" && activeAutomationsTab === "workflows") {
    return <WorkflowsCanvasSection />;
  }

  return (
    <Container
      size="lg"
      className="@container/workspace max-w-5xl space-y-3 px-0 py-1 text-right sm:space-y-6 sm:px-4 sm:py-6 lg:px-6 @lg/workspace:py-8"
      dir="rtl"
    >
      <header className="flex items-center justify-between gap-2.5 border-b border-border-color pb-3 sm:pb-5 md:items-end md:pb-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="hidden size-12 shrink-0 items-center justify-center rounded-xl border border-border-color bg-card-bg text-accent3 dark:shadow-[inset_0_1px_0_0_oklch(1_0_0/0.08)] md:flex">
            <Icon className="size-6" aria-hidden="true" />
          </div>
          <div className="min-w-0 space-y-1">
            <span className="hidden items-center gap-1.5 text-xs font-medium text-text-secondary md:inline-flex">
              <SubsectionIcon className="size-3.5 shrink-0 text-accent3" aria-hidden="true" />
              <span>{meta.title}</span>
            </span>
            <h1 className="truncate text-lg font-bold leading-snug tracking-tight text-balance text-text-primary sm:text-[1.75rem] lg:text-[2rem]">
              {activeSubsection.title}
            </h1>
          </div>
        </div>

        {view === "modules" && (
          <button
            type="button"
            onClick={() => openAuxNodeModal()}
            aria-label="افزودن برد کمکی (ESP)"
            className="inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-border-color bg-card-bg px-3 text-xs font-medium text-text-primary transition-colors duration-150 hover:border-accent3 hover:bg-accent3 hover:text-accent3-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 sm:gap-2 sm:px-4 sm:text-sm"
          >
            <Cpu className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span className="sm:hidden">برد کمکی</span>
            <span className="hidden sm:inline">افزودن برد کمکی (ESP)</span>
          </button>
        )}
      </header>

      {view === "modules" && <ModulesWorkspace />}
      {view === "automations" && <AutomationsWorkspace />}
      {view === "settings" && <SettingsWorkspace />}
    </Container>
  );
}

function MobileSubsectionTabs<T extends string>({
  items,
  activeId,
  onSelect,
  ariaLabel,
}: {
  items: ReadonlyArray<{ id: T; compactTitle: string; icon: LucideIcon }>;
  activeId: T;
  onSelect: (id: T) => void;
  ariaLabel: string;
}) {
  const useSegmentedGrid = items.length <= 3;

  return (
    <nav
      aria-label={ariaLabel}
      className={`min-w-0 rounded-xl border border-border-color/85 bg-card-bg-solid p-1 shadow-xs md:hidden ${
        useSegmentedGrid
          ? ""
          : "overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
      }`}
    >
      <div
        className={
          useSegmentedGrid
            ? `grid gap-1 ${items.length === 2 ? "grid-cols-2" : "grid-cols-3"}`
            : "flex min-w-max snap-x snap-mandatory items-center gap-1"
        }
      >
        {items.map((tab) => {
          const isActive = tab.id === activeId;
          const TabIcon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelect(tab.id)}
              aria-current={isActive ? "page" : undefined}
              className={`inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors duration-200 ease-out ${
                useSegmentedGrid ? "justify-center" : "shrink-0 snap-start"
              } ${
                isActive
                  ? "border-accent3 bg-accent3/12 font-semibold text-text-primary shadow-2xs"
                  : "border-transparent text-text-secondary hover:bg-card-hover-bg hover:text-text-primary"
              }`}
            >
              <TabIcon
                aria-hidden="true"
                strokeWidth={1.75}
                className={`size-3.5 shrink-0 ${isActive ? "text-accent3" : "text-text-muted"}`}
              />
              <span className="truncate">{tab.compactTitle}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function ModulesWorkspace() {
  const { handleAddSegment, handleRemoveSegment, targetPlaceholderId, clearTargetPlaceholder } =
    useDashboard();

  const segments = useIoTStore((state) => state.segments);
  const animationsEnabled = useIoTStore((state) => state.animationsEnabled);
  const setActiveWorkspaceView = useIoTStore((state) => state.setActiveWorkspaceView);
  const activeModulesTab = useIoTStore((state) => state.activeModulesTab);
  const setActiveModulesTab = useIoTStore((state) => state.setActiveModulesTab);

  const targetPlaceholder = targetPlaceholderId
    ? segments.find((seg) => seg.id === targetPlaceholderId)
    : undefined;

  return (
    <div className="space-y-3 sm:space-y-4">
      <MobileSubsectionTabs
        items={MODULES_TABS}
        activeId={activeModulesTab}
        onSelect={setActiveModulesTab}
        ariaLabel="زیربخش‌های پالایه و ماژول‌ها"
      />

      {targetPlaceholder && (
        <Alert
          variant="info"
          className="!flex !flex-wrap !items-center !justify-between !gap-3 !border-accent3-medium !bg-accent3-transparent text-sm text-text-primary"
        >
          <span>
            {targetPlaceholder.isVirtual && targetPlaceholder.nodeId
              ? "در حال تخصیص قطعه جدید به برد کمکی در گروه "
              : "در حال تخصیص قطعه به جایگاه خالی در گروه "}
            <strong className="font-bold">«{targetPlaceholder.group || "Test"}»</strong>
          </span>
          <button
            type="button"
            onClick={() => {
              clearTargetPlaceholder();
              setActiveWorkspaceView("home");
            }}
            className="cursor-pointer rounded-md border border-border-color bg-card-bg px-3 py-1 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
          >
            انصراف و بازگشت
          </button>
        </Alert>
      )}

      {/* React 19.3 Activity preserves in-progress AddSegmentForm inputs while checking SegmentList */}
      <Activity mode={activeModulesTab === "add" ? "visible" : "hidden"}>
        <div className="min-w-0">
          <AddSegmentForm
            onAddSegment={handleAddSegment}
            onClose={() => {
              if (targetPlaceholderId) {
                setActiveWorkspaceView("home");
              }
            }}
            segments={segments}
            animationsEnabled={animationsEnabled}
            targetPlaceholder={targetPlaceholder}
          />
        </div>
      </Activity>

      <Activity mode={activeModulesTab === "list" ? "visible" : "hidden"}>
        <div className="min-w-0 sm:bezel-shell">
          <div className="bezel-core min-w-0 p-3 sm:p-4 @md/workspace:p-5">
            <SegmentList segments={segments} onRemoveSegment={handleRemoveSegment} />
          </div>
        </div>
      </Activity>
    </div>
  );
}

function AutomationsWorkspace() {
  const activeAutomationsTab = useIoTStore((state) => state.activeAutomationsTab);
  const setActiveAutomationsTab = useIoTStore((state) => state.setActiveAutomationsTab);

  return (
    <div className="space-y-5">
      <MobileSubsectionTabs
        items={AUTOMATIONS_TABS}
        activeId={activeAutomationsTab}
        onSelect={setActiveAutomationsTab}
        ariaLabel="زیربخش‌های اتوماسیون‌ها"
      />

      <AutomationProvider>
        <div className="min-w-0">
          {/* React 19.3 Activity preserves in-progress AutomationForm state when browsing existing rules */}
          <Activity mode={activeAutomationsTab === "create" ? "visible" : "hidden"}>
            <AutomationForm />
          </Activity>
          <Activity mode={activeAutomationsTab === "manage" ? "visible" : "hidden"}>
            <AutomationList />
          </Activity>
        </div>
      </AutomationProvider>
    </div>
  );
}

function WorkflowsCanvasSection() {
  const { handleTogglePin, handleSetPinState } = useDashboardActions();

  return (
    <div className="relative flex size-full min-h-0 flex-1 flex-col overflow-hidden">
      <WorkflowStudio onTogglePin={handleTogglePin} onSetPinState={handleSetPinState} />
    </div>
  );
}

function ActiveSettingsPanel({ activeTab }: { activeTab: string }) {
  const animationsEnabled = useIoTStore((state) => state.animationsEnabled);
  const setAnimationsEnabled = useIoTStore((state) => state.setAnimationsEnabled);
  const animationsFps = useIoTStore((state) => state.animationsFps);
  const setAnimationsFps = useIoTStore((state) => state.setAnimationsFps);
  const headerTitle = useIoTStore((state) => state.headerTitle);
  const setHeaderTitle = useIoTStore((state) => state.setHeaderTitle);
  const isDark = useIoTStore((state) => state.isDark);

  switch (resolveSettingsTabId(activeTab)) {
    case "colors":
      return <ColorsSection />;
    case "mqtt":
      return <MqttSection />;
    case "wifi":
      return <WifiSection />;
    case "audio":
      return <AudioSection />;
    case "conditions":
      return <ConditionsSection />;
    case "voice":
      return <VoiceCommandsSection />;
    case "macros":
      return <MacrosSection />;
    case "stability":
      return (
        <InlineStabilitySection
          animationsEnabled={animationsEnabled}
          setAnimationsEnabled={setAnimationsEnabled}
          animationsFps={animationsFps}
          setAnimationsFps={setAnimationsFps}
          isDark={isDark}
        />
      );
    default:
      return <LayoutSection headerTitle={headerTitle} setHeaderTitle={setHeaderTitle} />;
  }
}

function SettingsWorkspace() {
  const rawActiveTab = useIoTStore((state) => state.activeSettingsTab);
  const setActiveTab = useIoTStore((state) => state.setActiveSettingsTab);
  const activeTab = resolveSettingsTabId(rawActiveTab);
  const deferredActiveTab = useDeferredValue(activeTab);

  const activeSettings = SETTINGS_TABS.find((tab) => tab.id === activeTab) ?? SETTINGS_TABS[0];

  return (
    <div className="min-w-0 space-y-3 sm:space-y-4">
      <MobileSubsectionTabs
        items={SETTINGS_TABS}
        activeId={activeTab}
        onSelect={setActiveTab}
        ariaLabel="دسته‌بندی تنظیمات"
      />

      <div className="min-w-0 sm:bezel-shell">
        <Card
          aria-label={activeSettings.title}
          className="@container/settings-card bezel-core min-w-0 !gap-0 !overflow-visible !py-0 !ring-0"
        >
          <CardContent className="min-w-0 p-3.5 sm:p-5 @md/settings-card:p-6">
            <ActiveSettingsPanel activeTab={deferredActiveTab} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
