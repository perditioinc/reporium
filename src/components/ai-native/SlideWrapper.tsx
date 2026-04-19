'use client';

import { motion, useReducedMotion } from 'framer-motion';
import React, { useEffect, useState } from 'react';

interface SlideWrapperProps {
  children: React.ReactNode;
  id: string;
  className?: string;
  /** Background override — defaults to transparent (parent handles bg) */
  bg?: string;
}

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

const childVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' as const } },
};

export function SlideWrapper({ children, id, className = '', bg = '' }: SlideWrapperProps) {
  // SSR-safe: useReducedMotion returns null on the server but reads matchMedia
  // synchronously on first client render. Defer until mount so the first client
  // render matches SSR and avoids a hydration mismatch.
  const prefersReduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []); // eslint-disable-line react-hooks/set-state-in-effect
  const shouldReduce = mounted && !!prefersReduced;

  return (
    <section
      id={id}
      className={`relative flex h-[100svh] w-screen flex-col items-center justify-center overflow-y-auto px-4 sm:px-8 md:px-12 lg:px-16 xl:px-20 ${bg} ${className}`}
      style={{ scrollSnapAlign: 'start' }}
    >
      {/* Scanline overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 1px, transparent 1px, transparent 3px)',
          backgroundSize: '100% 3px',
        }}
      />

      <motion.div
        className="relative z-10 w-full max-w-5xl py-6 sm:py-8 md:py-10 lg:max-w-6xl lg:py-12 xl:max-w-7xl 2xl:max-w-[88rem]"
        variants={shouldReduce ? undefined : containerVariants}
        initial={shouldReduce ? false : 'hidden'}
        whileInView={shouldReduce ? undefined : 'visible'}
        viewport={{ once: false, amount: 0.5 }}
      >
        {children}
      </motion.div>
    </section>
  );
}

export { childVariants };
