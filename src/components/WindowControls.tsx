'use client';

import { useState, useEffect } from 'react';
import { Minus, Square, Maximize2, X } from 'lucide-react';
import * as ipc from '@/lib/ipc';
import clsx from 'clsx';

interface WindowControlsProps {
  className?: string;
}

export function WindowControls({ className }: WindowControlsProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Poll window state
  useEffect(() => {
    const checkState = async () => {
      if (typeof window !== 'undefined' && window.api) {
        const [maximized, fullscreen] = await Promise.all([
          ipc.windowIsMaximized(),
          ipc.windowIsFullscreen(),
        ]);
        setIsMaximized(maximized);
        setIsFullscreen(fullscreen);
      }
    };

    checkState();
    const interval = setInterval(checkState, 500);
    return () => clearInterval(interval);
  }, []);

  const handleMinimize = () => {
    ipc.windowMinimize();
  };

  const handleMaximize = () => {
    ipc.windowMaximize();
    setIsMaximized(!isMaximized);
  };

  const handleFullscreen = () => {
    ipc.windowFullscreen();
    setIsFullscreen(!isFullscreen);
  };

  const handleClose = () => {
    ipc.hideOverlay();
  };

  return (
    <div className={clsx("flex items-center", className)}>
      {/* Drag region - allows moving the window */}
      <div className="flex-1 h-8 app-region-drag" />

      {/* Window control buttons */}
      <div className="flex items-center gap-1">
        {/* Minimize */}
        <button
          onClick={handleMinimize}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors group"
          title="Minimieren"
        >
          <Minus className="w-3.5 h-3.5 text-white/40 group-hover:text-white/70" />
        </button>

        {/* Maximize/Restore */}
        <button
          onClick={handleMaximize}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors group"
          title={isMaximized ? "Wiederherstellen" : "Maximieren"}
        >
          {isMaximized ? (
            <Square className="w-3 h-3 text-white/40 group-hover:text-white/70" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5 text-white/40 group-hover:text-white/70" />
          )}
        </button>

        {/* Fullscreen toggle (macOS double-click behavior alternative) */}
        {/* <button
          onClick={handleFullscreen}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors group"
          title={isFullscreen ? "Vollbild beenden" : "Vollbild"}
        >
          <Maximize className="w-3.5 h-3.5 text-white/40 group-hover:text-white/70" />
        </button> */}

        {/* Close (hides overlay) */}
        <button
          onClick={handleClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/20 transition-colors group"
          title="Schließen"
        >
          <X className="w-3.5 h-3.5 text-white/40 group-hover:text-red-400" />
        </button>
      </div>
    </div>
  );
}
