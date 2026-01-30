import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { transcribeAudio, enrichText, chat, routeIntent as routeIntentAI, type ChatMessageInput, type ChatResponse } from './openai';
import type { IntentResult } from '../shared/types';
import { appendHistoryItem } from './history';
import { getSettings } from './settings';
import { sendToRenderer } from './window';
import { setLastResult } from './tray';
import {
  getDefaultProject,
  buildProjectContext,
  formatContextForLLM,
  processArtifactForMemory,
} from './memory';
import type {
  PipelinePayload,
  TranscriptionPayload,
  EnrichmentPayload,
  PipelineEvent,
  HistoryItem,
  EnrichedResult,
  AudioData,
  PipelineErrorCode,
} from '../shared/types';

// Minimum audio size in bytes (roughly 0.5s of webm audio)
const MIN_AUDIO_BYTES = 8000;

// Debug flag for audio logging
const DEBUG_AUDIO = process.env.VOXNOTE_DEBUG_AUDIO === '1' || process.env.DEBUG_AUDIO === '1';

const activeRuns = new Map<string, AbortController>();

function emitEvent(event: PipelineEvent): void {
  sendToRenderer('pipeline:event', event);
}

function getTempDir(): string {
  const tempDir = path.join(app.getPath('temp'), 'voxnote');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  return tempDir;
}

/**
 * Normalize audio data from various formats to Buffer.
 * Supports: ArrayBuffer, Uint8Array, number[] (legacy fallback)
 */
function normalizeAudioToBuffer(audio: AudioData): Buffer {
  if (Array.isArray(audio)) {
    // Legacy fallback: number[]
    return Buffer.from(Uint8Array.from(audio));
  }
  if (audio instanceof Uint8Array) {
    return Buffer.from(audio);
  }
  // ArrayBuffer
  return Buffer.from(new Uint8Array(audio));
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimeType: string): string {
  const mime = mimeType.toLowerCase();
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('ogg') || mime.includes('oga')) return 'ogg';
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('mp3') || mime.includes('mpeg')) return 'mp3';
  if (mime.includes('flac')) return 'flac';
  // Default to webm as it's most commonly supported
  return 'webm';
}

/**
 * Log audio debug information (only when DEBUG_AUDIO is enabled)
 */
function logAudioDebug(buffer: Buffer, mimeType: string, ext: string, filePath: string): void {
  if (!DEBUG_AUDIO) return;

  const header = buffer.subarray(0, 4).toString('hex');
  let format = 'unknown';

  // Detect container format from magic bytes
  if (header.startsWith('1a45dfa3')) {
    format = 'webm/matroska';
  } else if (header.startsWith('4f676753')) {
    format = 'ogg (OggS)';
  } else if (header.startsWith('52494646')) {
    format = 'wav (RIFF)';
  } else if (header.startsWith('fff') || header.startsWith('ffe')) {
    format = 'mp3';
  } else if (header.startsWith('664c6143')) {
    format = 'flac (fLaC)';
  }

  console.log('[DEBUG_AUDIO]', {
    bufferLength: buffer.length,
    headerHex: header,
    detectedFormat: format,
    mimeType,
    extension: ext,
    filePath,
  });
}

async function saveAudioToTemp(audio: AudioData, mimeType: string): Promise<string> {
  const tempDir = getTempDir();
  const ext = getExtensionFromMimeType(mimeType);
  const fileName = `recording-${Date.now()}.${ext}`;
  const filePath = path.join(tempDir, fileName);

  const buffer = normalizeAudioToBuffer(audio);

  // Log debug info if enabled
  logAudioDebug(buffer, mimeType, ext, filePath);

  // Validate minimum audio size
  if (buffer.length < MIN_AUDIO_BYTES) {
    const error = new Error('Aufnahme zu kurz – bitte 1–2 Sekunden sprechen.');
    (error as Error & { code: string }).code = 'AUDIO_TOO_SHORT';
    throw error;
  }

  // Write file and ensure it's fully flushed to disk
  // This prevents OpenAI API from reading incomplete files
  const fd = fs.openSync(filePath, 'w');
  fs.writeSync(fd, buffer);
  fs.fsyncSync(fd);
  fs.closeSync(fd);

  return filePath;
}

function cleanupTempFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      if (DEBUG_AUDIO) {
        console.log('[DEBUG_AUDIO] Cleaned up temp file:', filePath);
      }
    }
  } catch (error) {
    console.error('Failed to cleanup temp file:', filePath, error);
  }
}

/**
 * Map error to user-friendly message and code
 */
function mapErrorToCode(error: unknown): { message: string; code: PipelineErrorCode } {
  if (error instanceof Error) {
    const err = error as Error & { code?: string; status?: number };

    // Check for custom error codes
    if (err.code === 'AUDIO_TOO_SHORT') {
      return { message: err.message, code: 'AUDIO_TOO_SHORT' };
    }
    if (err.code === 'CANCELLED' || err.message === 'Cancelled') {
      return { message: 'Abgebrochen', code: 'CANCELLED' };
    }

    // Check for OpenAI API errors
    if (err.status === 401 || err.message.includes('API key')) {
      return { message: 'OpenAI API Key fehlt oder ist ungültig.', code: 'MISSING_API_KEY' };
    }
    if (err.status === 429 || err.message.includes('rate limit')) {
      return { message: 'Rate Limit erreicht. Bitte kurz warten.', code: 'RATE_LIMIT' };
    }
    if (err.message.includes('Invalid file format')) {
      return { message: 'Ungültiges Audio-Format. Bitte erneut aufnehmen.', code: 'INVALID_AUDIO_FORMAT' };
    }
    if (err.message.includes('network') || err.message.includes('ENOTFOUND') || err.message.includes('timeout')) {
      return { message: 'Netzwerkfehler. Bitte Verbindung prüfen.', code: 'NETWORK' };
    }

    return { message: err.message, code: 'UNKNOWN' };
  }

  return { message: 'Unbekannter Fehler', code: 'UNKNOWN' };
}

// Transcription-only run
export async function startTranscription(payload: TranscriptionPayload): Promise<{ runId: string }> {
  console.log('[Pipeline] startTranscription called, audio size:', payload.audio instanceof Uint8Array ? payload.audio.length : 'unknown');
  const runId = uuidv4();
  const abortController = new AbortController();
  activeRuns.set(runId, abortController);

  runTranscriptionAsync(runId, payload, abortController.signal);

  return { runId };
}

async function runTranscriptionAsync(
  runId: string,
  payload: TranscriptionPayload,
  signal: AbortSignal
): Promise<void> {
  const { audio, mimeType, language } = payload;
  let tempFilePath: string | null = null;

  console.log('[Pipeline] runTranscriptionAsync started:', {
    mimeType,
    language,
    audioSize: audio instanceof Uint8Array ? audio.length : Array.isArray(audio) ? audio.length : 'unknown',
  });

  try {
    // Save audio to temp file
    tempFilePath = await saveAudioToTemp(audio, mimeType);
    console.log('[Pipeline] Audio saved to temp file:', tempFilePath);

    // Check if cancelled before API call
    if (signal.aborted) {
      throw Object.assign(new Error('Cancelled'), { code: 'CANCELLED' });
    }

    // Transcribe
    emitEvent({ runId, type: 'status', stage: 'transcribing' });

    const transcript = await transcribeAudio(tempFilePath, signal, mimeType);

    // Check if cancelled after API call
    if (signal.aborted) {
      throw Object.assign(new Error('Cancelled'), { code: 'CANCELLED' });
    }

    emitEvent({ runId, type: 'transcript', transcript });
  } catch (error) {
    console.error('[Pipeline] Transcription error:', error);
    console.error('[Pipeline] Error details:', {
      name: (error as Error)?.name,
      message: (error as Error)?.message,
      status: (error as Error & { status?: number })?.status,
      code: (error as Error & { code?: string })?.code,
    });

    const { message, code } = mapErrorToCode(error);

    if (code === 'CANCELLED') {
      emitEvent({ runId, type: 'status', stage: 'cancelled' });
    } else {
      emitEvent({ runId, type: 'error', message, code });
    }
  } finally {
    activeRuns.delete(runId);
    // Always cleanup temp file
    if (tempFilePath) {
      cleanupTempFile(tempFilePath);
    }
  }
}

