import { Activity01 } from "@/components/animate-ui/icons/hugeicons/activity-01";
import { Airplay } from "@/components/animate-ui/icons/hugeicons/airplay";
import { BatteryCharging } from "@/components/animate-ui/icons/hugeicons/battery-charging";
import { BatteryFull } from "@/components/animate-ui/icons/hugeicons/battery-full";
import { Bluetooth } from "@/components/animate-ui/icons/hugeicons/bluetooth";
import { Bookmark } from "@/components/animate-ui/icons/hugeicons/bookmark";
import { Bot } from "@/components/animate-ui/icons/hugeicons/bot";
import { Camera } from "@/components/animate-ui/icons/hugeicons/camera";
import { Cancel01 } from "@/components/animate-ui/icons/hugeicons/cancel-01";
import { Cast } from "@/components/animate-ui/icons/hugeicons/cast";
import { Check as CheckIcon } from "@/components/animate-ui/icons/hugeicons/check";
import { CircuitBoard } from "@/components/animate-ui/icons/hugeicons/circuit-board";
import { Clapperboard } from "@/components/animate-ui/icons/hugeicons/clapperboard";
import { Clock01 } from "@/components/animate-ui/icons/hugeicons/clock-01";
import { CloudRain } from "@/components/animate-ui/icons/hugeicons/cloud-rain";
import { CloudRainWind } from "@/components/animate-ui/icons/hugeicons/cloud-rain-wind";
import { Coffee02 } from "@/components/animate-ui/icons/hugeicons/coffee-02";
import { ComputerTerminal01 } from "@/components/animate-ui/icons/hugeicons/computer-terminal-01";
import { Droplet } from "@/components/animate-ui/icons/hugeicons/droplet";
import { Fan } from "@/components/animate-ui/icons/hugeicons/fan";
import { Flame } from "@/components/animate-ui/icons/hugeicons/flame";
import { Flash } from "@/components/animate-ui/icons/hugeicons/flash";
import { Home03 } from "@/components/animate-ui/icons/hugeicons/home-03";
import { Key01 } from "@/components/animate-ui/icons/hugeicons/key-01";
import { Layers01 } from "@/components/animate-ui/icons/hugeicons/layers-01";
import { Leaf } from "@/components/animate-ui/icons/hugeicons/leaf";
import { Lightbulb } from "@/components/animate-ui/icons/hugeicons/lightbulb";
import { Location01 } from "@/components/animate-ui/icons/hugeicons/location-01";
import { LockKeyhole } from "@/components/animate-ui/icons/hugeicons/lock-keyhole";
import { LockKeyholeOpen } from "@/components/animate-ui/icons/hugeicons/lock-keyhole-open";
import { Menu01 } from "@/components/animate-ui/icons/hugeicons/menu-01";
import { Mic } from "@/components/animate-ui/icons/hugeicons/mic";
import { Moon02 } from "@/components/animate-ui/icons/hugeicons/moon-02";
import { Music3 } from "@/components/animate-ui/icons/hugeicons/music-3";
import { Notification01 } from "@/components/animate-ui/icons/hugeicons/notification-01";
import { Pause } from "@/components/animate-ui/icons/hugeicons/pause";
import { Phone } from "@/components/animate-ui/icons/hugeicons/phone";
import { PhoneCall } from "@/components/animate-ui/icons/hugeicons/phone-call";
import { PlaneTakeoff } from "@/components/animate-ui/icons/hugeicons/plane-takeoff";
import { Play } from "@/components/animate-ui/icons/hugeicons/play";
import { Power } from "@/components/animate-ui/icons/hugeicons/power";
import { Radio } from "@/components/animate-ui/icons/hugeicons/radio";
import { Refresh } from "@/components/animate-ui/icons/hugeicons/refresh";
import { Search01 } from "@/components/animate-ui/icons/hugeicons/search-01";
import { Settings02 } from "@/components/animate-ui/icons/hugeicons/settings-02";
import { ShieldCheck } from "@/components/animate-ui/icons/hugeicons/shield-check";
import { Snowflake } from "@/components/animate-ui/icons/hugeicons/snowflake";
import { SquareX } from "@/components/animate-ui/icons/hugeicons/square-x";
import { Sun03 } from "@/components/animate-ui/icons/hugeicons/sun-03";
import { Temperature } from "@/components/animate-ui/icons/hugeicons/temperature";
import { Timer } from "@/components/animate-ui/icons/hugeicons/timer";
import { View } from "@/components/animate-ui/icons/hugeicons/view";
import { VolumeHigh } from "@/components/animate-ui/icons/hugeicons/volume-high";
import { Waves } from "@/components/animate-ui/icons/hugeicons/waves";
import { Wifi01 } from "@/components/animate-ui/icons/hugeicons/wifi-01";
import { createHugeIcon, type HugeIconComponent } from "@/components/ui/hugeicons";

