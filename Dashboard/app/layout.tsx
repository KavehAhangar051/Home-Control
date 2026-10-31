import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css"; // Global styles
import QueryProvider from "@/components/QueryProvider";
import AudioInitializer from "@/components/AudioInitializer";

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazirmatn",
  display: "swap",
});

export const metadata: Metadata = {
  title: "سامانه هوشمند اینترنت اشیاء | Smart IoT Dashboard",
  description:
    "داشبورد مدرن و هوشمند کنترل و پایش دستگاه‌های اینترنت اشیاء مبتنی بر میکروکنترلر ESP32",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body
        suppressHydrationWarning
        className="style-nova bg-[#0b0c10] text-[#e5e7eb] min-h-screen selection:bg-blue-500/20 selection:text-blue-200 font-sans"
      >
        <QueryProvider>
          <AudioInitializer />
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
