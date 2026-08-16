import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Nav } from "@/components/Nav";
import { PageTransition } from "@/components/PageTransition";
import { DesktopNotice } from "@/components/DesktopNotice";

export const metadata: Metadata = { title: "LowBlock | Football predictions", description: "A focused football prediction experience for Europe's top leagues." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="fa" dir="rtl"><body><Providers><DesktopNotice/><Nav/><PageTransition>{children}</PageTransition></Providers></body></html>;
}
