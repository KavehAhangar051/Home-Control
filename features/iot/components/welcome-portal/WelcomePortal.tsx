"use client";

import { m } from "motion/react";
import { useRef } from "react";
import { IconStack } from "@/components/reui/icon-stack";
import { Scrollspy } from "@/components/reui/scrollspy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Lightbulb, Network, Workflow } from "@/components/ui/hugeicons-groups/welcome";
import { DURATION, EASE_OUT } from "@/lib/ease";

const overviewSections = [
  {
    id: "welcome-lighting",
    label: "کنترل چراغ‌ها",
    description: "وضعیت روشنایی خانه را از یک فضای کاری ببین و فرمان روشن یا خاموش را ارسال کن.",
    hint: "کنترل دستی تجهیزات",
    Icon: Lightbulb,
    color: "text-accent3",
  },
  {
    id: "welcome-modules",
    label: "اتصال ماژول‌ها",
    description:
      "ماژول‌های متصل به ESP32 را کنار هم مدیریت کن و تجهیزات خانه را در یک نمای واحد ببین.",
    hint: "ESP32 و ارتباط شبکه‌ای",
    Icon: Network,
    color: "text-text-secondary",
  },
  {
    id: "welcome-automation",
    label: "اتوماسیون خانه",
    description: "برای کارهای تکراری خانه شرط و عمل تعریف کن تا تجهیزات طبق تنظیماتت عمل کنند.",
    hint: "قانون‌ها و عملیات خودکار",
    Icon: Workflow,
    color: "text-accent3",
  },
] as const;

const chunkVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.slow, ease: EASE_OUT },
  },
};

export default function WelcomePortal() {
  const overviewRef = useRef<HTMLElement | null>(null);

  return (
    <m.section
      initial="hidden"
      animate="visible"
      variants={{
        visible: { transition: { staggerChildren: 0.1 } },
      }}
      className="@container mx-auto w-full max-w-5xl px-3 py-5 text-right sm:px-5 sm:py-8"
      dir="rtl"
    >
      <div className="bezel-shell">
        <Card className="bezel-core overflow-hidden">
          <CardContent className="space-y-5 px-5 pb-6 sm:px-8 sm:pb-8">
            <m.div variants={chunkVariants} className="space-y-1.5">
              <span className="inline-flex items-center rounded-full border border-border-color bg-secondary/60 px-3 py-1 text-[10px] font-medium tracking-wider text-text-secondary">
                راهنمای سریع خانه هوشمند
              </span>
              <h2 className="text-fluid-lg font-semibold text-balance text-text-primary">
                نمای کلی سامانه
              </h2>
              <p className="text-sm leading-6 text-text-secondary">
                برای آشنایی با بخش‌های اصلی، گزینه‌ها را انتخاب کن یا محتوای این پنل را مرور کن.
              </p>
            </m.div>

            <m.div
              variants={chunkVariants}
              className="grid min-w-0 grid-cols-1 gap-3 @md/card:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-4"
            >
              <nav aria-label="بخش‌های نمای کلی">
                <Scrollspy
                  targetRef={overviewRef}
                  history={false}
                  offset={0}
                  className="flex min-w-0 gap-2 overflow-x-auto pb-1 @md/card:flex-col @md/card:overflow-visible @md/card:pb-0"
                >
                  {overviewSections.map((item) => (
                    <Button
                      key={item.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      data-scrollspy-anchor={item.id}
                      className="min-h-11 @md/card:min-h-9 shrink-0 justify-start gap-2 data-[active=true]:border-accent3 data-[active=true]:bg-accent3/10 data-[active=true]:text-text-primary @md/card:w-full"
                    >
                      <item.Icon className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                      {item.label}
                    </Button>
                  ))}
                </Scrollspy>
              </nav>

              <section
                ref={overviewRef}
                className="relative h-80 min-w-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-xl border border-border-color bg-secondary/30 dark:shadow-[inset_0_1px_0_0_oklch(1_0_0/0.05)] scroll-smooth"
                aria-label="توضیحات قابلیت‌های سامانه"
              >
                {overviewSections.map((item) => (
                  <section
                    key={item.id}
                    id={item.id}
                    aria-labelledby={`${item.id}-title`}
                    className="relative flex min-h-72 items-center p-5 sm:p-6"
                  >
                    <div className="flex w-full flex-col items-center gap-4 text-center @sm/card:flex-row @sm/card:gap-6 @sm/card:text-right">
                      <IconStack className={`h-28 w-24 shrink-0 ${item.color}`} aria-hidden="true">
                        <item.Icon className="size-6" strokeWidth={2} />
                      </IconStack>

                      <div className="min-w-0 space-y-2">
                        <h3
                          id={`${item.id}-title`}
                          className="text-fluid-base font-semibold text-text-primary"
                        >
                          {item.label}
                        </h3>
                        <p className="text-sm leading-7 text-text-secondary">{item.description}</p>
                        <p className="text-xs font-medium text-text-secondary">{item.hint}</p>
                      </div>
                    </div>
                  </section>
                ))}
              </section>
            </m.div>
          </CardContent>

          <m.div variants={chunkVariants}>
            <CardFooter className="text-sm leading-6 text-text-secondary">
              <p>
                <span className="font-medium text-text-primary">برای شروع:</span> از بخش «ماژول‌ها»
                در ناوبری، اولین ماژول خانه را اضافه کن.
              </p>
            </CardFooter>
          </m.div>
        </Card>
      </div>
    </m.section>
  );
}