export const ICON_MAP = {
  Cpu: createHugeIcon(CircuitBoard, "Cpu"),
  Lightbulb: createHugeIcon(Lightbulb, "Lightbulb"),
  Zap: createHugeIcon(Flash, "Zap"),
  Power: createHugeIcon(Power, "Power"),
  Fan: createHugeIcon(Fan, "Fan"),
  Droplets: createHugeIcon(Droplet, "Droplets"),
  Droplet: createHugeIcon(Droplet, "Droplet"),
  Thermometer: createHugeIcon(Temperature, "Thermometer"),
  ThermometerSun: createHugeIcon(Temperature, "ThermometerSun"),
  Lock: createHugeIcon(LockKeyhole, "Lock"),
  Unlock: createHugeIcon(LockKeyholeOpen, "Unlock"),
  Key: createHugeIcon(Key01, "Key"),
  Shield: createHugeIcon(ShieldCheck, "Shield"),
  Bell: createHugeIcon(Notification01, "Bell"),
  Camera: createHugeIcon(Camera, "Camera"),
  Video: createHugeIcon(Clapperboard, "Video"),
  Tv: createHugeIcon(Cast, "Tv"),
  Monitor: createHugeIcon(ComputerTerminal01, "Monitor"),
  Smartphone: createHugeIcon(Phone, "Smartphone"),
  Phone: createHugeIcon(PhoneCall, "Phone"),
  Speaker: createHugeIcon(VolumeHigh, "Speaker"),
  Volume2: createHugeIcon(VolumeHigh, "Volume2"),
  Mic: createHugeIcon(Mic, "Mic"),
  Music: createHugeIcon(Music3, "Music"),
  Radio: createHugeIcon(Radio, "Radio"),
  Airplay: createHugeIcon(Airplay, "Airplay"),
  Wifi: createHugeIcon(Wifi01, "Wifi"),
  Bluetooth: createHugeIcon(Bluetooth, "Bluetooth"),
  Sun: createHugeIcon(Sun03, "Sun"),
  Moon: createHugeIcon(Moon02, "Moon"),
  Cloud: createHugeIcon(CloudRain, "Cloud"),
  Wind: createHugeIcon(CloudRainWind, "Wind"),
  Flame: createHugeIcon(Flame, "Flame"),
  Snowflake: createHugeIcon(Snowflake, "Snowflake"),
  Waves: createHugeIcon(Waves, "Waves"),
  Sprout: createHugeIcon(Leaf, "Sprout"),
  Leaf: createHugeIcon(Leaf, "Leaf"),
  Home: createHugeIcon(Home03, "Home"),
  Car: createHugeIcon(PlaneTakeoff, "Car"),
  Settings: createHugeIcon(Settings02, "Settings"),
  Activity: createHugeIcon(Activity01, "Activity"),
  Layers: createHugeIcon(Layers01, "Layers"),
  Battery: createHugeIcon(BatteryCharging, "Battery"),
  BatteryFull: createHugeIcon(BatteryFull, "BatteryFull"),
  Clock: createHugeIcon(Clock01, "Clock"),
  Timer: createHugeIcon(Timer, "Timer"),
  Eye: createHugeIcon(View, "Eye"),
  MapPin: createHugeIcon(Location01, "MapPin"),
  Book: createHugeIcon(Bookmark, "Book"),
  Coffee: createHugeIcon(Coffee02, "Coffee"),
  Server: createHugeIcon(ComputerTerminal01, "Server"),
  Gamepad2: createHugeIcon(Bot, "Gamepad2"),
  Play: createHugeIcon(Play, "Play"),
  Pause: createHugeIcon(Pause, "Pause"),
  Square: createHugeIcon(SquareX, "Square"),
  Check: createHugeIcon(CheckIcon, "Check"),
  RefreshCw: createHugeIcon(Refresh, "RefreshCw"),
  X: createHugeIcon(Cancel01, "X"),
  Menu: createHugeIcon(Menu01, "Menu"),
  Search: createHugeIcon(Search01, "Search"),
} satisfies Record<string, HugeIconComponent>;

export const hasIcon = (icon?: string): boolean => Boolean(icon && icon in ICON_MAP);

export const getSegmentIcon = (icon?: string): HugeIconComponent => {
  if (icon && icon in ICON_MAP) {
    // SAFETY: verified key membership in ICON_MAP via in operator
    return ICON_MAP[icon as keyof typeof ICON_MAP];
  }

  return ICON_MAP.Cpu;
};

export const AVAILABLE_ICONS = Object.keys(ICON_MAP);

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
