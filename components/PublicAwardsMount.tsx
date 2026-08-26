"use client";
import { usePathname } from "next/navigation";
import { PublicAwardsSection } from "@/components/PublicAwardsSection";
export function PublicAwardsMount() { const pathname = usePathname(); const match = pathname.match(/^\/u\/([^/]+)\/?$/); return match ? <div className="mx-auto max-w-4xl px-5 pb-28 md:px-8"><PublicAwardsSection username={decodeURIComponent(match[1])}/></div> : null; }
