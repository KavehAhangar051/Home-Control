"use client";

import React, { forwardRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import {
  Activity01Icon,
  Add01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
  CancelCircleIcon,
  CheckmarkCircle01Icon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  Clock01Icon,
  Clock03Icon,
  CloudLightningIcon,
  CloudUploadIcon,
  Delete02Icon,
  Download01Icon,
  Edit02Icon,
  FloppyDiskIcon,
  Globe02Icon,
  GripVerticalIcon,
  HardDriveIcon,
  House01Icon,
  HousePlugIcon,
  InformationCircleIcon,
  Layers01Icon,
  LightbulbIcon,
  MapPinIcon,
  Mic01Icon,
  Music01Icon,
  NetworkIcon,
  PanelLeftCloseIcon,
  PanelRightCloseIcon,
  PlayIcon,
  RefreshIcon,
  ServerIcon,
  Settings01Icon,
  Settings02Icon,
  SkipBackIcon,
  SkipForwardIcon,
  SlidersHorizontalIcon,
  StopIcon,
  ThermometerIcon,
  Tick02Icon,
  VolumeXIcon,
  Wifi01Icon,
  WifiOff01Icon,
  WorkflowCircle01Icon,
} from "@hugeicons/core-free-icons";

export interface HugeIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  strokeWidth?: number;
  color?: string;
  className?: string;
  animateOnHover?: boolean;
}

export type HugeIconComponent = React.ForwardRefExoticComponent<
  HugeIconProps & React.RefAttributes<SVGSVGElement>
>;

/**
 * Creates a standard React icon component based on Hugeicons geometry.
 * Supports smooth animation and responsive styling via Tailwind CSS.
 */
export function createHugeIcon(
  icon: IconSvgElement,
  displayName?: string
): HugeIconComponent {
  const Component = forwardRef<SVGSVGElement, HugeIconProps>(
    (
      {
        size = 24,
        strokeWidth = 2,
        className = "",
        animateOnHover = false,
        ...props
      },
      ref
    ) => {
      return (
        <HugeiconsIcon
          ref={ref as any}
          icon={icon}
          size={size}
          strokeWidth={strokeWidth}
          className={`${className} ${
            animateOnHover
              ? "transition-transform duration-200 hover:scale-110 active:scale-95"
              : ""
          }`}
          {...props}
        />
      );
    }
  );

  if (displayName) {
    Component.displayName = displayName;
  }

  return Component;
}

// Navigation & Layout Icons
export const House = createHugeIcon(House01Icon, "House");
export const HousePlug = createHugeIcon(HousePlugIcon, "HousePlug");
export const Clock = createHugeIcon(Clock01Icon, "Clock");
export const Clock3 = createHugeIcon(Clock03Icon, "Clock3");
export const Settings = createHugeIcon(Settings01Icon, "Settings");
export const Settings2 = createHugeIcon(Settings02Icon, "Settings2");
export const Layers = createHugeIcon(Layers01Icon, "Layers");
export const PanelRightClose = createHugeIcon(PanelRightCloseIcon, "PanelRightClose");
export const PanelLeftClose = createHugeIcon(PanelLeftCloseIcon, "PanelLeftClose");

// Arrows & Chevrons
export const ChevronLeft = createHugeIcon(ChevronLeftIcon, "ChevronLeft");
export const ChevronRight = createHugeIcon(ChevronRightIcon, "ChevronRight");
export const ChevronDown = createHugeIcon(ChevronDownIcon, "ChevronDown");
export const ChevronUp = createHugeIcon(ChevronUpIcon, "ChevronUp");
export const ArrowUp = createHugeIcon(ArrowUp01Icon, "ArrowUp");

// Actions & Controls
export const Plus = createHugeIcon(Add01Icon, "Plus");
export const X = createHugeIcon(Cancel01Icon, "X");
export const Check = createHugeIcon(Tick02Icon, "Check");
export const CheckCircle = createHugeIcon(CheckmarkCircle01Icon, "CheckCircle");
export const XCircle = createHugeIcon(CancelCircleIcon, "XCircle");
export const Trash2 = createHugeIcon(Delete02Icon, "Trash2");
export const Edit2 = createHugeIcon(Edit02Icon, "Edit2");
export const Play = createHugeIcon(PlayIcon, "Play");
export const Square = createHugeIcon(StopIcon, "Square");
export const GripVertical = createHugeIcon(GripVerticalIcon, "GripVertical");
export const Sliders = createHugeIcon(SlidersHorizontalIcon, "Sliders");
export const RefreshCw = createHugeIcon(RefreshIcon, "RefreshCw");
export const Save = createHugeIcon(FloppyDiskIcon, "Save");

// Communication & Media
export const Mic = createHugeIcon(Mic01Icon, "Mic");
export const Music = createHugeIcon(Music01Icon, "Music");
export const SkipBack = createHugeIcon(SkipBackIcon, "SkipBack");
export const SkipForward = createHugeIcon(SkipForwardIcon, "SkipForward");
export const VolumeX = createHugeIcon(VolumeXIcon, "VolumeX");
export const Download = createHugeIcon(Download01Icon, "Download");

// Network, System & Sensors
export const Wifi = createHugeIcon(Wifi01Icon, "Wifi");
export const WifiOff = createHugeIcon(WifiOff01Icon, "WifiOff");
export const Globe = createHugeIcon(Globe02Icon, "Globe");
export const Server = createHugeIcon(ServerIcon, "Server");
export const HardDrive = createHugeIcon(HardDriveIcon, "HardDrive");
export const CloudLightning = createHugeIcon(CloudLightningIcon, "CloudLightning");
export const CloudUpload = createHugeIcon(CloudUploadIcon, "CloudUpload");
export const Activity = createHugeIcon(Activity01Icon, "Activity");
export const Thermometer = createHugeIcon(ThermometerIcon, "Thermometer");
export const Info = createHugeIcon(InformationCircleIcon, "Info");
export const MapPin = createHugeIcon(MapPinIcon, "MapPin");
export const Lightbulb = createHugeIcon(LightbulbIcon, "Lightbulb");
export const Network = createHugeIcon(NetworkIcon, "Network");
export const Workflow = createHugeIcon(WorkflowCircle01Icon, "Workflow");

// Also export with Hugeicons canonical naming
export {
  House01Icon,
  Clock01Icon,
  Settings01Icon,
  Mic01Icon,
  Wifi01Icon,
  Add01Icon,
  Cancel01Icon,
};
