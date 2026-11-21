import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const BASE_PATH = process.env.GITHUB_PAGES === "true" ? "/Home-Control-Dashboard" : "";

export default function manifest(): MetadataRoute.Manifest {
  const startUrl = `${BASE_PATH}/`;

  return {
    id: startUrl,
    name: "سامانه هوشمند اینترنت اشیاء",
    short_name: "خانه هوشمند",
    description:
      "داشبورد مدرن و هوشمند کنترل و پایش دستگاه‌های اینترنت اشیاء مبتنی بر میکروکنترلر ESP32",
    start_url: startUrl,
    scope: startUrl,
    display: "standalone",
    orientation: "any",
    dir: "rtl",
    lang: "fa",
    background_color: "#141415",
    theme_color: "#141415",
    categories: ["utilities", "productivity", "lifestyle"],
    icons: [
      {
        src: `${BASE_PATH}/icons/pwa-192x192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${BASE_PATH}/icons/pwa-512x512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${BASE_PATH}/icons/pwa-maskable-512x512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
