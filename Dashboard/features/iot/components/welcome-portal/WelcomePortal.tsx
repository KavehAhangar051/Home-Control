"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function WelcomePortal() {
  return (
    <section
      className="mx-auto w-full max-w-4xl px-3 py-5 text-right sm:px-5 sm:py-8"
      dir="rtl"
      aria-labelledby="welcome-title"
    >
      <Card className="w-full">
        <CardHeader className="gap-2">
          <p className="text-sm font-medium text-muted-foreground">درود، خوش آمدید</p>
          <CardTitle
            id="welcome-title"
            role="heading"
            aria-level={1}
            className="text-2xl font-semibold leading-9 sm:text-3xl"
          >
            کنترل خانه، ساده و یکپارچه
          </CardTitle>
          <CardDescription className="max-w-2xl text-sm leading-7 sm:text-base">
            چراغ‌ها، ماژول‌ها و اتوماسیون‌های خانه را از یک فضای کاری مدیریت کنید.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <section aria-labelledby="system-overview-title" className="space-y-2">
            <h2
              id="system-overview-title"
              className="text-base font-semibold text-foreground"
            >
              نمای کلی سامانه
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              تجهیزات خانه از طریق کنترل‌گر ESP32 و ارتباط شبکه‌ای با داشبورد در
              تعامل هستند.
            </p>
          </section>

          <dl className="grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2">
            <div className="space-y-1">
              <dt className="text-xs text-muted-foreground">کنترل‌گر</dt>
              <dd className="text-sm font-medium text-foreground" dir="ltr">
                ESP32
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs text-muted-foreground">روش ارتباط</dt>
              <dd className="text-sm font-medium text-foreground" dir="ltr">
                MQTT / WebSocket
              </dd>
            </div>
          </dl>
        </CardContent>

        <CardFooter className="text-sm leading-6 text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">برای شروع:</span>{" "}
            از بخش «ماژول‌ها»، اولین ماژول خانه را اضافه کنید.
          </p>
        </CardFooter>
      </Card>
    </section>
  );
}
