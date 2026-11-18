"use client";

import { Bot } from "@/components/animate-ui/icons/hugeicons/bot";
import { Lightbulb as LightbulbIcon } from "@/components/animate-ui/icons/hugeicons/lightbulb";
import { Router } from "@/components/animate-ui/icons/hugeicons/router";
import { createHugeIcon } from "../hugeicon-factory";

export const Lightbulb = /*#__PURE__*/ createHugeIcon(LightbulbIcon, "Lightbulb");
export const Network = /*#__PURE__*/ createHugeIcon(Router, "Network");
export const Workflow = /*#__PURE__*/ createHugeIcon(Bot, "Workflow");
