import type { Metadata } from "next";
import {
  IBM_Plex_Sans_Arabic,
  Noto_Sans_Arabic,
  Readex_Pro,
  Rubik,
  Vazirmatn,
} from "next/font/google";
import localFont from "next/font/local";
import AudioInitializer from "@/components/AudioInitializer";
import { MotionProvider } from "@/components/MotionProvider";
import "./globals.css"; // Global styles

const dana = localFont({
  src: [
    {
      path: "../public/Fonts/DanaFaNum-Regular.woff",
      weight: "100 400",
      style: "normal",
    },
    {
      path: "../public/Fonts/Dana-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/Fonts/DanaFaNum-Bold.woff",
      weight: "600 700",
      style: "normal",
    },
    {
      path: "../public/Fonts/Dana-ExtraBold.woff2",
      weight: "800 900",
      style: "normal",
    },
  ],
  variable: "--font-dana",
  display: "swap",
  adjustFontFallback: false,
  declarations: [
    { prop: "size-adjust", value: "96%" },
    { prop: "ascent-override", value: "96%" },
    { prop: "descent-override", value: "36%" },
    { prop: "line-gap-override", value: "0%" },
  ],
});

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazirmatn",
  display: "swap",
  preload: false,
});

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans-arabic",
  display: "swap",
  preload: false,
});

const notoSansArabic = Noto_Sans_Arabic({
  subsets: ["arabic", "latin"],
  variable: "--font-noto-sans-arabic",
  display: "swap",
  preload: false,
});

const rubik = Rubik({
  subsets: ["arabic", "latin"],
  variable: "--font-rubik",
  display: "swap",
  preload: false,
});

const readexPro = Readex_Pro({
  subsets: ["arabic", "latin"],
  variable: "--font-readex-pro",
  display: "swap",
  preload: false,
});

const FONT_VARIABLES = [
  dana.variable,
  vazirmatn.variable,
  ibmPlexSansArabic.variable,
  notoSansArabic.variable,
  rubik.variable,
  readexPro.variable,
].join(" ");

export const metadata: Metadata = {
  title: "سامانه هوشمند اینترنت اشیاء | Smart IoT Dashboard",
  description:
    "داشبورد مدرن و هوشمند کنترل و پایش دستگاه‌های اینترنت اشیاء مبتنی بر میکروکنترلر ESP32",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={FONT_VARIABLES}>
      <head>
        <link
          rel="preconnect"
          href="https://home-control-db.kamyarahangar157.workers.dev"
          crossOrigin="anonymous"
        />
        <link rel="dns-prefetch" href="https://broker.emqx.io" />
      </head>
      <body
        suppressHydrationWarning
        className="style-nova bg-[#0b0c10] text-[#e5e7eb] min-h-screen selection:bg-blue-500/20 selection:text-blue-200 font-sans"
      >
        <MotionProvider>
          <AudioInitializer />
          {children}
        </MotionProvider>
      </body>
    </html>
  );
}
