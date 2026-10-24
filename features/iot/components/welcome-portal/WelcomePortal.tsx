"use client";

import { useRef } from "react";
import { Lightbulb, Network, Workflow } from "lucide-react";
import { IconStack } from "@/components/reui/icon-stack";
import { Scrollspy } from "@/components/reui/scrollspy";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";

const overviewSections = [
  {
    id: "welcome-lighting",
    label: "کنترل چراغ‌ها",
    description: "وضعیت روشنایی خانه را از یک فضای کاری ببین و فرمان روشن یا خاموش را ارسال کن.",
    hint: "کنترل دستی تجهیزات",
    Icon: Lightbulb,
    color: "text-primary",
  },
  {
    id: "welcome-modules",
    label: "اتصال ماژول‌ها",
    description: "ماژول‌های متصل به ESP32 را کنار هم مدیریت کن و تجهیزات خانه را در یک نمای واحد ببین.",
    hint: "ESP32 و ارتباط شبکه‌ای",
    Icon: Network,
    color: "text-muted-foreground",
  },
  {
    id: "welcome-automation",
    label: "اتوماسیون خانه",
    description: "برای کارهای تکراری خانه شرط و عمل تعریف کن تا تجهیزات طبق تنظیماتت عمل کنند.",
    hint: "قانون‌ها و عملیات خودکار",
    Icon: Workflow,
    color: "text-primary",
  },
] as const;

export default function WelcomePortal() {
  const overviewRef = useRef<HTMLDivElement | null>(null);

  return (
    <section
      className="mx-auto w-full max-w-5xl px-3 py-5 text-right sm:px-5 sm:py-8"
      dir="rtl"
    >
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-col gap-3 px-6 py-7 sm:px-8 sm:py-9">
        </CardHeader>

        <CardContent className="space-y-5 px-6 pb-6 sm:px-8 sm:pb-8">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">نمای کلی سامانه</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              برای آشنایی با بخش‌های اصلی، گزینه‌ها را انتخاب کن یا محتوای این پنل را مرور کن.
            </p>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
            <nav aria-label="بخش‌های نمای کلی">
              <Scrollspy
                targetRef={overviewRef}
                history={false}
                offset={0}
                className="flex min-w-0 gap-2 overflow-x-auto pb-1 sm:flex-col sm:overflow-visible sm:pb-0"
              >
                {overviewSections.map((item) => (
                  <Button
                    key={item.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    data-scrollspy-anchor={item.id}
                    className="shrink-0 justify-start gap-2 data-[active=true]:border-primary data-[active=true]:bg-primary/10 data-[active=true]:text-foreground sm:w-full"
                  >
                    <item.Icon className="size-4 shrink-0" aria-hidden="true" />
                    {item.label}
                  </Button>
                ))}
              </Scrollspy>
            </nav>

            <div
              ref={overviewRef}
              className="relative h-80 min-w-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-lg border border-border bg-muted/20 scroll-smooth"
              aria-label="توضیحات قابلیت‌های سامانه"
            >
              {overviewSections.map((item) => (
                <section
                  key={item.id}
                  id={item.id}
                  aria-labelledby={item.id + "-title"}
                  className="relative flex min-h-72 items-center p-5 sm:p-6"
                >
                  <div className="flex w-full flex-col items-center gap-4 text-center sm:flex-row sm:gap-6 sm:text-right">
                    <IconStack
                      className={"h-28 w-24 shrink-0 " + item.color}
                      aria-hidden="true"
                    >
                      <item.Icon className="size-6" strokeWidth={1.6} />
                    </IconStack>

                    <div className="min-w-0 space-y-2">
                      <h3
                        id={item.id + "-title"}
                        className="text-base font-semibold text-foreground"
                      >
                        {item.label}
                      </h3>
                      <p className="text-sm leading-7 text-muted-foreground">
                        {item.description}
                      </p>
                      <p className="text-xs font-medium text-muted-foreground">
                        {item.hint}
                      </p>
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </div>
        </CardContent>

        <CardFooter className="text-sm leading-6 text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">برای شروع:</span>{" "}
            از بخش «ماژول‌ها» در ناوبری، اولین ماژول خانه را اضافه کن.
          </p>
        </CardFooter>
      </Card>
    </section>
  );
}
