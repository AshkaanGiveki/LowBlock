import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = { title: "لوبلاک | فوتبال را دقیق‌تر ببین", description: "پلتفرم فارسی پیش‌بینی امتیازی فوتبال اروپا" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="fa" dir="rtl"><body><Providers>{children}</Providers></body></html>;
}
