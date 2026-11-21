"use client";

import { useEffect } from "react";
import { scheduleIdleTask } from "@/lib/asyncScheduler";

function preloadAudio(): void {
  void import("@/lib/audio");
}

export default function AudioInitializer() {
  useEffect(() => scheduleIdleTask(preloadAudio, 1500), []);

  return null;
}
