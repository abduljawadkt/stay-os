"use client";

import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

/** Each screen eases in when you move to it, like an app (skipped when the system asks for reduced motion). */
export function ScreenTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <motion.div key={pathname} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}>
      {children}
    </motion.div>
  );
}
