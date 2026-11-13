export { default as DashboardContainer } from "./components/layout/DashboardContainer";

export { DashboardProvider, useDashboard } from "./context/DashboardContext";

export {
  resolveSettingsTabId,
  SETTINGS_TABS,
  type SettingsTabId,
  type SettingsTabMeta,
  WORKSPACE_VIEW_META,
  type WorkspaceViewMeta,
} from "./navigation";
