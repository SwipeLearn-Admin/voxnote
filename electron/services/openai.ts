import OpenAI from 'openai';
import * as fs from 'fs';
import { getApiKey, getTranscribeModel, getChatModel } from './settings';
import { getPromptForMode, buildUserMessage } from '../shared/prompts';
import { INTENT_ROUTER_PROMPT, IntentSchema } from '../shared/intent-schema';
import { parseEnrichmentResponse } from '../shared/actions';
import type { ModeId, IntentResult, EnrichedResult, ChatMessageInput as ChatMsgInput } from '../shared/types';

let openaiClient: OpenAI | null = null;

/**
 * Custom error class for API key issues
 */
class MissingApiKeyError extends Error {
  status = 401;
  constructor() {
    super('Systemkonfiguration fehlt: OPENAI_API_KEY nicht gesetzt.');
    this.name = 'MissingApiKeyError';
  }
}

function getClient(): OpenAI {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new MissingApiKeyError();
  }

  // Recreate client if API key might have changed
  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

/**
 * Wrap OpenAI errors with additional context
 */
function wrapOpenAIError(error: unknown): Error {
  if (error instanceof Error) {
    const err = error as Error & { status?: number; code?: string };

    // Preserve status code for upstream error mapping
    if (err.status) {
      return err;
    }

    // Network errors
    if (err.message.includes('ENOTFOUND') || err.message.includes('ECONNREFUSED')) {
      const networkError = new Error('Network error: Unable to reach OpenAI API');
      (networkError as Error & { code: string }).code = 'NETWORK';
      return networkError;
    }

    // Timeout errors
    if (err.message.includes('timeout') || err.name === 'AbortError') {
      const timeoutError = new Error('Request timeout');
      (timeoutError as Error & { code: string }).code = 'NETWORK';
      return timeoutError;
    }

    return err;
  }

  return new Error('Unknown error occurred');
}

export async function transcribeAudio(
  tempFilePath: string,
  signal?: AbortSignal,
  mimeType?: string
): Promise<string> {
  const client = getClient();
  const model = getTranscribeModel();

  const fileName = tempFilePath.split('/').pop() || 'audio.webm';
  const fileStats = fs.statSync(tempFilePath);

  // Determine the correct MIME type
  const detectedMimeType = mimeType ||
    (fileName.endsWith('.ogg') ? 'audio/ogg' :
     fileName.endsWith('.webm') ? 'audio/webm' :
     'audio/webm');

  console.log('[OpenAI] Transcribing file:', fileName, 'size:', fileStats.size, 'mimeType:', detectedMimeType);

  // Try multiple approaches for better compatibility
  const fileBuffer = fs.readFileSync(tempFilePath);

  // Approach 1: Use toFile with detected MIME type
  try {
    const file = await OpenAI.toFile(fileBuffer, fileName, { type: detectedMimeType });
    const response = await client.audio.transcriptions.create(
      {
        file: file,
        model,
        response_format: 'text',
      },
      { signal }
    );
    return typeof response === 'string' ? response : (response as unknown as string);
  } catch (error) {
    console.error('[OpenAI] Transcription with detected MIME failed, trying alternatives...');
  }

  // Approach 2: Try with generic audio/webm
  try {
    const file = await OpenAI.toFile(fileBuffer, fileName, { type: 'audio/webm' });
    const response = await client.audio.transcriptions.create(
      {
        file: file,
        model,
        response_format: 'text',
      },
      { signal }
    );
    return typeof response === 'string' ? response : (response as unknown as string);
  } catch (error) {
    console.error('[OpenAI] Transcription with audio/webm failed, trying ogg...');
  }

  // Approach 3: Try with audio/ogg (sometimes webm files are actually ogg)
  try {
    const file = await OpenAI.toFile(fileBuffer, 'audio.ogg', { type: 'audio/ogg' });
    const response = await client.audio.transcriptions.create(
      {
        file: file,
        model,
        response_format: 'text',
      },
      { signal }
    );
    return typeof response === 'string' ? response : (response as unknown as string);
  } catch (fallbackError) {
    throw wrapOpenAIError(fallbackError);
  }
}

