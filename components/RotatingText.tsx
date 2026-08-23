"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

type SplitBy = "characters" | "words" | "lines";
type RotatingTextProps = { texts: string[]; rotationInterval?: number; staggerDuration?: number; staggerFrom?: "first" | "last" | "center"; splitBy?: SplitBy; mainClassName?: string; splitLevelClassName?: string };
export type RotatingTextHandle = { next: () => void; previous: () => void; jumpTo: (index: number) => void; reset: () => void };

const RotatingText = forwardRef<RotatingTextHandle, RotatingTextProps>(function RotatingText({ texts, rotationInterval = 2200, staggerDuration = .025, staggerFrom = "last", splitBy = "characters", mainClassName = "", splitLevelClassName = "" }, ref) {
  const [current, setCurrent] = useState(0);
  const measurementRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const [contentWidth, setContentWidth] = useState<number | null>(null);
  const safeTexts = texts.length ? texts : [""];
  const next = useCallback(() => setCurrent(value => value === safeTexts.length - 1 ? 0 : value + 1), [safeTexts.length]);
  const previous = useCallback(() => setCurrent(value => value === 0 ? safeTexts.length - 1 : value - 1), [safeTexts.length]);
  const jumpTo = useCallback((index: number) => setCurrent(Math.max(0, Math.min(index, safeTexts.length - 1))), [safeTexts.length]);
  const reset = useCallback(() => setCurrent(0), []);
  useImperativeHandle(ref, () => ({ next, previous, jumpTo, reset }), [jumpTo, next, previous, reset]);
  useEffect(() => { const timer = window.setInterval(next, rotationInterval); return () => window.clearInterval(timer); }, [next, rotationInterval]);
  useLayoutEffect(() => {
    const measurement = measurementRefs.current[current];
    if (measurement) setContentWidth(Math.ceil(measurement.getBoundingClientRect().width));
  }, [current, safeTexts, splitBy]);
  const elements = useMemo(() => { const text = safeTexts[current] ?? ""; if (splitBy === "lines") return text.split("\n").map(line => [line]); if (splitBy === "words") return text.split(" ").map(word => [word]); return text.split(" ").map(word => Array.from(word)); }, [current, safeTexts, splitBy]);
  const total = elements.reduce((sum, element) => sum + element.length, 0);
  const delayFor = (index: number) => staggerFrom === "last" ? (total - 1 - index) * staggerDuration : staggerFrom === "center" ? Math.abs(Math.floor(total / 2) - index) * staggerDuration : index * staggerDuration;
  return <motion.span className={`text-rotate ${mainClassName}`} layout animate={{ width: contentWidth == null ? "auto" : contentWidth }} transition={{ type: "spring", damping: 30, stiffness: 400 }}><span className="text-rotate-sr-only">{safeTexts[current]}</span><span className="text-rotate-measure-layer" aria-hidden="true">{safeTexts.map((text, index) => <span key={`${index}-${text}`} ref={(node) => { measurementRefs.current[index] = node; }}>{text}</span>)}</span><AnimatePresence mode="wait" initial={false}><motion.span key={current} className={splitBy === "lines" ? "text-rotate-lines" : "text-rotate"} layout transition={{ type: "spring", damping: 30, stiffness: 400 }} aria-hidden="true">{elements.map((element, wordIndex) => <span key={wordIndex} className={`text-rotate-word ${splitLevelClassName}`}>{element.map((part, partIndex) => <motion.span key={partIndex} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "-120%" }} transition={{ type: "spring", damping: 30, stiffness: 400, delay: delayFor(elements.slice(0, wordIndex).reduce((sum, item) => sum + item.length, 0) + partIndex) }} className="text-rotate-element">{part}</motion.span>)}{wordIndex < elements.length - 1 && <span className="text-rotate-space"> </span>}</span>)}</motion.span></AnimatePresence></motion.span>;
});

RotatingText.displayName = "RotatingText";
export default RotatingText;
