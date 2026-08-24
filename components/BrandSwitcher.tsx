"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

export function BrandSwitcher() {
  const [showWordmark, setShowWordmark] = useState(true);

  useEffect(() => {
    const timer = window.setInterval(() => setShowWordmark((visible) => !visible), 5000);
    return () => window.clearInterval(timer);
  }, []);

  return <Link href="/" aria-label="LowBlock" className="brand-switcher">
    <motion.span className="brand-switcher-glow" animate={{ scale: showWordmark ? 1 : 1.18, opacity: showWordmark ? .34 : .52 }} transition={{ duration: 1.1, ease: "easeInOut" }} />
    <AnimatePresence initial={false} mode="wait">
      {showWordmark ? <motion.img key="wordmark" src="/lowblock-typo.png" alt="LowBlock" className="brand-switcher-wordmark" initial={{ opacity: 0, y: 10, scale: .94, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0, y: -10, scale: 1.03, filter: "blur(8px)" }} transition={{ duration: .72, ease: [0.16, 1, 0.3, 1] }} /> : <motion.img key="mark" src="/lowblock.png" alt="" className="brand-switcher-mark" initial={{ opacity: 0, scale: .62, rotate: -18, filter: "blur(8px)" }} animate={{ opacity: 1, scale: 1, rotate: 0, filter: "blur(0px)" }} exit={{ opacity: 0, scale: .62, rotate: 18, filter: "blur(8px)" }} transition={{ duration: .72, ease: [0.16, 1, 0.3, 1] }} />}
    </AnimatePresence>
  </Link>;
}
