"use client";

import { createElement, memo, useEffect, useSyncExternalStore } from "react";
import { CircuitBoard } from "@/components/animate-ui/icons/hugeicons/circuit-board";
import { Layers01 } from "@/components/animate-ui/icons/hugeicons/layers-01";
import {
  createHugeIcon,
  type HugeIconComponent,
  type HugeIconProps,
} from "@/components/ui/hugeicon-factory";
import { cn } from "@/lib/utils";
import { createLazyIconRegistry, type IconLoader } from "./iconRegistry";

const CpuIcon = createHugeIcon(CircuitBoard, "Cpu");
const LayersIcon = createHugeIcon(Layers01, "Layers");

const STATIC_ICONS = {
  Cpu: CpuIcon,
  Layers: LayersIcon,
} satisfies Record<string, HugeIconComponent>;

const lazy = <TMod>(
  importFn: () => Promise<TMod>,
  pick: (mod: TMod) => Parameters<typeof createHugeIcon>[0],
  displayName: string,
): IconLoader<HugeIconComponent> => {
  return async () => createHugeIcon(pick(await importFn()), displayName);
};

const LAZY_ICON_LOADERS = {
  Lightbulb: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/lightbulb"),
    (m) => m.Lightbulb,
    "Lightbulb",
  ),
  Zap: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/flash"),
    (m) => m.Flash,
    "Zap",
  ),
  Power: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/power"),
    (m) => m.Power,
    "Power",
  ),
  Fan: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/fan"),
    (m) => m.Fan,
    "Fan",
  ),
  Droplets: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/droplet"),
    (m) => m.Droplet,
    "Droplets",
  ),
  Droplet: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/droplet"),
    (m) => m.Droplet,
    "Droplet",
  ),
  Thermometer: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/temperature"),
    (m) => m.Temperature,
    "Thermometer",
  ),
  ThermometerSun: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/temperature"),
    (m) => m.Temperature,
    "ThermometerSun",
  ),
  Lock: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/lock-keyhole"),
    (m) => m.LockKeyhole,
    "Lock",
  ),
  Unlock: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/lock-keyhole-open"),
    (m) => m.LockKeyholeOpen,
    "Unlock",
  ),
  Key: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/key-01"),
    (m) => m.Key01,
    "Key",
  ),
  Shield: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/shield-check"),
    (m) => m.ShieldCheck,
    "Shield",
  ),
  Bell: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/notification-01"),
    (m) => m.Notification01,
    "Bell",
  ),
  Camera: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/camera"),
    (m) => m.Camera,
    "Camera",
  ),
  Video: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/clapperboard"),
    (m) => m.Clapperboard,
    "Video",
  ),
  Tv: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/cast"),
    (m) => m.Cast,
    "Tv",
  ),
  Monitor: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/computer-terminal-01"),
    (m) => m.ComputerTerminal01,
    "Monitor",
  ),
  Smartphone: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/phone"),
    (m) => m.Phone,
    "Smartphone",
  ),
  Phone: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/phone-call"),
    (m) => m.PhoneCall,
    "Phone",
  ),
  Speaker: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/volume-high"),
    (m) => m.VolumeHigh,
    "Speaker",
  ),
  Volume2: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/volume-high"),
    (m) => m.VolumeHigh,
    "Volume2",
  ),
  Mic: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/mic"),
    (m) => m.Mic,
    "Mic",
  ),
  Music: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/music-3"),
    (m) => m.Music3,
    "Music",
  ),
  Radio: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/radio"),
    (m) => m.Radio,
    "Radio",
  ),
  Airplay: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/airplay"),
    (m) => m.Airplay,
    "Airplay",
  ),
  Wifi: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/wifi-01"),
    (m) => m.Wifi01,
    "Wifi",
  ),
  Bluetooth: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/bluetooth"),
    (m) => m.Bluetooth,
    "Bluetooth",
  ),
  Sun: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/sun-03"),
    (m) => m.Sun03,
    "Sun",
  ),
  Moon: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/moon-02"),
    (m) => m.Moon02,
    "Moon",
  ),
  Cloud: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/cloud-rain"),
    (m) => m.CloudRain,
    "Cloud",
  ),
  Wind: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/cloud-rain-wind"),
    (m) => m.CloudRainWind,
    "Wind",
  ),
  Flame: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/flame"),
    (m) => m.Flame,
    "Flame",
  ),
  Snowflake: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/snowflake"),
    (m) => m.Snowflake,
    "Snowflake",
  ),
  Waves: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/waves"),
    (m) => m.Waves,
    "Waves",
  ),
  Sprout: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/leaf"),
    (m) => m.Leaf,
    "Sprout",
  ),
  Leaf: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/leaf"),
    (m) => m.Leaf,
    "Leaf",
  ),
  Home: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/home-03"),
    (m) => m.Home03,
    "Home",
  ),
  Car: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/plane-takeoff"),
    (m) => m.PlaneTakeoff,
    "Car",
  ),
  Settings: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/settings-02"),
    (m) => m.Settings02,
    "Settings",
  ),
  Activity: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/activity-01"),
    (m) => m.Activity01,
    "Activity",
  ),
  Battery: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/battery-charging"),
    (m) => m.BatteryCharging,
    "Battery",
  ),
  BatteryFull: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/battery-full"),
    (m) => m.BatteryFull,
    "BatteryFull",
  ),
  Clock: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/clock-01"),
    (m) => m.Clock01,
    "Clock",
  ),
  Timer: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/timer"),
    (m) => m.Timer,
    "Timer",
  ),
  Eye: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/view"),
    (m) => m.View,
    "Eye",
  ),
  MapPin: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/location-01"),
    (m) => m.Location01,
    "MapPin",
  ),
  Book: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/bookmark"),
    (m) => m.Bookmark,
    "Book",
  ),
  Coffee: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/coffee-02"),
    (m) => m.Coffee02,
    "Coffee",
  ),
  Server: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/computer-terminal-01"),
    (m) => m.ComputerTerminal01,
    "Server",
  ),
  Gamepad2: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/bot"),
    (m) => m.Bot,
    "Gamepad2",
  ),
  Play: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/play"),
    (m) => m.Play,
    "Play",
  ),
  Pause: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/pause"),
    (m) => m.Pause,
    "Pause",
  ),
  Square: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/square-x"),
    (m) => m.SquareX,
    "Square",
  ),
  Check: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/check"),
    (m) => m.Check,
    "Check",
  ),
  RefreshCw: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/refresh"),
    (m) => m.Refresh,
    "RefreshCw",
  ),
  X: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/cancel-01"),
    (m) => m.Cancel01,
    "X",
  ),
  Menu: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/menu-01"),
    (m) => m.Menu01,
    "Menu",
  ),
  Search: lazy(
    () => import("@/components/animate-ui/icons/hugeicons/search-01"),
    (m) => m.Search01,
    "Search",
  ),
} satisfies Record<string, IconLoader<HugeIconComponent>>;

