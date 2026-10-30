import { type ReactNode, type PointerEvent, useRef } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";

export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Pointer movement stays in motion values, without rendering the React tree. */
export function TiltSurface({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const x = useMotionValue(0),
    y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [5, -5]), {
    stiffness: 140,
    damping: 22,
  });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-6, 6]), {
    stiffness: 140,
    damping: 22,
  });
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (reduce || event.pointerType !== "mouse" || !ref.current) return;
    const box = ref.current.getBoundingClientRect();
    x.set((event.clientX - box.left) / box.width - 0.5);
    y.set((event.clientY - box.top) / box.height - 0.5);
  };
  return (
    <motion.div
      ref={ref}
      className={className}
      onPointerMove={move}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
      style={reduce ? {} : { rotateX, rotateY, transformPerspective: 1000 }}
    >
      {children}
    </motion.div>
  );
}

export function ReadingProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  });
  const reduce = useReducedMotion();
  return reduce ? null : (
    <motion.div
      className="studio-reading-progress"
      style={{ scaleX }}
      aria-hidden="true"
    />
  );
}

/** The classroom recedes as the visitor moves into the course catalogue. */
export function HeroScene({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, 65]);
  const rotate = useTransform(scrollYProgress, [0, 1], [-1, 3]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.94]);
  return (
    <div ref={ref} className="studio-hero-scene">
      <motion.div style={reduce ? {} : { y, rotate, scale }}>
        {children}
      </motion.div>
    </div>
  );
}
