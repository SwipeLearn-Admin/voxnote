/**
 * Application-wide constants for VoxNote
 * Centralizes magic numbers and configuration values
 */

// ===========================================
// RECORDING CONSTRAINTS
// ===========================================

/** Minimum recording duration in milliseconds to be considered valid */
export const MIN_RECORDING_DURATION_MS = 700;

/** Minimum audio file size in bytes to be considered valid */
export const MIN_AUDIO_BYTES = 8000;

/** Interval for MediaRecorder data chunks in milliseconds */
export const RECORDING_CHUNK_INTERVAL_MS = 1000;

// ===========================================
// UI CONFIGURATION
// ===========================================

/** Maximum height for auto-resizing textarea in pixels */
export const TEXTAREA_MAX_HEIGHT_PX = 120;

/** Duration for action result toast display in milliseconds */
export const ACTION_RESULT_TOAST_DURATION_MS = 3000;

// ===========================================
// CONVERSATION CONTEXT
// ===========================================

/** Number of recent messages to include in conversation history for LLM context */
export const CONVERSATION_HISTORY_LIMIT = 10;

/** Default number of history items to load */
export const DEFAULT_HISTORY_LIMIT = 30;

// ===========================================
// PROJECT MATCHING
// ===========================================

/** Similarity threshold for fuzzy project name matching (0-1) */
export const PROJECT_SIMILARITY_THRESHOLD = 0.6;

/** Similarity threshold for matching against active project */
export const ACTIVE_PROJECT_SIMILARITY_THRESHOLD = 0.5;

// ===========================================
// SUPPORTED MIME TYPES
// ===========================================

/** Preferred audio MIME types for recording, in order of preference */
export const SUPPORTED_AUDIO_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
] as const;

// ===========================================
// KEYBOARD SHORTCUTS
// ===========================================

export const HOTKEYS = {
  PUSH_TO_TALK: 'Space',
  CLOSE: 'Escape',
  TOGGLE_HISTORY: 'h',
  TOGGLE_PROJECTS: 'p',
  MODE_KEYS: ['1', '2', '3', '4', '5', '6', '7', '8'] as const,
} as const;
