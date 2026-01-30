import { BrowserWindow, screen, protocol, net } from 'electron';
import * as path from 'path';
import * as url from 'url';
import type { OverlayLayout } from '../shared/types';

let overlayWindow: BrowserWindow | null = null;
let protocolRegistered = false;
let currentLayout: OverlayLayout = 'compact';
let initialPosition: { x: number; y: number } | null = null;

// Check if running in development
const isDev = !require('electron').app.isPackaged;

// Layout constants - Assistant-style window
const LAYOUTS = {
  compact: { width: 560, height: 160, minWidth: 400, minHeight: 120 },    // Minimal input bar
  expanded: { width: 600, height: 520, minWidth: 500, minHeight: 400 },   // Main assistant view
  withCanvas: { width: 920, height: 560, minWidth: 800, minHeight: 450 }, // With side panel
} as const;

export type { OverlayLayout };

function registerAppProtocol(): void {
  if (protocolRegistered) return;

  protocol.handle('app', (request) => {
    // URL format: app://./_next/... or app://./index.html
    // The '.' is the host, pathname is the file path
    const requestUrl = new URL(request.url);

    // Get the path - combine host and pathname for proper resolution
    let filePath = decodeURIComponent(requestUrl.pathname);
    if (filePath.startsWith('/')) {
      filePath = filePath.slice(1);
    }

    // Handle the case where host is '.' (relative path indicator)
    // The actual file path is just the pathname part

    // Resolve to the out directory
    const outPath = path.join(__dirname, '..', 'out');
    const fullPath = path.join(outPath, filePath);

    console.log('[Protocol] Request:', request.url, '-> File:', fullPath);

    return net.fetch(url.pathToFileURL(fullPath).toString());
  });

  protocolRegistered = true;
}

export function createOverlayWindow(): BrowserWindow {
  // Register custom protocol for serving app files
  if (!isDev) {
    registerAppProtocol();
  }

  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  // Start in compact layout - will expand when user interacts
  const windowWidth = LAYOUTS.compact.width;
  const windowHeight = LAYOUTS.compact.height;

  const x = Math.round((screenWidth - windowWidth) / 2);
  const y = Math.round((screenHeight - windowHeight) / 2);

  overlayWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    minWidth: LAYOUTS.compact.minWidth,
    minHeight: LAYOUTS.compact.minHeight,
    x,
    y,
    frame: false, // Frameless for floating bar style
    transparent: true, // Allow rounded corners and custom background
    backgroundColor: '#00000000', // Transparent background
    alwaysOnTop: true, // Float above other windows
    resizable: true, // Allow resizing
    show: false,
    skipTaskbar: true, // Don't show in dock/taskbar
    hasShadow: true, // macOS shadow
    // Note: vibrancy removed to allow custom animated background
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Store initial position for anchored resize
  initialPosition = { x, y };
  currentLayout = 'compact';

  if (isDev) {
    overlayWindow.loadURL('http://localhost:3000');
  } else {
    // Use custom app:// protocol to properly serve files from asar
    overlayWindow.loadURL('app://./index.html');
  }

  overlayWindow.on('move', () => {
    if (overlayWindow) {
      const bounds = overlayWindow.getBounds();
      initialPosition = { x: bounds.x, y: bounds.y };
    }
  });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
    initialPosition = null;
  });

  // Show window when ready
  overlayWindow.once('ready-to-show', () => {
    if (overlayWindow) {
      overlayWindow.show();
      // Open DevTools in dev mode for debugging
      if (isDev) {
        overlayWindow.webContents.openDevTools({ mode: 'detach' });
      }
    }
  });

  return overlayWindow;
}

export function getOverlayWindow(): BrowserWindow | null {
  return overlayWindow;
}

export function setOverlayLayout(layout: OverlayLayout): void {
  if (!overlayWindow) return;

  const targetSize = LAYOUTS[layout];
  const currentBounds = overlayWindow.getBounds();
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;

  // Update min size constraints
  overlayWindow.setMinimumSize(targetSize.minWidth, targetSize.minHeight);

  // Allow resizing when expanded
  overlayWindow.setResizable(layout !== 'compact');

  // Center horizontally, keep vertical position
  const newX = Math.round((screenWidth - targetSize.width) / 2);

  overlayWindow.setBounds({
    x: newX,
    y: currentBounds.y,
    width: targetSize.width,
    height: targetSize.height,
  });

  currentLayout = layout;
}

export function getOverlayLayout(): OverlayLayout {
  return currentLayout;
}

export function toggleOverlay(): void {
  if (!overlayWindow) {
    createOverlayWindow();
  }

  if (overlayWindow) {
    if (overlayWindow.isVisible()) {
      overlayWindow.hide();
    } else {
      // Show in current layout (starts compact, expands on interaction)
      overlayWindow.show();
      overlayWindow.focus();
      overlayWindow.webContents.send('overlay:toggled');
    }
  }
}

export function showOverlay(): void {
  if (!overlayWindow) {
    createOverlayWindow();
  }
  if (overlayWindow && !overlayWindow.isVisible()) {
    // Show in current layout (starts compact, expands on interaction)
    overlayWindow.show();
    overlayWindow.focus();
    overlayWindow.webContents.send('overlay:toggled');
  }
}

export function hideOverlay(): void {
  if (overlayWindow && overlayWindow.isVisible()) {
    overlayWindow.hide();
  }
}

// Window control functions
export function minimizeWindow(): void {
  if (overlayWindow) {
    overlayWindow.minimize();
  }
}

export function maximizeWindow(): void {
  if (overlayWindow) {
    if (overlayWindow.isMaximized()) {
      overlayWindow.unmaximize();
    } else {
      overlayWindow.maximize();
    }
  }
}

export function toggleFullscreen(): void {
  if (overlayWindow) {
    overlayWindow.setFullScreen(!overlayWindow.isFullScreen());
  }
}

export function isWindowMaximized(): boolean {
  return overlayWindow?.isMaximized() ?? false;
}

export function isWindowFullscreen(): boolean {
  return overlayWindow?.isFullScreen() ?? false;
}

export function sendToRenderer(channel: string, ...args: unknown[]): void {
  if (overlayWindow) {
    overlayWindow.webContents.send(channel, ...args);
  }
}
