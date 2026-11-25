import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { PwaProvider } from "@/platform/pwa/PwaProvider";
import { StatusBanners } from "@/platform/pwa/StatusBanners";
import { THEME_BOOT_SCRIPT, THEME_COLORS } from "@/platform/theme/theme";
import "./globals.css";

const font = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-pfc",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "PFC Digital Hub", template: "%s · PFC" },
  description: "Personal Finance Club — quản lý tài chính, học tập, cơ hội và cộng đồng.",
  applicationName: "PFC",
  appleWebApp: { capable: true, title: "PFC", statusBarStyle: "default" },
  formatDetection: { telephone: false, email: false, address: false },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={font.variable} suppressHydrationWarning>
      <head>
        {/* Applies an explicit Sáng/Tối choice before first paint (no flash). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <PwaProvider>
          <StatusBanners />
          <div className="app-canvas">{children}</div>
        </PwaProvider>
      </body>
    </html>
  );
}