// Enrichment-only run
export async function startEnrichment(payload: EnrichmentPayload): Promise<{ runId: string }> {
  const runId = uuidv4();
  const abortController = new AbortController();
  activeRuns.set(runId, abortController);

  runEnrichmentAsync(runId, payload, abortController.signal);

  return { runId };
}

async function runEnrichmentAsync(
  runId: string,
  payload: EnrichmentPayload,
  signal: AbortSignal
): Promise<void> {
  const { transcript, mode, language, instruction, context } = payload;

  try {
    // Check if cancelled before API call
    if (signal.aborted) {
      throw Object.assign(new Error('Cancelled'), { code: 'CANCELLED' });
    }

    emitEvent({ runId, type: 'status', stage: 'enriching' });

    // Build project context if a default project exists
    let enrichedContext = instruction || context || '';
    let activeProjectId: string | null = null;

    try {
      const defaultProject = await getDefaultProject();
      if (defaultProject) {
        activeProjectId = defaultProject.id;
        const projectContext = await buildProjectContext(defaultProject.id, transcript);
        if (projectContext) {
          const formattedContext = formatContextForLLM(projectContext);
          enrichedContext = enrichedContext
            ? `${formattedContext}\n\n---\n\n${enrichedContext}`
            : formattedContext;
        }
      }
    } catch (err) {
      // Non-critical: continue without project context
      console.warn('Failed to build project context:', err);
    }

    const result = await enrichText({
      transcript,
      mode,
      context: enrichedContext || undefined,
      language,
      signal,
    });

    // Check if cancelled after API call
    if (signal.aborted) {
      throw Object.assign(new Error('Cancelled'), { code: 'CANCELLED' });
    }

    // Save to history if enabled
    const settings = getSettings();
    if (settings.saveHistory) {
      const historyItem: HistoryItem = {
        id: runId,
        createdAt: Date.now(),
        mode,
        language,
        context,
        instruction,
        title: transcript.slice(0, 60) + (transcript.length > 60 ? '...' : ''),
        transcript,
        result,
        provider: { stt: 'openai', llm: 'openai' },
      };
      appendHistoryItem(historyItem);
    }

    // Process for memory if project is active
    if (activeProjectId) {
      try {
        await processArtifactForMemory(activeProjectId, runId, transcript, result.markdown);
      } catch (err) {
        // Non-critical: log but don't fail the pipeline
        console.warn('Failed to process artifact for memory:', err);
      }
    }

    // Update tray with last result
    setLastResult(result.markdown);

    // Emit result
    emitEvent({ runId, type: 'result', result });
    emitEvent({ runId, type: 'status', stage: 'done' });
  } catch (error) {
    const { message, code } = mapErrorToCode(error);

    if (code === 'CANCELLED') {
      emitEvent({ runId, type: 'status', stage: 'cancelled' });
    } else {
      emitEvent({ runId, type: 'error', message, code });
    }
  } finally {
    activeRuns.delete(runId);
  }
}

// Legacy: Combined pipeline (kept for backwards compatibility)
export async function startPipeline(payload: PipelinePayload): Promise<{ runId: string }> {
  const runId = uuidv4();
  const abortController = new AbortController();
  activeRuns.set(runId, abortController);

  runPipelineAsync(runId, payload, abortController.signal);

  return { runId };
}

