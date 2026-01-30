'use client';

import { motion } from 'framer-motion';
import clsx from 'clsx';

interface QCanvasFieldProps {
  children?: React.ReactNode;
  className?: string;
}

/**
 * Q-Canvas Field - Server-driven dynamic content surface
 * Currently displayed as dashed outline placeholder for visualization
 * Will later display results from LLM processing
 */
export function QCanvasField({ children, className }: QCanvasFieldProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={clsx(
        'relative w-full max-w-[400px] mx-auto',
        'aspect-[4/3]',
        'rounded-2xl',
        'border-2 border-dashed border-primary/40',
        'bg-surface-glass/20 backdrop-blur-sm',
        'flex items-center justify-center',
        'overflow-hidden',
        className
      )}
    >
      {/* Corner decorations */}
      <div className="absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 border-primary/50 rounded-tl" />
      <div className="absolute top-2 right-2 w-4 h-4 border-r-2 border-t-2 border-primary/50 rounded-tr" />
      <div className="absolute bottom-2 left-2 w-4 h-4 border-l-2 border-b-2 border-primary/50 rounded-bl" />
      <div className="absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 border-primary/50 rounded-br" />

      {/* Content or placeholder */}
      {children ? (
        <div className="w-full h-full p-4 overflow-auto">
          {children}
        </div>
      ) : (
        <div className="text-center text-muted/50 text-xs">
          <p>Q-Canvas</p>
          <p className="text-[10px] mt-1 opacity-60">Ergebnisse erscheinen hier</p>
        </div>
      )}

      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-bg-secondary/30" />
    </motion.div>
  );
}
