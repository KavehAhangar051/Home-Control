"use client";

import dynamic from "next/dynamic";
import { Alert } from "@/components/reui/alert";
import { Clock3 } from "@/components/ui/hugeicons";
import { useDashboard } from "@/features/dashboard/context/DashboardContext";
import {
  AUTOMATIONS_TABS,
  MODULES_TABS,
  resolveSettingsTabId,
  SETTINGS_TABS,
  WORKSPACE_VIEW_META,
} from "@/features/dashboard/navigation";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";

const PanelSkeleton = () => (
  <div className="h-48 w-full animate-pulse rounded-xl border border-[var(--border-color)] bg-[var(--card-hover-bg)]/50" />
);

const AutomationForm = dynamic(
  () => import("@/features/iot/components/AutomationsDrawer/components/AutomationForm"),
  { ssr: false, loading: PanelSkeleton },
);

const AutomationList = dynamic(
  () => import("@/features/iot/components/AutomationsDrawer/components/AutomationList"),
  { ssr: false, loading: PanelSkeleton },
);

const AutomationProvider = dynamic(
  () =>
    import("@/features/iot/components/AutomationsDrawer/context/AutomationContext").then(
      (mod) => mod.AutomationProvider,
    ),
  { ssr: false },
);

const AddSegmentForm = dynamic(
  () => import("@/features/iot/components/modules-drawer/components/AddSegmentForm"),
  { ssr: false, loading: PanelSkeleton },
);

const SegmentList = dynamic(
  () => import("@/features/iot/components/modules-drawer/components/SegmentList"),
  { ssr: false, loading: PanelSkeleton },
);

const AudioSection = dynamic(
  () => import("@/features/settings/components/audio-section/AudioSection"),
  { ssr: false, loading: PanelSkeleton },
);

const ColorsSection = dynamic(
  () => import("@/features/settings/components/colors-section/ColorsSection"),
  { ssr: false, loading: PanelSkeleton },
);

const ConditionsSection = dynamic(
  () => import("@/features/settings/components/conditions-section/ConditionsSection"),
  { ssr: false, loading: PanelSkeleton },
);

const LayoutSection = dynamic(
  () => import("@/features/settings/components/layout-section/LayoutSection"),
  { ssr: false, loading: PanelSkeleton },
);

const MqttSection = dynamic(
  () => import("@/features/settings/components/mqtt-section/MqttSection"),
  { ssr: false, loading: PanelSkeleton },
);

const InlineStabilitySection = dynamic(
  () =>
    import("@/features/settings/components/StabilitySection").then(
      (mod) => mod.InlineStabilitySection,
    ),
  { ssr: false, loading: PanelSkeleton },
);

const VoiceCommandsSection = dynamic(
  () => import("@/features/settings/components/voice-commands-section/VoiceCommandsSection"),
  { ssr: false, loading: PanelSkeleton },
);

const WifiSection = dynamic(
  () => import("@/features/settings/components/wifi-section/WifiSection"),
  { ssr: false, loading: PanelSkeleton },
);

type WorkspaceSectionView = "modules" | "automations" | "settings";

function useActiveSubsectionLabel(view: WorkspaceSectionView): string {
  const activeModulesTab = useIoTStore((state) => state.activeModulesTab);
  const activeAutomationsTab = useIoTStore((state) => state.activeAutomationsTab);
  const rawActiveSettingsTab = useIoTStore((state) => state.activeSettingsTab);

  if (view === "modules") {
    return MODULES_TABS.find((t) => t.id === activeModulesTab)?.title ?? MODULES_TABS[0].title;
  }

  if (view === "automations") {
    return (
      AUTOMATIONS_TABS.find((t) => t.id === activeAutomationsTab)?.title ??
      AUTOMATIONS_TABS[0].title
    );
  }

  const resolvedSettingsTab = resolveSettingsTabId(rawActiveSettingsTab);

  return SETTINGS_TABS.find((t) => t.id === resolvedSettingsTab)?.title ?? SETTINGS_TABS[0].title;
}