async function runPipelineAsync(
  runId: string,
  payload: PipelinePayload,
  signal: AbortSignal
): Promise<void> {
  const { audio, mimeType, mode, language, context, transcriptOverride } = payload;
  let tempFilePath: string | null = null;
  let transcript: string = '';

  try {
    if (transcriptOverride) {
      transcript = transcriptOverride;
      emitEvent({ runId, type: 'transcript', transcript });
    } else if (audio && mimeType) {
      tempFilePath = await saveAudioToTemp(audio, mimeType);
      emitEvent({ runId, type: 'status', stage: 'transcribing' });

      if (signal.aborted) {
        throw Object.assign(new Error('Cancelled'), { code: 'CANCELLED' });
      }

      transcript = await transcribeAudio(tempFilePath, signal, mimeType);
      emitEvent({ runId, type: 'transcript', transcript });
    } else {
      throw new Error('No audio or transcript provided');
    }

    if (signal.aborted) {
      throw Object.assign(new Error('Cancelled'), { code: 'CANCELLED' });
    }

    emitEvent({ runId, type: 'status', stage: 'enriching' });

    // Build project context if a default project exists
    let enrichedContext = context || '';
    let activeProjectId: string | null = null;

    try {
      const defaultProject = await getDefaultProject();
      if (defaultProject) {
        activeProjectId = defaultProject.id;
        const projectContext = await buildProjectContext(defaultProject.id, transcript);
        if (projectContext) {
          const formattedContext = formatContextForLLM(projectContext);
          enrichedContext = enrichedContext
            ? `${formattedContext}\n\n---\n\n${enrichedContext}`
            : formattedContext;
        }
      }
    } catch (err) {
      // Non-critical: continue without project context
      console.warn('Failed to build project context:', err);
    }

    const result = await enrichText({
      transcript,
      mode,
      context: enrichedContext || undefined,
      language,
      signal,
    });

    if (signal.aborted) {
      throw Object.assign(new Error('Cancelled'), { code: 'CANCELLED' });
    }

    const settings = getSettings();
    if (settings.saveHistory) {
      const historyItem: HistoryItem = {
        id: runId,
        createdAt: Date.now(),
        mode,
        language,
        context,
        title: transcript.slice(0, 60) + (transcript.length > 60 ? '...' : ''),
        transcript,
        result,
        provider: { stt: 'openai', llm: 'openai' },
      };
      appendHistoryItem(historyItem);
    }

    // Process for memory if project is active
    if (activeProjectId) {
      try {
        await processArtifactForMemory(activeProjectId, runId, transcript, result.markdown);
      } catch (err) {
        // Non-critical: log but don't fail the pipeline
        console.warn('Failed to process artifact for memory:', err);
      }
    }

    setLastResult(result.markdown);
    emitEvent({ runId, type: 'result', result });
    emitEvent({ runId, type: 'status', stage: 'done' });
  } catch (error) {
    const { message, code } = mapErrorToCode(error);

    if (code === 'CANCELLED') {
      emitEvent({ runId, type: 'status', stage: 'cancelled' });
    } else {
      emitEvent({ runId, type: 'error', message, code });
    }
  } finally {
    activeRuns.delete(runId);
    // Always cleanup temp file
    if (tempFilePath) {
      cleanupTempFile(tempFilePath);
    }
  }
}

export function cancelPipeline(runId: string): void {
  const controller = activeRuns.get(runId);
  if (controller) {
    controller.abort();
    activeRuns.delete(runId);
  }
}

export function cancelAllPipelines(): void {
  for (const [, controller] of activeRuns) {
    controller.abort();
  }
  activeRuns.clear();
}

export { getHistoryItem } from './history';

// Chat function export
export async function sendChatMessage(messages: ChatMessageInput[]): Promise<ChatResponse> {
  return chat(messages);
}

// Intent Router export
export async function routeIntent(
  message: string,
  history: ChatMessageInput[]
): Promise<IntentResult> {
  return routeIntentAI(message, history);
}

export type { ChatMessageInput, ChatResponse, IntentResult };
