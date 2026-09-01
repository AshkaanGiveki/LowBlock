import type { Metadata } from "next";

export const metadata: Metadata = { title: "LowBlock Help Center", description: "Learn how LowBlock football predictions, scoring, awards, accounts, and notifications work.", alternates: { canonical: "/help" } };

export default function HelpLayout({ children }: { children: React.ReactNode }) { return children; }
