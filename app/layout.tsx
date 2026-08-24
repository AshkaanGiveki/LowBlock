import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Nav } from "@/components/Nav";
import { PageTransition } from "@/components/PageTransition";
import { SwipeNavigation } from "@/components/SwipeNavigation";
import { DesktopNavigation } from "@/components/DesktopNavigation";
import { HelpShortcut } from "@/components/HelpShortcut";
import { BrandSwitcher } from "@/components/BrandSwitcher";

export const metadata: Metadata = {
  title: { default: "LowBlock | Football Predictions", template: "%s | LowBlock" },
  description: "Predict football scores, follow upcoming fixtures, and climb the LowBlock leaderboard. پیش‌بینی نتایج فوتبال، ثبت امتیاز و رقابت در جدول لوبلاک.",
  keywords: ["football predictions", "soccer predictions", "پیش‌بینی فوتبال", "LowBlock", "Premier League", "La Liga", "Bundesliga", "Serie A", "Ligue 1"],
  applicationName: "LowBlock",
  authors: [{ name: "LowBlock" }],
  creator: "LowBlock",
  publisher: "LowBlock",
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  icons: { icon: "/icon.png", shortcut: "/icon.png", apple: "/icon.png" },
  openGraph: { type: "website", siteName: "LowBlock", title: "LowBlock | Football Predictions", description: "Predict scores, track fixtures, and compete on the LowBlock leaderboard. پیش‌بینی فوتبال و رقابت در جدول امتیازات." },
  twitter: { card: "summary_large_image", title: "LowBlock | Football Predictions", description: "Predict football scores and compete with LowBlock." },
};
export const viewport: Viewport = { themeColor: "#20b879" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="fa" dir="rtl"><body><Providers><DesktopNavigation/><Nav/><BrandSwitcher/><HelpShortcut/><SwipeNavigation/><PageTransition>{children}</PageTransition></Providers></body></html>;
}
