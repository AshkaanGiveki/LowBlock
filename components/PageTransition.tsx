"use client";
import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <AnimatePresence mode="wait" initial={false}><motion.div key={pathname} initial={{ opacity: 0, filter: "blur(8px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} exit={{ opacity: 0, filter: "blur(6px)" }} transition={{ duration: .18, ease: [0.22, 1, .36, 1] }}>{children}</motion.div></AnimatePresence>;
}
