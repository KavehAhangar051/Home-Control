"use client";

import React, { forwardRef } from "react";
import { Activity01 } from "@/components/animate-ui/icons/hugeicons/activity-01";
import { Add01 } from "@/components/animate-ui/icons/hugeicons/add-01";
import { ArrowDown01 } from "@/components/animate-ui/icons/hugeicons/arrow-down-01";
import { ArrowLeft01 } from "@/components/animate-ui/icons/hugeicons/arrow-left-01";
import { ArrowRight01 } from "@/components/animate-ui/icons/hugeicons/arrow-right-01";
import { ArrowUp01 } from "@/components/animate-ui/icons/hugeicons/arrow-up-01";
import { Bot } from "@/components/animate-ui/icons/hugeicons/bot";
import { Cancel01 } from "@/components/animate-ui/icons/hugeicons/cancel-01";
import { Check as CheckIcon } from "@/components/animate-ui/icons/hugeicons/check";
import { CheckmarkCircle02 } from "@/components/animate-ui/icons/hugeicons/checkmark-circle-02";
import { CircleX } from "@/components/animate-ui/icons/hugeicons/circle-x";
import { CircuitBoard } from "@/components/animate-ui/icons/hugeicons/circuit-board";
import { Clock01 } from "@/components/animate-ui/icons/hugeicons/clock-01";
import { Clock03 } from "@/components/animate-ui/icons/hugeicons/clock-03";
import { CloudLightning as CloudLightningIcon } from "@/components/animate-ui/icons/hugeicons/cloud-lightning";
import { CloudUpload as CloudUploadIcon } from "@/components/animate-ui/icons/hugeicons/cloud-upload";
import { ComputerTerminal01 } from "@/components/animate-ui/icons/hugeicons/computer-terminal-01";
import { Delete02 } from "@/components/animate-ui/icons/hugeicons/delete-02";
import { Download01 } from "@/components/animate-ui/icons/hugeicons/download-01";
import { Globe02 } from "@/components/animate-ui/icons/hugeicons/globe-02";
import { Home03 } from "@/components/animate-ui/icons/hugeicons/home-03";
import { Info as InfoIcon } from "@/components/animate-ui/icons/hugeicons/info";
import { Layers01 } from "@/components/animate-ui/icons/hugeicons/layers-01";
import { Lightbulb as LightbulbIcon } from "@/components/animate-ui/icons/hugeicons/lightbulb";
import { Location01 } from "@/components/animate-ui/icons/hugeicons/location-01";
import { Mic as MicIcon } from "@/components/animate-ui/icons/hugeicons/mic";
import { Moon02 } from "@/components/animate-ui/icons/hugeicons/moon-02";
import { MoreVertical } from "@/components/animate-ui/icons/hugeicons/more-vertical";
import { Music3 } from "@/components/animate-ui/icons/hugeicons/music-3";
import { PanelLeftClose as PanelLeftCloseIcon } from "@/components/animate-ui/icons/hugeicons/panel-left-close";
import { PanelRightClose as PanelRightCloseIcon } from "@/components/animate-ui/icons/hugeicons/panel-right-close";
import { PencilEdit02 } from "@/components/animate-ui/icons/hugeicons/pencil-edit-02";
import { Play as PlayIcon } from "@/components/animate-ui/icons/hugeicons/play";
import { PlugZap } from "@/components/animate-ui/icons/hugeicons/plug-zap";
import { Refresh as RefreshIcon } from "@/components/animate-ui/icons/hugeicons/refresh";
import { Router } from "@/components/animate-ui/icons/hugeicons/router";
import { Save as SaveIcon } from "@/components/animate-ui/icons/hugeicons/save";
import { Settings02 } from "@/components/animate-ui/icons/hugeicons/settings-02";
import { Settings04 } from "@/components/animate-ui/icons/hugeicons/settings-04";
import { SkipBack as SkipBackIcon } from "@/components/animate-ui/icons/hugeicons/skip-back";
import { SkipForward as SkipForwardIcon } from "@/components/animate-ui/icons/hugeicons/skip-forward";
import { SlidersHorizontal } from "@/components/animate-ui/icons/hugeicons/sliders-horizontal";
import { SquareX } from "@/components/animate-ui/icons/hugeicons/square-x";
import { Sun03 } from "@/components/animate-ui/icons/hugeicons/sun-03";
import { Temperature } from "@/components/animate-ui/icons/hugeicons/temperature";
import { VolumeX as VolumeXIcon } from "@/components/animate-ui/icons/hugeicons/volume-x";
import { Wifi01 } from "@/components/animate-ui/icons/hugeicons/wifi-01";
import { WifiOff01 } from "@/components/animate-ui/icons/hugeicons/wifi-off-01";

