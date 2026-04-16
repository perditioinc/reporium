'use client';

import { motion, useReducedMotion } from 'framer-motion';
import React from 'react';

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
  const shouldReduce = useReducedMotion();

  return (
    <section
      id={id}
      className={`relative flex h-[100svh] w-screen flex-col items-center justify-center overflow-hidden px-6 sm:px-10 md:px-16 ${bg} ${className}`}
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
        className="relative z-10 w-full max-w-5xl"
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
