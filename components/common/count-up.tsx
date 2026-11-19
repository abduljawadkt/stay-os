"use client";

import { useEffect } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";

const seen = new Set<string>();

/** Counts up once on first view, and animates between values when data changes (e.g. a payment lands). */
export function CountUp({ value, format, id, className }: { value: number; format: (n: number) => string; id: string; className?: string }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(!seen.has(id) && !reduce ? 0 : value);
  const text = useTransform(mv, (v) => format(v));
  useEffect(() => {
    const first = !seen.has(id);
    seen.add(id);
    if (reduce || mv.get() === value) {
      mv.set(value);
      return;
    }
    const c = animate(mv, value, { duration: first ? 0.7 : 0.9, ease: [0.2, 0, 0, 1] });
    return () => c.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <motion.span className={className}>{text}</motion.span>;
}
