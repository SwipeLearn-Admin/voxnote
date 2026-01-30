'use client';

import { useState, useCallback } from 'react';
import * as ipc from '@/lib/ipc';

/**
 * Hook for unified clipboard copy functionality.
 * Handles IPC call and provides visual feedback state.
 */
export function useCopy(resetDelay = 2000) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    if (!text) return;

    try {
      await ipc.copyToClipboard(text);
      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, resetDelay);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }, [resetDelay]);

  const reset = useCallback(() => {
    setCopied(false);
  }, []);

  return { copy, copied, reset };
}