export interface HugeIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  strokeWidth?: number;
  color?: string;
  className?: string;
  animateOnHover?: boolean;
  animate?: boolean | string;
}

export type HugeIconComponent = React.ForwardRefExoticComponent<
  HugeIconProps & React.RefAttributes<SVGSVGElement>
>;

function shouldEnableParentHoverListeners(): boolean {
  if (typeof window === "undefined") return false;

  if (window.matchMedia("(hover: none)").matches) return false;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;

  return true;
}

/**
 * Creates an animated Hugeicons component backed by Animate UI and Motion.
 * Automatically animates when hovering either the icon or its parent container.
 */
export function createHugeIcon(IconComponent: any, displayName?: string): HugeIconComponent {
  const Component = forwardRef<SVGSVGElement, HugeIconProps>(
    (
      { size = 24, strokeWidth = 2, className = "", animateOnHover = true, animate, ...props },
      forwardedRef,
    ) => {
      const localRef = React.useRef<SVGSVGElement | null>(null);
      const [isParentHovered, setIsParentHovered] = React.useState(false);

      const setRefs = React.useCallback(
        (node: SVGSVGElement | null) => {
          localRef.current = node;

          if (forwardedRef instanceof Function) {
            forwardedRef(node);
          } else if (forwardedRef && "current" in forwardedRef) {
            forwardedRef.current = node;
          }
        },
        [forwardedRef],
      );

      React.useEffect(() => {
        if (!animateOnHover || !shouldEnableParentHoverListeners()) return;
        const svgEl = localRef.current;

        if (!svgEl) return;

        const hoverTarget =
          svgEl.closest<HTMLElement>(
            'button, a, [role="button"], [data-slot="breadcrumb-page"], [data-slot="breadcrumb-link"], [data-animate-icon-parent]',
          ) ?? svgEl.parentElement;

        if (!hoverTarget) return;

        const handlePointerEnter = (e: PointerEvent) => {
          if (e.pointerType !== "touch") {
            setIsParentHovered(true);
          }
        };

        const handlePointerLeave = () => {
          setIsParentHovered(false);
        };

        hoverTarget.addEventListener("pointerenter", handlePointerEnter, { passive: true });
        hoverTarget.addEventListener("pointerleave", handlePointerLeave, { passive: true });

        return () => {
          hoverTarget.removeEventListener("pointerenter", handlePointerEnter);
          hoverTarget.removeEventListener("pointerleave", handlePointerLeave);
        };
      }, [animateOnHover]);

      if (!IconComponent) return null;

      return (
        // SAFETY: Dynamic icon component adapts React callback ref across heterogeneous SVG wrappers
        <IconComponent
          ref={setRefs as (node: SVGSVGElement | null) => void}
          size={size}
          strokeWidth={strokeWidth}
          className={className}
          animateOnHover={animateOnHover}
          animate={animate ?? (animateOnHover ? isParentHovered : undefined)}
          {...props}
        />
      );
    },
  );

  if (displayName) {
    Component.displayName = displayName;
  }

  return Component;
}

