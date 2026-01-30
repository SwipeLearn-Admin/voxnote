import { Tray, Menu, nativeImage, app, NativeImage } from 'electron';
import * as path from 'path';
import { toggleOverlay } from './window';

let tray: Tray | null = null;
let lastResult: string | null = null;

export function setLastResult(result: string): void {
  lastResult = result;
  updateTrayMenu();
}

export function getLastResult(): string | null {
  return lastResult;
}

function createTrayIcon(): NativeImage {
  // Create a simple 16x16 template image for the tray
  // In production, you'd use a proper icon file
  const icon = nativeImage.createEmpty();

  // Try to load icon from resources, fallback to empty
  try {
    const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png');
    return nativeImage.createFromPath(iconPath);
  } catch {
    // Create a simple colored icon as fallback
    return nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAbwAAAG8B8aLcQwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAABVSURBVDiNY2AYBaNgFIwCqgJGBgYGhv///zMwMDAwMDExMTAwMDD8//+fgYmJiYGBgYHh////DIyMjAwMDAz/GRkZGZiYmBgZGBgY/v//z8A4CkYBHQEAfQ0L+wQ5M+QAAAAASUVORK5CYII='
    );
  }
}

function updateTrayMenu(): void {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Toggle VoxNote',
      click: () => toggleOverlay(),
    },
    {
      label: 'Copy Last Result',
      enabled: lastResult !== null,
      click: () => {
        if (lastResult) {
          const { clipboard } = require('electron');
          clipboard.writeText(lastResult);
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(contextMenu);
}

export function createTray(): Tray {
  const icon = createTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('VoxNote');

  tray.on('click', () => {
    toggleOverlay();
  });

  updateTrayMenu();

  return tray;
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
