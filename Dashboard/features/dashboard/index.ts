export { default as DashboardContainer } from "./components/layout/DashboardContainer";
export { DashboardContext, DashboardProvider, useDashboard } from "./context/DashboardContext";
export {
  SETTINGS_TABS,
  WORKSPACE_VIEW_META,
  resolveSettingsTabId,
  type SettingsTabId,
  type SettingsTabMeta,
  type WorkspaceViewMeta,
} from "./navigation";