// Navigation & Layout Icons
export const House = createHugeIcon(Home03, "House");
export const HousePlug = createHugeIcon(PlugZap, "HousePlug");
export const Clock = createHugeIcon(Clock01, "Clock");
export const Clock3 = createHugeIcon(Clock03, "Clock3");
export const Settings = createHugeIcon(Settings02, "Settings");
export const Settings2 = createHugeIcon(Settings04, "Settings2");
export const Layers = createHugeIcon(Layers01, "Layers");
export const PanelRightClose = createHugeIcon(PanelRightCloseIcon, "PanelRightClose");
export const PanelLeftClose = createHugeIcon(PanelLeftCloseIcon, "PanelLeftClose");

// Arrows & Chevrons
export const ChevronLeft = createHugeIcon(ArrowLeft01, "ChevronLeft");
export const ChevronRight = createHugeIcon(ArrowRight01, "ChevronRight");
export const ChevronDown = createHugeIcon(ArrowDown01, "ChevronDown");
export const ChevronUp = createHugeIcon(ArrowUp01, "ChevronUp");
export const ArrowUp = createHugeIcon(ArrowUp01, "ArrowUp");

// Actions & Controls
export const Plus = createHugeIcon(Add01, "Plus");
export const X = createHugeIcon(Cancel01, "X");
export const Check = createHugeIcon(CheckIcon, "Check");
export const CheckCircle = createHugeIcon(CheckmarkCircle02, "CheckCircle");
export const XCircle = createHugeIcon(CircleX, "XCircle");
export const Trash2 = createHugeIcon(Delete02, "Trash2");
export const Edit2 = createHugeIcon(PencilEdit02, "Edit2");
export const Play = createHugeIcon(PlayIcon, "Play");
export const Square = createHugeIcon(SquareX, "Square");
export const GripVertical = createHugeIcon(MoreVertical, "GripVertical");
export const Sliders = createHugeIcon(SlidersHorizontal, "Sliders");
export const RefreshCw = createHugeIcon(RefreshIcon, "RefreshCw");
export const Save = createHugeIcon(SaveIcon, "Save");

// Communication & Media
export const Mic = createHugeIcon(MicIcon, "Mic");
export const Music = createHugeIcon(Music3, "Music");
export const SkipBack = createHugeIcon(SkipBackIcon, "SkipBack");
export const SkipForward = createHugeIcon(SkipForwardIcon, "SkipForward");
export const VolumeX = createHugeIcon(VolumeXIcon, "VolumeX");
export const Download = createHugeIcon(Download01, "Download");

// Network, System & Sensors
export const Wifi = createHugeIcon(Wifi01, "Wifi");
export const WifiOff = createHugeIcon(WifiOff01, "WifiOff");
export const Globe = createHugeIcon(Globe02, "Globe");
export const Server = createHugeIcon(ComputerTerminal01, "Server");
export const HardDrive = createHugeIcon(CircuitBoard, "HardDrive");
export const CloudLightning = createHugeIcon(CloudLightningIcon, "CloudLightning");
export const CloudUpload = createHugeIcon(CloudUploadIcon, "CloudUpload");
export const Activity = createHugeIcon(Activity01, "Activity");
export const Thermometer = createHugeIcon(Temperature, "Thermometer");
export const Info = createHugeIcon(InfoIcon, "Info");
export const MapPin = createHugeIcon(Location01, "MapPin");
export const Lightbulb = createHugeIcon(LightbulbIcon, "Lightbulb");
export const Sun = createHugeIcon(Sun03, "Sun");
export const Moon = createHugeIcon(Moon02, "Moon");
export const Network = createHugeIcon(Router, "Network");
export const Workflow = createHugeIcon(Bot, "Workflow");

// Canonical aliases for Hugeicons
export const House01Icon = House;
export const Clock01Icon = Clock;
export const Settings01Icon = Settings;
export const Mic01Icon = Mic;
export const Wifi01Icon = Wifi;
export const Add01Icon = Plus;
export const Cancel01Icon = X;

export * from "@/components/animate-ui/icons/hugeicons";
