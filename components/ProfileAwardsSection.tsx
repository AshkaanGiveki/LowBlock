"use client";
import { usePathname } from "next/navigation";
import { AwardsSection } from "@/components/AwardsSection";
export function ProfileAwardsSection() { return usePathname() === "/profile" ? <div className="mx-auto max-w-2xl px-5 pb-28 md:px-8"><AwardsSection /></div> : null; }
