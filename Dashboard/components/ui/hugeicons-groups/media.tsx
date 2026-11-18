"use client";

import { Activity01 } from "@/components/animate-ui/icons/hugeicons/activity-01";
import { Download01 } from "@/components/animate-ui/icons/hugeicons/download-01";
import { Globe02 } from "@/components/animate-ui/icons/hugeicons/globe-02";
import { CircuitBoard } from "@/components/animate-ui/icons/hugeicons/circuit-board";
import { Music3 } from "@/components/animate-ui/icons/hugeicons/music-3";
import { SkipBack as SkipBackIcon } from "@/components/animate-ui/icons/hugeicons/skip-back";
import { SkipForward as SkipForwardIcon } from "@/components/animate-ui/icons/hugeicons/skip-forward";
import { VolumeX as VolumeXIcon } from "@/components/animate-ui/icons/hugeicons/volume-x";
import { createHugeIcon } from "../hugeicon-factory";

export const Music = /*#__PURE__*/ createHugeIcon(Music3, "Music");
export const SkipBack = /*#__PURE__*/ createHugeIcon(SkipBackIcon, "SkipBack");
export const SkipForward = /*#__PURE__*/ createHugeIcon(SkipForwardIcon, "SkipForward");
export const VolumeX = /*#__PURE__*/ createHugeIcon(VolumeXIcon, "VolumeX");
export const Download = /*#__PURE__*/ createHugeIcon(Download01, "Download");
export const Globe = /*#__PURE__*/ createHugeIcon(Globe02, "Globe");
export const HardDrive = /*#__PURE__*/ createHugeIcon(CircuitBoard, "HardDrive");
export const Activity = /*#__PURE__*/ createHugeIcon(Activity01, "Activity");
