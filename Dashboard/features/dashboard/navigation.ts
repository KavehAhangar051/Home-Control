import {
  Clock3,
  House,
  Layers,
  Settings,
  Settings2,
  type HugeIconComponent,
} from "@/components/ui/hugeicons";
import type { WorkspaceView } from "@/features/iot/hooks/store/types";

export interface WorkspaceViewMeta {
  id: WorkspaceView;
  title: string;
  description: string;
  navIcon: HugeIconComponent;
  sectionIcon: HugeIconComponent;
}

/**
 * Single authoritative source of truth for workspace view labels, descriptions, and icons.
 * Used across sidebar navigation, breadcrumbs, and workspace section headers (DRY).
 */
export const WORKSPACE_VIEW_META: Record<WorkspaceView, WorkspaceViewMeta> = {
  home: {
    id: "home",
    title: "داشبورد خانه",
    description: "نمای کلی و کنترل مستقیم تجهیزات خانه",
    navIcon: House,
    sectionIcon: House,
  },
  modules: {
    id: "modules",
    title: "پالایه و ماژول‌ها",
    description: "افزودن، مشاهده و مدیریت سگمنت‌های متصل به خانه",
    navIcon: Layers,
    sectionIcon: Layers,
  },
  automations: {
    id: "automations",
    title: "اتوماسیون‌ها",
    description: "زمان‌بندی، شرط‌ها و عملیات خودکار خانه را مدیریت کنید",
    navIcon: Clock3,
    sectionIcon: Clock3,
  },
  settings: {
    id: "settings",
    title: "تنظیمات اصلی",
    description: "تنظیمات ظاهری، ارتباطی و رفتار داشبورد",
    navIcon: Settings,
    sectionIcon: Settings2,
  },
};

export type SettingsTabId =
  | "layout"
  | "mqtt"
  | "wifi"
  | "audio"
  | "conditions"
  | "voice"
  | "stability";

export interface SettingsTabMeta {
  id: SettingsTabId;
  title: string;
  compactTitle: string;
}

/**
 * Authoritative registry of settings tabs and their display labels.
 */
export const SETTINGS_TABS: readonly SettingsTabMeta[] = [
  { id: "layout", title: "چیدمان و عنوان", compactTitle: "چیدمان" },
  { id: "mqtt", title: "ارتباط MQTT", compactTitle: "ارتباط MQTT" },
  { id: "wifi", title: "شبکه‌های وای‌فای", compactTitle: "وای‌فای" },
  { id: "audio", title: "صدا و موسیقی", compactTitle: "صدا" },
  { id: "conditions", title: "شرط‌ها و ورودی‌ها", compactTitle: "شرط‌ها" },
  { id: "voice", title: "دستورات صوتی", compactTitle: "دستورات صوتی" },
  { id: "stability", title: "پایداری و بهینه‌سازی", compactTitle: "پایداری" },
] as const;

/**
 * Normalizes legacy or alias settings tab identifiers (e.g. "voice-commands" -> "voice")
 * to guarantee a valid SettingsTabId contract.
 */
export function resolveSettingsTabId(tab: string): SettingsTabId {
  if (tab === "voice-commands") return "voice";
  const matched = SETTINGS_TABS.find((item) => item.id === tab);
  return matched ? matched.id : "layout";
}
