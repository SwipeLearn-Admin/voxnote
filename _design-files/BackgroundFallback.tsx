'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  energy: number; // 0..1 - voice/mic energy level
  mouseX: number; // 0..1 normalized mouse position
  mouseY: number; // 0..1 normalized mouse position
  isThinking?: boolean; // pulsing effect during processing
}

/**
 * Animated background that responds to:
 * - Mouse position (gradient center follows cursor)
 * - Voice energy (intensity increases with volume)
 * - Thinking state (subtle pulse animation)
 *
 * Pure CSS - works without WebGL, guaranteed to work everywhere.
 */
export function BackgroundFallback({ energy, mouseX, mouseY, isThinking = false }: Props) {
  // Calculate visual parameters based on input
  const intensity = 0.4 + energy * 0.5; // 0.4 base, up to 0.9 at full energy
  const baseHue = 220; // Blue base
  const hueShift = mouseX * 30 - 15; // -15 to +15 based on mouse X
  const hue = baseHue + hueShift;

  // Lightness increases with energy
  const lightness = 25 + energy * 25;

  // Secondary color shifts based on mouse Y
  const secondaryHue = hue + 40 + mouseY * 20;

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {/* Base dark layer */}
      <div className="absolute inset-0 bg-[#0d0d14]" />

      {/* Primary gradient - follows mouse */}
      <motion.div
        className="absolute inset-0"
        animate={{
          opacity: intensity,
        }}
        transition={{ duration: 0.3 }}
        style={{
          background: `radial-gradient(
            ellipse 80% 60% at ${mouseX * 100}% ${mouseY * 100}%,
            hsla(${hue}, 75%, ${lightness}%, 1),
            hsla(${hue}, 50%, ${lightness * 0.5}%, 0.5) 40%,
            transparent 70%
          )`,
        }}
      />

      {/* Secondary accent gradient */}
      <motion.div
        className="absolute inset-0"
        animate={{
          opacity: intensity * 0.8,
        }}
        transition={{ duration: 0.4 }}
        style={{
          background: `radial-gradient(
            ellipse 60% 50% at ${100 - mouseX * 100}% ${100 - mouseY * 100}%,
            hsla(${secondaryHue}, 70%, ${lightness}%, 0.9),
            transparent 60%
          )`,
        }}
      />

      {/* Energy burst effect - appears when speaking */}
      {energy > 0.1 && (
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{
            opacity: energy * 0.4,
            scale: 1 + energy * 0.1,
          }}
          transition={{ duration: 0.1 }}
          style={{
            background: `radial-gradient(
              circle at 50% 50%,
              hsla(${hue + 60}, 80%, 50%, ${energy * 0.3}),
              transparent 50%
            )`,
          }}
        />
      )}

      {/* Thinking pulse effect */}
      {isThinking && (
        <motion.div
          className="absolute inset-0"
          animate={{
            opacity: [0.1, 0.25, 0.1],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{
            background: `radial-gradient(
              circle at 50% 50%,
              hsla(${hue}, 70%, 40%, 0.3),
              transparent 60%
            )`,
          }}
        />
      )}

      {/* Subtle grid overlay for depth */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)',
        }}
      />
    </div>
  );
}
