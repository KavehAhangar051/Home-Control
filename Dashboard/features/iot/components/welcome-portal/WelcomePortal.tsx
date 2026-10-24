"use client";

import React from "react";
import { motion } from "motion/react";
import { Compass, House, Layers3, Settings2, Wifi } from "lucide-react";
import { Card, CardDescription, CardHeader } from "@/components/ui/card";

export interface WelcomePortalProps {
  animationsEnabled?: boolean;
}

export default function WelcomePortal({
  animationsEnabled = true,
}: WelcomePortalProps) {
  return (
    <motion.section
      key="welcome-prompt"
      initial={animationsEnabled ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      exit={animationsEnabled ? { opacity: 0, y: 8 } : undefined}
      transition={{ duration: animationsEnabled ? 0.24 : 0 }}
      className="mx-auto w-full max-w-6xl px-3 py-5 text-right sm:px-5 sm:py-8"
      dir="rtl"
      aria-labelledby="welcome-title"
    >
      <Card className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="grid min-w-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
          <CardHeader className="min-w-0 gap-6 px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex min-h-8 items-center gap-2 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <Compass className="h-4 w-4 text-primary" aria-hidden="true" />
                داشبورد خانه هوشمند
              </span>
              <span className="inline-flex min-h-8 items-center gap-2 rounded-lg border border-info/25 bg-info/10 px-3 py-1.5 text-xs font-medium text-info">
                <span className="h-1.5 w-1.5 rounded-full bg-info" aria-hidden="true" />
                آماده افزودن ماژول
              </span>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <p className="text-sm font-medium text-muted-foreground">درود، خوش آمدید</p>
              <h1
                id="welcome-title"
                className="max-w-xl text-balance text-right text-3xl font-bold leading-[1.45] tracking-tight text-foreground sm:text-4xl sm:leading-[1.4] lg:text-[2.7rem]"
              >
                کنترل خانه،
                <span className="block text-[var(--accent3)]">ساده و یکپارچه</span>
              </h1>
              <CardDescription className="max-w-lg text-sm leading-7 text-muted-foreground sm:text-base sm:leading-8">
                چراغ‌ها، ماژول‌ها و اتوماسیون‌های خانه را از یک فضای کاری مدیریت کنید.
              </CardDescription>
            </div>

            <div className="flex items-start gap-3 border-t border-border pt-4 text-sm leading-6 text-muted-foreground">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info">
                <Settings2 className="h-4 w-4" aria-hidden="true" />
              </span>
              <p>
                <span className="font-semibold text-foreground">برای شروع:</span>{" "}
                از بخش ماژول‌ها، اولین ماژول خانه را اضافه کنید.
              </p>
            </div>
          </CardHeader>

          <aside className="flex min-w-0 flex-col gap-5 border-t border-border bg-muted/30 p-5 sm:p-7 lg:border-r lg:border-t-0 lg:p-8" aria-labelledby="system-overview-title">
            <header className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">اتصال تجهیزات و ماژول‌ها</p>
                <h2 id="system-overview-title" className="text-base font-semibold text-foreground">
                  نمای کلی سامانه
                </h2>
              </div>
              <span className="shrink-0 rounded-lg border border-border bg-card px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground" dir="ltr">
                ESP32 · MQTT
              </span>
            </header>

            <div className="relative flex min-h-44 flex-1 items-center justify-center py-2 sm:min-h-48" aria-hidden="true">
              <div className="absolute right-[calc(50%+3.5rem)] top-1/2 h-px w-7 bg-border sm:right-[calc(50%+4rem)]" />
              <div className="absolute left-[calc(50%+3.5rem)] top-1/2 h-px w-7 bg-border sm:left-[calc(50%+4rem)]" />

              <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary sm:h-28 sm:w-28">
                <House className="h-11 w-11 sm:h-12 sm:w-12" strokeWidth={1.5} />
              </div>

              <div className="absolute right-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl border border-border bg-card text-info sm:h-11 sm:w-11">
                <Wifi className="h-5 w-5" />
              </div>
              <div className="absolute left-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl border border-border bg-card text-primary sm:h-11 sm:w-11">
                <Layers3 className="h-5 w-5" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0 rounded-xl border border-border bg-card p-3.5">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Wifi className="h-4 w-4 shrink-0 text-info" aria-hidden="true" />
                  <span className="text-xs">ارتباط دستگاه</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-foreground" dir="ltr">
                  MQTT / WebSocket
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  تبادل فرمان و وضعیت دستگاه‌ها
                </p>
              </div>

              <div className="min-w-0 rounded-xl border border-border bg-card p-3.5">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Layers3 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="text-xs">تجهیزات خانه</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-foreground">ماژول‌ها و سگمنت‌ها</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  مدیریت متمرکز از داشبورد
                </p>
              </div>
            </div>
          </aside>
        </div>
      </Card>
    </motion.section>
  );
}
