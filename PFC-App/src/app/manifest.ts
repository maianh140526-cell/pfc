import type { MetadataRoute } from "next";
import { THEME_COLORS } from "@/platform/theme/theme";

/** Web App Manifest — makes the site installable and open full-screen (ADR-009). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "PFC Digital Hub",
    short_name: "PFC",
    description: "Personal Finance Club — quản lý tài chính, học tập, cơ hội và cộng đồng.",
    lang: "vi",
    dir: "ltr",
    start_url: "/home?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: THEME_COLORS.light,
    theme_color: THEME_COLORS.light,
    categories: ["finance", "education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Tài chính",
        short_name: "Tài chính",
        url: "/finance?source=shortcut",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Học tập",
        short_name: "Học tập",
        url: "/learn?source=shortcut",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
