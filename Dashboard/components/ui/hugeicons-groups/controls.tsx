"use client";

import { Check as CheckIcon } from "@/components/animate-ui/icons/hugeicons/check";
import { CloudLightning as CloudLightningIcon } from "@/components/animate-ui/icons/hugeicons/cloud-lightning";
import { ComputerTerminal01 } from "@/components/animate-ui/icons/hugeicons/computer-terminal-01";
import { Info as InfoIcon } from "@/components/animate-ui/icons/hugeicons/info";
import { Location01 } from "@/components/animate-ui/icons/hugeicons/location-01";
import { PencilEdit02 } from "@/components/animate-ui/icons/hugeicons/pencil-edit-02";
import { Save as SaveIcon } from "@/components/animate-ui/icons/hugeicons/save";
import { SquareX } from "@/components/animate-ui/icons/hugeicons/square-x";
import { Temperature } from "@/components/animate-ui/icons/hugeicons/temperature";
import { Wifi01 } from "@/components/animate-ui/icons/hugeicons/wifi-01";
import { createHugeIcon } from "../hugeicon-factory";

export const Check = /*#__PURE__*/ createHugeIcon(CheckIcon, "Check");
export const Edit2 = /*#__PURE__*/ createHugeIcon(PencilEdit02, "Edit2");
export const Square = /*#__PURE__*/ createHugeIcon(SquareX, "Square");
export const Save = /*#__PURE__*/ createHugeIcon(SaveIcon, "Save");
export const Wifi = /*#__PURE__*/ createHugeIcon(Wifi01, "Wifi");
export const Wifi01Icon = Wifi;
export const Server = /*#__PURE__*/ createHugeIcon(ComputerTerminal01, "Server");
export const CloudLightning = /*#__PURE__*/ createHugeIcon(CloudLightningIcon, "CloudLightning");
export const Thermometer = /*#__PURE__*/ createHugeIcon(Temperature, "Thermometer");
export const Info = /*#__PURE__*/ createHugeIcon(InfoIcon, "Info");
export const MapPin = /*#__PURE__*/ createHugeIcon(Location01, "MapPin");
