"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import gsap from "gsap";
import { Share2 } from "lucide-react";
import "./DepthCarousel.css";

export type DepthCarouselItem = {
  image?: string;
  id?: string;
  content?: ReactNode;
  alt?: string;
  title?: string;
  meta?: string;
  shareLabel?: string;
};
type Props = {
  items: DepthCarouselItem[];
  contentMode?: boolean;
  label?: string;
  previousLabel?: string;
  nextLabel?: string;
  cardWidth?: number;
  cardHeight?: number;
  radius?: number;
  depth?: number;
  spread?: number;
  tilt?: number;
  perspective?: number;
  visibleCards?: number;
  duration?: number;
  showControls?: boolean;
  showIndicators?: boolean;
  rtl?: boolean;
  onChange?: (index: number) => void;
  onShare?: (index: number) => void;
};
const wrap = (value: number, count: number) =>
  ((value % count) + count) % count;

export default function DepthCarousel({
  items,
  contentMode = false,
  label = "Awards",
  previousLabel = "Previous award",
  nextLabel = "Next award",
  cardWidth = 300,
  cardHeight = 380,
  radius = 18,
  depth = 220,
  spread = 90,
  tilt = 22,
  perspective = 1400,
  visibleCards = 4,
  duration = 700,
  showControls = true,
  showIndicators = true,
  rtl = false,
  onChange,
  onShare,
}: Props) {
  const data = useMemo(() => items ?? [], [items]);
  const count = data.length;
  const contentKey = contentMode ? JSON.stringify(data.map((item) => item.id)) : null;
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const position = useRef(0);
  const tween = useRef<gsap.core.Tween | null>(null);
  const drag = useRef<{ x: number; start: number; moved: boolean } | null>(
    null,
  );
  const suppressClick = useRef(false);
  const [active, setActive] = useState(0);
  const activeIndex = Math.min(active, Math.max(0, count - 1));
  const activeRef = useRef(0);
  const layout = useCallback(
    (pos: number) => {
      for (let i = 0; i < count; i++) {
        const el = cards.current[i];
        if (!el) continue;
        let distance = i - pos;
        if (!event.currentTarget.contains(event.target as Node)) return;
        if (contentMode && !event.currentTarget.querySelector(".depth-carousel__stage")?.contains(event.target as Node)) return;
        if (count > 1) {
          distance = ((distance % count) + count) % count;
          if (distance > count / 2) distance -= count;
        }
        const behind = Math.max(0, distance);
        const visible = Math.abs(distance) <= visibleCards + 0.5;
        el.style.transform = `${contentMode ? "" : "translate(-50%,-50%) "}translateX(${spread * distance}px) translateZ(${-depth * distance}px) rotateY(${tilt * Math.max(-1, Math.min(1, distance))}deg)`;
        el.style.opacity = visible
          ? String(Math.max(0, 1 - Math.max(0, -distance)))
          : "0";
        el.style.filter = `brightness(${Math.max(0.18, 1 - behind * 0.2)}) blur(${Math.min(6, behind * 1.5)}px)`;
        el.style.zIndex = String(2000 - Math.round(distance * 20));
        el.style.pointerEvents = visible ? "auto" : "none";
      }
    },
    [count, contentMode, depth, spread, tilt, visibleCards],
  );
  const go = useCallback(
    (raw: number) => {
      if (!count) return;
      const next = wrap(raw, count);
      let delta = next - wrap(position.current, count);
      if (count > 1) {
        if (delta > count / 2) delta -= count;
        if (delta < -count / 2) delta += count;
      }
      const proxy = { p: position.current };
      tween.current?.kill();
      tween.current = gsap.to(proxy, {
        p: position.current + delta,
        duration: contentMode && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : duration / 1000,
        ease: "power3.out",
        onUpdate: () => {
          position.current = proxy.p;
          layout(proxy.p);
        },
        onComplete: () => {
          position.current = next;
          layout(next);
        },
      });
      activeRef.current = next;
      setActive(next);
      onChange?.(next);
    },
    [count, contentMode, duration, layout, onChange],
  );
  useLayoutEffect(() => {
    position.current = contentMode ? Math.min(activeRef.current, Math.max(0, count - 1)) : 0;
    activeRef.current = position.current;
    if (contentMode) setActive(position.current);
    layout(position.current);
    return () => {
      tween.current?.kill();
    };
  }, [layout, contentMode, contentKey, count]);
  if (!count) return null;
  const previous = rtl ? "›" : "‹";
  const next = rtl ? "‹" : "›";
  return (
    <div
      className={`depth-carousel${contentMode ? " depth-carousel--content" : ""}`}
      style={{ perspective: `${perspective}px` }}
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
      onClickCapture={(event) => {
        if (contentMode && suppressClick.current && event.currentTarget.contains(event.target as Node)) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onPointerDown={(event) => {
        if (count > 1)
          drag.current = {
            x: event.clientX,
            start: position.current,
            moved: false,
          };
      }}
      onPointerMove={(event) => {
        const state = drag.current;
        if (!state || !event.currentTarget.contains(event.target as Node)) return;
        const dx = event.clientX - state.x;
        if (Math.abs(dx) < 6) return;
        state.moved = true;
        position.current = state.start - dx / Math.max(cardWidth * 0.55, 80);
        layout(position.current);
      }}
      onPointerUp={(event) => {
        const state = drag.current;
        drag.current = null;
        if (!state?.moved) return;
        suppressClick.current = true;
        const dx = event.clientX - state.x;
        go(Math.round(state.start - dx / Math.max(cardWidth * 0.55, 80)));
        window.setTimeout(() => {
          suppressClick.current = false;
        }, 0);
      }}
      onPointerCancel={() => {
        if (drag.current?.moved && contentMode) go(activeIndex);
        drag.current = null;
      }}
    >
      <div className="depth-carousel__stage">
        {data.map((item, i) => contentMode ? (
          <div
            key={item.id ?? i}
            ref={(el) => { cards.current[i] = el; }}
            className="depth-carousel__content-card"
            style={{ maxWidth: cardWidth }}
            inert={i !== activeIndex}
            aria-hidden={i !== activeIndex || undefined}
          >
            {item.content}
          </div>
        ) : (
          <div
            key={`${item.image}-${i}`}
            ref={(el) => {
              cards.current[i] = el;
            }}
            className="depth-carousel__card"
            style={{
              width: cardWidth,
              height: cardHeight,
              borderRadius: radius,
            }}
            role="button"
            tabIndex={0}
            onClick={() => {
              if (!suppressClick.current) go(i);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") go(i);
            }}
            aria-label={item.title ?? item.alt ?? `Slide ${i + 1}`}
          >
            <img src={item.image} alt={item.alt ?? ""} draggable={false} />
            {(item.title || item.meta) && (
              <span className="depth-carousel__caption">
                {item.title && (
                  <strong className="depth-carousel__title">
                    {item.title}
                  </strong>
                )}
                {item.meta && (
                  <span className="depth-carousel__meta">{item.meta}</span>
                )}
              </span>
            )}
            {onShare && (
              <button
                type="button"
                className="depth-carousel__share"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onShare(i);
                }}
                aria-label={item.shareLabel ?? "Share award"}
              >
                <Share2 size={15} />
              </button>
            )}
          </div>
        ))}
      </div>
      {showControls && count > 1 && (
        <>
          <button
            type="button"
            className="depth-carousel__arrow depth-carousel__arrow--prev"
            onClick={() => go(activeIndex + (rtl ? 1 : -1))}
            aria-label={previousLabel}
          >
            {previous}
          </button>
          <button
            type="button"
            className="depth-carousel__arrow depth-carousel__arrow--next"
            onClick={() => go(activeIndex + (rtl ? -1 : 1))}
            aria-label={nextLabel}
          >
            {next}
          </button>
        </>
      )}
      {showIndicators && count > 1 && (
        <div className="depth-carousel__dots">
          {data.map((item, i) => (
            <button
              key={item.id ?? i}
              type="button"
              className={`depth-carousel__dot ${i === activeIndex ? "is-active" : ""}`}
              onClick={() => go(i)}
              aria-label={contentMode ? item.title : `Show ${item.title ?? `award ${i + 1}`}`}
              aria-current={contentMode && i === activeIndex ? "true" : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
