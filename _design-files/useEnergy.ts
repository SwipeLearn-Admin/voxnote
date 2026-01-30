'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Hook that calculates audio energy (volume) from a MediaStream.
 * Returns a normalized value 0..1 representing current voice/mic energy.
 *
 * Uses RMS (Root Mean Square) for accurate energy calculation
 * with exponential moving average (EMA) for smoothing.
 */
export function useEnergy(stream: MediaStream | null, isActive: boolean) {
  const [energy, setEnergy] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const prevEnergyRef = useRef(0);

  useEffect(() => {
    // Cleanup function
    const cleanup = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      if (analyserRef.current) {
        analyserRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      setEnergy(0);
      prevEnergyRef.current = 0;
    };

    // Don't run if no stream or not active
    if (!stream || !isActive) {
      cleanup();
      return;
    }

    // Create audio context and analyser
    try {
      const audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;
      sourceRef.current = source;

      const dataArray = new Uint8Array(analyser.fftSize);

      const tick = () => {
        if (!analyserRef.current) return;

        // Get time domain data
        analyserRef.current.getByteTimeDomainData(dataArray);

        // Calculate RMS (Root Mean Square)
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          // Convert from 0-255 to -1 to 1
          const amplitude = (dataArray[i] - 128) / 128;
          sum += amplitude * amplitude;
        }
        const rms = Math.sqrt(sum / dataArray.length);

        // Scale RMS to 0-1 range (typical voice is around 0.1-0.4 RMS)
        // Multiply by 3 to make it more responsive
        const rawEnergy = Math.min(Math.max(rms * 3, 0), 1);

        // Apply exponential moving average for smoothing
        // Higher weight on new value = more responsive
        // Higher weight on old value = smoother
        const alpha = 0.3; // Responsiveness factor
        const smoothed = rawEnergy * alpha + prevEnergyRef.current * (1 - alpha);
        prevEnergyRef.current = smoothed;

        setEnergy(smoothed);

        rafRef.current = requestAnimationFrame(tick);
      };

      // Start the animation loop
      tick();
    } catch (error) {
      console.error('[useEnergy] Failed to initialize audio context:', error);
    }

    return cleanup;
  }, [stream, isActive]);

  return energy;
}

/**
 * Hook that tracks normalized mouse position (0..1 for both axes).
 * Optionally constrained to a specific element.
 */
export function useMouse(containerRef?: React.RefObject<HTMLElement>) {
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef?.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        setMouse({ x, y });
      } else {
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;
        setMouse({ x, y });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [containerRef]);

  return mouse;
}
