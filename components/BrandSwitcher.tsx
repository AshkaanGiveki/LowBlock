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
    <AnimatePresence initial={false} mode="wait">
      {showWordmark ? <motion.img key="wordmark" src="/lowblock-typo.png" alt="LowBlock" className="brand-switcher-wordmark" initial={{ opacity: 0, y: 8, filter: "blur(5px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -8, filter: "blur(5px)" }} transition={{ duration: .55, ease: [0.22, 1, 0.36, 1] }} /> : <motion.img key="mark" src="/lowblock.png" alt="" className="brand-switcher-mark" initial={{ opacity: 0, scale: .72, rotate: -10, filter: "blur(5px)" }} animate={{ opacity: 1, scale: 1, rotate: 0, filter: "blur(0px)" }} exit={{ opacity: 0, scale: .72, rotate: 10, filter: "blur(5px)" }} transition={{ duration: .55, ease: [0.22, 1, 0.36, 1] }} />}
    </AnimatePresence>
  </Link>;
}