export default function WorkspaceSection({ view }: { view: WorkspaceSectionView }) {
  const meta = WORKSPACE_VIEW_META[view];
  const Icon = meta.sectionIcon;
  const activeSubsectionTitle = useActiveSubsectionLabel(view);

  return (
    <section
      className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 text-right sm:px-6 sm:py-10 lg:py-12"
      dir="rtl"
    >
      <header className="flex flex-col gap-3 border-b border-[var(--border-color)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--accent3)]">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold leading-7 text-balance text-[var(--text-primary)] sm:text-2xl">
              {meta.title}
            </h1>
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              {meta.description}
            </p>
          </div>
        </div>
        <span className="text-xs font-medium text-[var(--text-secondary)]">
          {activeSubsectionTitle}
        </span>
      </header>

      {view === "modules" && <ModulesWorkspace />}
      {view === "automations" && <AutomationsWorkspace />}
      {view === "settings" && <SettingsWorkspace />}
    </section>
  );
}

function MobileSubsectionTabs<T extends string>({
  items,
  activeId,
  onSelect,
  ariaLabel,
}: {
  items: ReadonlyArray<{ id: T; compactTitle: string }>;
  activeId: T;
  onSelect: (id: T) => void;
  ariaLabel: string;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className="min-w-0 overflow-x-auto rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-1.5 md:hidden"
    >
      <div className="flex min-w-max gap-1.5">
        {items.map((tab) => {
          const isActive = tab.id === activeId;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelect(tab.id)}
              aria-current={isActive ? "page" : undefined}
              className={`min-h-10 cursor-pointer rounded-lg border px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "border-[var(--accent3)] bg-[var(--card-hover-bg)] text-[var(--text-primary)]"
                  : "border-transparent text-[var(--text-secondary)] hover:bg-[var(--card-hover-bg)] hover:text-[var(--text-primary)]"
              }`}
            >
              {tab.compactTitle}
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
    <div className="space-y-4">
      <MobileSubsectionTabs
        items={MODULES_TABS}
        activeId={activeModulesTab}
        onSelect={setActiveModulesTab}
        ariaLabel="زیربخش‌های پالایه و ماژول‌ها"
      />

      {targetPlaceholder && (
        <Alert
          variant="info"
          className="!flex !flex-wrap !items-center !justify-between !gap-3 !border-[var(--accent3-medium)] !bg-[var(--accent3-transparent)] text-sm text-[var(--text-primary)]"
        >
          <span>
            در حال تخصیص قطعه به جایگاه خالی در گروه{" "}
            <strong className="font-bold">«{targetPlaceholder.group || "Test"}»</strong>
          </span>
          <button
            type="button"
            onClick={() => {
              clearTargetPlaceholder();
              setActiveWorkspaceView("home");
            }}
            className="cursor-pointer rounded-md border border-[var(--border-color)] bg-[var(--card-bg)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            انصراف و بازگشت
          </button>
        </Alert>
      )}

      {activeModulesTab === "add" ? (
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
          />
        </div>
      ) : (
        <div className="min-w-0 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] p-4 sm:p-5">
          <SegmentList segments={segments} onRemoveSegment={handleRemoveSegment} />
        </div>
      )}
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

      <Alert
        variant="info"
        className="!flex !items-start !gap-3 !border-[var(--border-color)] !bg-[var(--card-bg)] text-sm leading-6 text-[var(--text-secondary)]"
      >
        <Clock3 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          {activeAutomationsTab === "create"
            ? "زمان‌بندی، تایمر یا شرط دمایی جدید را تنظیم و ذخیره کنید."
            : "اتوماسیون‌های ثبت‌شده را مشاهده، ویرایش و فعال یا غیرفعال کنید."}
        </p>
      </Alert>

      <AutomationProvider>
        <div className="min-w-0">
          {activeAutomationsTab === "create" ? <AutomationForm /> : <AutomationList />}
        </div>
      </AutomationProvider>
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

  const activeSettings = SETTINGS_TABS.find((tab) => tab.id === activeTab) ?? SETTINGS_TABS[0];

  return (
    <div className="space-y-4">
      <MobileSubsectionTabs
        items={SETTINGS_TABS}
        activeId={activeTab}
        onSelect={setActiveTab}
        ariaLabel="دسته‌بندی تنظیمات"
      />

      <section
        aria-labelledby="active-settings-heading"
        className="min-w-0 overflow-visible rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)]"
      >
        <header className="border-b border-[var(--border-color)] px-4 py-4 sm:px-6">
          <h2
            id="active-settings-heading"
            className="text-base font-semibold leading-6 text-[var(--text-primary)]"
          >
            {activeSettings.title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
            تنظیمات این بخش را از همین‌جا مدیریت کنید.
          </p>
        </header>
        <div className="min-w-0 p-4 sm:p-6">
          <ActiveSettingsPanel activeTab={activeTab} />
        </div>
      </section>
    </div>
  );
}