const iconRegistry = createLazyIconRegistry<HugeIconComponent>(
  STATIC_ICONS,
  LAZY_ICON_LOADERS,
  "Cpu",
);

const getServerIconFallback = () => null;

function LazySegmentIcon({ iconKey, ...props }: HugeIconProps & { iconKey: string }) {
  const LoadedIcon = useSyncExternalStore(
    iconRegistry.subscribe,
    () => iconRegistry.getResolved(iconKey),
    getServerIconFallback,
  );

  useEffect(() => {
    if (!iconRegistry.getResolved(iconKey)) {
      void iconRegistry.loadIcon(iconKey);
    }
  }, [iconKey]);

  if (!LoadedIcon) {
    return createElement("span", {
      "aria-hidden": true,
      className: cn("inline-block shrink-0", props.className),
    });
  }

  return createElement(LoadedIcon, props);
}

function renderBoundSegmentIcon(this: string, props: HugeIconProps) {
  return createElement(LazySegmentIcon, { ...props, iconKey: this });
}

const LAZY_WRAPPER_CACHE = new Map<string, HugeIconComponent>();

const getLazyWrapper = (iconKey: string): HugeIconComponent => {
  const cached = LAZY_WRAPPER_CACHE.get(iconKey);

  if (cached) return cached;

  const wrapper = memo(renderBoundSegmentIcon.bind(iconKey));
  wrapper.displayName = `LazyHugeIcon(${iconKey})`;

  LAZY_WRAPPER_CACHE.set(iconKey, wrapper);

  return wrapper;
};

export interface SegmentIconMap {
  [key: string]: HugeIconComponent;
  Cpu: HugeIconComponent;
  Layers: HugeIconComponent;
}

/**
 * Compatibility map retaining direct `ICON_MAP.Cpu` / `ICON_MAP.Layers` synchronous access
 * while loading all other segment icons on demand.
 */
export const ICON_MAP: SegmentIconMap = {
  Cpu: CpuIcon,
  Layers: LayersIcon,
};

for (const key of Object.keys(LAZY_ICON_LOADERS)) {
  ICON_MAP[key] = getLazyWrapper(key);
}

export const hasIcon = (icon?: string): boolean => iconRegistry.hasIcon(icon);

export const getSegmentIcon = (icon?: string): HugeIconComponent => {
  if (icon && iconRegistry.hasIcon(icon)) {
    return iconRegistry.getResolved(icon) ?? getLazyWrapper(icon);
  }

  return CpuIcon;
};

export const preloadSegmentIcons = (icons: readonly string[]): void => {
  iconRegistry.preloadIcons(icons);
};

// Preserve the historical picker order (Cpu first, then the remaining 54 icons in order)
export const AVAILABLE_ICONS: string[] = [
  "Cpu",
  ...Object.keys(LAZY_ICON_LOADERS).slice(0, 38),
  "Layers",
  ...Object.keys(LAZY_ICON_LOADERS).slice(38),
];

export const SUGGESTED_EMOJIS = [
  "⚡",
  "🚀",
  "💡",
  "🌙",
  "☀️",
  "🔒",
  "🔓",
  "🎵",
  "🎬",
  "🚪",
  "🚿",
  "☕",
  "❄️",
  "🔥",
  "💨",
  "🌿",
  "🔔",
  "💤",
  "🎉",
  "🎥",
  "🚗",
  "🔌",
  "🔋",
  "📡",
  "🔦",
  "📱",
  "💻",
  "🖥️",
  "🖨️",
  "🕹️",
  "🎮",
  "📺",
  "📻",
  "🎙️",
  "🎚️",
  "🎛️",
  "🧭",
  "⏱️",
  "⏲️",
  "⏰",
  "🌡️",
  "☔",
  "💧",
  "🌊",
  "🌬️",
  "🌀",
  "🌈",
  "⭐",
  "🌟",
  "✨",
  "🏠",
  "🏡",
  "🏢",
  "🏣",
  "🏥",
  "🏦",
  "🏨",
  "🏩",
  "🏪",
  "🏫",
  "🛋️",
  "🛏️",
  "🛁",
  "🚽",
  "🪟",
  "🧸",
  "🖼️",
  "🛍️",
  "🛒",
  "🎁",
];