export async function enrichText(options: {
  transcript: string;
  mode: ModeId;
  context?: string;
  language?: 'auto' | 'de' | 'en';
  signal?: AbortSignal;
}): Promise<EnrichedResult> {
  const { transcript, mode, context, language, signal } = options;
  const client = getClient();
  const model = getChatModel();

  const systemPrompt = getPromptForMode(mode);
  const userMessage = buildUserMessage(transcript, context, language);

  try {
    const response = await client.chat.completions.create(
      {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      },
      { signal }
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse with robust JSON extraction strategy
    const parsed = parseEnrichmentResponse(content);

    return {
      markdown: parsed.markdown,
      json: parsed.data,
      actions: parsed.actions,
    };
  } catch (error) {
    throw wrapOpenAIError(error);
  }
}

export function validateApiKey(): boolean {
  const apiKey = getApiKey();
  return !!apiKey && apiKey.length > 0;
}

export type ChatMessageRole = 'system' | 'user' | 'assistant';

export interface ChatMessageInput {
  role: ChatMessageRole;
  content: string;
}

export interface ChatResponse {
  message: string;
  detectedCommand?: {
    type: 'record' | 'mode_select' | 'help' | 'settings' | 'history' | 'none';
    mode?: ModeId;
    context?: string;
  };
}

const CHAT_SYSTEM_PROMPT = `Du bist VoxNote, ein freundlicher KI-Assistent für Sprachnotizen und Textverarbeitung.

Deine Hauptfunktionen:
- Sprachaufnahmen transkribieren
- Text in verschiedene Formate umwandeln: Meeting-Notizen, Aufgabenlisten, E-Mails, Tickets, Dev Notes, oder bereinigter Text

Wenn der User dich begrüßt (z.B. "Hallo", "Hi"), antworte freundlich und frage, wie du helfen kannst.

Wenn der User explizit einen Befehl gibt, erkenne diesen und antworte entsprechend:
- "ich möchte aufnehmen" / "neue Aufnahme" → Befehl: record
- "mach eine Meeting-Notiz" / "erstelle Aufgaben" etc. → Befehl: mode_select mit entsprechendem Modus
- "Einstellungen" / "settings" → Befehl: settings
- "zeig mir die History" → Befehl: history
- "was kannst du?" / "hilfe" → Befehl: help

Antworte IMMER auf Deutsch, es sei denn der User schreibt auf Englisch.

Antworte in diesem JSON-Format:
{
  "message": "Deine freundliche Antwort an den User",
  "command": {
    "type": "record" | "mode_select" | "help" | "settings" | "history" | "none",
    "mode": "meeting" | "tasks" | "email" | "ticket" | "devnote" | "clean" (nur bei mode_select),
    "context": "optionaler Kontext"
  }
}`;

export async function chat(
  messages: ChatMessageInput[],
  signal?: AbortSignal
): Promise<ChatResponse> {
  const client = getClient();
  const model = getChatModel();

  // Build conversation with system prompt
  const chatMessages = [
    { role: 'system' as const, content: CHAT_SYSTEM_PROMPT },
    ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ];

  try {
    const response = await client.chat.completions.create(
      {
        model,
        messages: chatMessages,
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      },
      { signal }
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        message: 'Entschuldigung, ich konnte keine Antwort generieren.',
      };
    }

    try {
      const parsed = JSON.parse(content);
      return {
        message: parsed.message || 'Hallo! Wie kann ich dir helfen?',
        detectedCommand: parsed.command?.type !== 'none' ? {
          type: parsed.command?.type || 'none',
          mode: parsed.command?.mode,
          context: parsed.command?.context,
        } : undefined,
      };
    } catch {
      // If JSON parsing fails, return raw message
      return { message: content };
    }
  } catch (error) {
    throw wrapOpenAIError(error);
  }
}

/**
 * Route user intent using AI
 * Analyzes user message and determines the appropriate action
 */
export async function routeIntent(
  message: string,
  history: ChatMsgInput[],
  signal?: AbortSignal
): Promise<IntentResult> {
  const client = getClient();
  const model = getChatModel();

  // Build conversation context (last 5 messages for context)
  const recentHistory = history.slice(-5).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  const messages = [
    { role: 'system' as const, content: INTENT_ROUTER_PROMPT },
    ...recentHistory,
    { role: 'user' as const, content: message },
  ];

  try {
    const response = await client.chat.completions.create(
      {
        model,
        messages,
        temperature: 0.3,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      },
      { signal }
    );

    let content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        intent: 'chat',
        response: 'Entschuldigung, ich konnte deine Anfrage nicht verarbeiten.',
        confidence: 0.5,
      };
    }

    // Clean up content - remove markdown fences if present
    content = content.trim();
    if (content.startsWith('```json')) {
      content = content.slice(7);
    } else if (content.startsWith('```')) {
      content = content.slice(3);
    }
    if (content.endsWith('```')) {
      content = content.slice(0, -3);
    }
    content = content.trim();

    try {
      const parsed = JSON.parse(content);

      // Validate with Zod schema
      const validated = IntentSchema.safeParse(parsed);

      if (validated.success) {
        const intent = validated.data;
        return {
          intent: intent.intent,
          mode: 'mode' in intent ? intent.mode : undefined,
          context: 'context' in intent ? intent.context : undefined,
          response: 'response' in intent ? intent.response : undefined,
          question: 'question' in intent ? intent.question : undefined,
          missingField: 'missingField' in intent ? intent.missingField : undefined,
          partialContext: 'partialContext' in intent ? intent.partialContext : undefined,
          action: 'action' in intent ? intent.action : undefined,
          confidence: intent.confidence,
        };
      }

      // Fallback if validation fails - try to use what we got
      console.warn('Intent validation failed:', validated.error.message);
      console.warn('Parsed content was:', JSON.stringify(parsed, null, 2));

      // Try to use the parsed data even if validation failed
      const fallbackIntent = parsed.intent || 'chat';
      const fallbackResponse = parsed.response || parsed.question || 'Wie kann ich dir helfen?';

      return {
        intent: fallbackIntent as IntentResult['intent'],
        mode: parsed.mode,
        context: parsed.context,
        response: fallbackResponse,
        question: parsed.question,
        missingField: parsed.missingField,
        partialContext: parsed.partialContext,
        action: parsed.action,
        confidence: parsed.confidence || 0.5,
      };
    } catch (parseError) {
      console.error('Failed to parse intent response:', parseError);
      console.error('Raw content was:', content);

      // Try to extract a meaningful response from non-JSON content
      if (content && typeof content === 'string' && content.length > 0) {
        return {
          intent: 'chat',
          response: content.slice(0, 500), // Use the raw content as response
          confidence: 0.3,
        };
      }

      return {
        intent: 'chat',
        response: 'Wie kann ich dir helfen? Beschreibe mir dein Anliegen.',
        confidence: 0.3,
      };
    }
  } catch (error) {
    throw wrapOpenAIError(error);
  }
}
