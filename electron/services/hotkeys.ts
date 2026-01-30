import { globalShortcut, dialog } from 'electron';

let currentHotkey: string | null = null;
let hotkeyCallback: (() => void) | null = null;

export function registerHotkey(accelerator: string, onPress: () => void): boolean {
  // Unregister existing hotkey if any
  if (currentHotkey) {
    try {
      globalShortcut.unregister(currentHotkey);
    } catch {
      // Ignore errors when unregistering
    }
    currentHotkey = null;
  }

  hotkeyCallback = onPress;

  try {
    const success = globalShortcut.register(accelerator, () => {
      if (hotkeyCallback) {
        hotkeyCallback();
      }
    });

    if (success) {
      currentHotkey = accelerator;
      console.log(`Hotkey registered: ${accelerator}`);
      return true;
    } else {
      console.error(`Failed to register hotkey: ${accelerator}`);
      dialog.showErrorBox(
        'Hotkey Registration Failed',
        `Could not register the hotkey "${accelerator}". It may be in use by another application.`
      );
      return false;
    }
  } catch (error) {
    console.error(`Error registering hotkey: ${error}`);
    dialog.showErrorBox(
      'Invalid Hotkey',
      `The hotkey "${accelerator}" is not valid. Please use a valid key combination.`
    );
    return false;
  }
}

export function unregisterHotkey(): void {
  if (currentHotkey) {
    try {
      globalShortcut.unregister(currentHotkey);
    } catch {
      // Ignore errors
    }
    currentHotkey = null;
  }
}

export function unregisterAllHotkeys(): void {
  globalShortcut.unregisterAll();
  currentHotkey = null;
  hotkeyCallback = null;
}

export function getCurrentHotkey(): string | null {
  return currentHotkey;
}
