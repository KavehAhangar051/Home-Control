import {
  Clock3,
  House,
  type HugeIconComponent,
  Layers,
  Settings,
  Settings2,
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

export type ModulesTabId = "add" | "list";

export interface ModulesTabMeta {
  id: ModulesTabId;
  title: string;
  compactTitle: string;
}

export const MODULES_TABS: readonly ModulesTabMeta[] = [
  { id: "add", title: "افزودن قطعه جدید", compactTitle: "افزودن قطعه" },
  { id: "list", title: "مدیریت و لیست قطعات", compactTitle: "لیست قطعات" },
] as const;

export type AutomationsTabId = "create" | "manage" | "workflows";

export interface AutomationsTabMeta {
  id: AutomationsTabId;
  title: string;
  compactTitle: string;
}

export const AUTOMATIONS_TABS: readonly AutomationsTabMeta[] = [
  { id: "create", title: "افزودن اتوماسیون جدید", compactTitle: "اتوماسیون جدید" },
  { id: "manage", title: "مدیریت اتوماسیون‌ها", compactTitle: "مدیریت اتوماسیون‌ها" },
  { id: "workflows", title: "گردش‌های کاری", compactTitle: "گردش‌های کاری" },
] as const;

export type SettingsTabId =
  | "layout"
  | "colors"
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
  { id: "colors", title: "شخصی‌سازی ظاهر و فونت داشبورد", compactTitle: "شخصی‌سازی داشبورد" },
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

  if (
    tab === "theme" ||
    tab === "color" ||
    tab === "font" ||
    tab === "fonts" ||
    tab === "appearance" ||
    tab === "personalization"
  )
    return "colors";
  const matched = SETTINGS_TABS.find((item) => item.id === tab);

  return matched ? matched.id : "layout";
}
