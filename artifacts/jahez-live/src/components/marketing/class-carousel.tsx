import { type ReactNode, useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { useReducedMotion } from "framer-motion";

const SPEED_PX_PER_SECOND = 60;
const HOLD_AT_END_MS = 1400;
const RESUME_AFTER_TOUCH_MS = 2500;

/**
 * Pans the row to its far end and back, so every card gets seen without
 * anyone having to scroll. It stays a native scroller: visitors can still
 * swipe it, hovering or focusing a card holds it still, and people who
 * prefer reduced motion get the plain scroller.
 */
export function ClassCarousel({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const track = ref.current;
    if (!track || reduce || paused) return;
    // In RTL, scrollLeft runs from 0 down to a negative maximum.
    const sign = getComputedStyle(track).direction === "rtl" ? -1 : 1;
    let position = Math.abs(track.scrollLeft);
    let direction = 1;
    let last = performance.now();
    let waitUntil = 0;
    let hovering = false;
    let focused = false;
    let visible = false;
    let frame = 0;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const elapsed = Math.min(now - last, 64);
      last = now;
      if (!visible || hovering || focused || now < waitUntil) {
        position = Math.abs(track.scrollLeft);
        return;
      }
      const max = track.scrollWidth - track.clientWidth;
      if (max <= 0) return;
      position += (direction * SPEED_PX_PER_SECOND * elapsed) / 1000;
      if (position >= max || position <= 0) {
        position = Math.min(max, Math.max(0, position));
        direction = -direction;
        waitUntil = now + HOLD_AT_END_MS;
      }
      track.scrollLeft = sign * position;
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
    });
    const hold = () => {
      waitUntil = performance.now() + RESUME_AFTER_TOUCH_MS;
    };
    const enter = (event: PointerEvent) => {
      if (event.pointerType === "mouse") hovering = true;
    };
    const leave = () => {
      hovering = false;
    };
    const focusIn = () => {
      focused = true;
    };
    const focusOut = () => {
      focused = false;
    };

    observer.observe(track);
    track.addEventListener("pointerenter", enter);
    track.addEventListener("pointerleave", leave);
    track.addEventListener("pointerdown", hold);
    track.addEventListener("wheel", hold, { passive: true });
    track.addEventListener("touchmove", hold, { passive: true });
    track.addEventListener("focusin", focusIn);
    track.addEventListener("focusout", focusOut);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      track.removeEventListener("pointerenter", enter);
      track.removeEventListener("pointerleave", leave);
      track.removeEventListener("pointerdown", hold);
      track.removeEventListener("wheel", hold);
      track.removeEventListener("touchmove", hold);
      track.removeEventListener("focusin", focusIn);
      track.removeEventListener("focusout", focusOut);
    };
  }, [reduce, paused]);

  return (
    <div className="studio-class-carousel-wrap">
      <button
        type="button"
        className="studio-carousel-toggle"
        aria-pressed={paused}
        aria-label={paused ? "تشغيل حركة الحصص" : "إيقاف حركة الحصص"}
        onClick={() => setPaused((current) => !current)}
      >
        {paused ? <Play size={15} /> : <Pause size={15} />}
      </button>
      <div
        ref={ref}
        className="studio-class-carousel"
        role="group"
        aria-label="جميع الحصص"
        data-testid="class-carousel"
      >
        {children}
      </div>
    </div>
  );
}
