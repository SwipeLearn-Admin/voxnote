'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

export type AnimationState = 'idle' | 'recording' | 'processing' | 'success' | 'error';

interface AnimatedBorderBoxProps {
  children: React.ReactNode;
  state: AnimationState;
  /** Speed multiplier (1.0 = normal, 1.25 = 25% faster for LLM processing) */
  speedMultiplier?: number;
  className?: string;
}

/**
 * AnimatedBorderBox - Container with animated gradient border
 *
 * Animation states:
 * - idle: No animation, subtle border
 * - recording: Rainbow gradient rotating clockwise (user is speaking)
 * - processing: Purple/blue gradient rotating faster (LLM is thinking)
 * - success: Green pulse animation
 * - error: Red pulse animation
 */
export function AnimatedBorderBox({
  children,
  state,
  speedMultiplier = 1.0,
  className
}: AnimatedBorderBoxProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const angleRef = useRef(0);

  // Animation loop for rotating gradient
  useEffect(() => {
    if (state === 'idle' || state === 'success' || state === 'error') {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const baseSpeed = state === 'recording' ? 0.8 : 1.0; // processing is 25% faster by default
    const speed = baseSpeed * speedMultiplier;

    const animate = () => {
      angleRef.current = (angleRef.current + speed) % 360;

      if (boxRef.current) {
        boxRef.current.style.setProperty('--border-angle', `${angleRef.current}deg`);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [state, speedMultiplier]);

  // Gradient colors based on state
  const getGradient = () => {
    switch (state) {
      case 'recording':
        // Rainbow gradient for recording
        return `conic-gradient(
          from var(--border-angle, 0deg),
          #ff0080,
          #ff8c00,
          #40e0d0,
          #8a2be2,
          #ff0080
        )`;
      case 'processing':
        // Purple/blue gradient for LLM processing
        return `conic-gradient(
          from var(--border-angle, 0deg),
          #8b5cf6,
          #6366f1,
          #3b82f6,
          #8b5cf6
        )`;
      case 'success':
        return 'linear-gradient(90deg, #10b981, #34d399, #10b981)';
      case 'error':
        return 'linear-gradient(90deg, #ef4444, #f87171, #ef4444)';
      default:
        return 'linear-gradient(90deg, rgba(139, 92, 246, 0.3), rgba(139, 92, 246, 0.1))';
    }
  };

  const isAnimating = state === 'recording' || state === 'processing';
  const isPulse = state === 'success' || state === 'error';

  return (
    <div
      ref={boxRef}
      className={clsx(
        'relative rounded-xl',
        className
      )}
      style={{
        '--border-angle': '0deg',
      } as React.CSSProperties}
    >
      {/* Animated border layer */}
      <div
        className={clsx(
          'absolute -inset-[2px] rounded-xl',
          'transition-opacity duration-300',
          isAnimating ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          background: getGradient(),
          filter: isAnimating ? 'blur(4px)' : 'none',
        }}
      />

      {/* Solid border for animated states */}
      <div
        className={clsx(
          'absolute -inset-[2px] rounded-xl',
          'transition-opacity duration-300',
          isAnimating ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          background: getGradient(),
        }}
      />

      {/* Pulse animation for success/error */}
      {isPulse && (
        <motion.div
          className="absolute -inset-[2px] rounded-xl"
          style={{
            background: getGradient(),
          }}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0.98, 1.02, 0.98],
          }}
          transition={{
            duration: 0.6,
            repeat: 2,
            ease: 'easeInOut',
          }}
        />
      )}

      {/* Inner content container */}
      <div
        className={clsx(
          'relative rounded-xl bg-bg-secondary',
          'transition-all duration-300',
          isAnimating && 'shadow-lg',
          state === 'recording' && 'shadow-[0_0_30px_rgba(236,72,153,0.3)]',
          state === 'processing' && 'shadow-[0_0_30px_rgba(139,92,246,0.4)]',
          state === 'success' && 'shadow-[0_0_20px_rgba(16,185,129,0.4)]',
          state === 'error' && 'shadow-[0_0_20px_rgba(239,68,68,0.4)]'
        )}
      >
        {children}
      </div>
    </div>
  );
}
