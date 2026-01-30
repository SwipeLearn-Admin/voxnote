# VoxNote - Technische Analyse

**Stand:** Januar 2026
**Version:** 1.0.0

---

## Inhaltsverzeichnis

1. [Projektübersicht](#1-projektübersicht)
2. [Technologie-Stack](#2-technologie-stack)
3. [Architektur](#3-architektur)
4. [Projektstruktur](#4-projektstruktur)
5. [Electron Main Process](#5-electron-main-process)
6. [React Frontend](#6-react-frontend)
7. [State Management](#7-state-management)
8. [IPC-Kommunikation](#8-ipc-kommunikation)
9. [Features & Implementierung](#9-features--implementierung)
10. [UI/UX Design System](#10-uiux-design-system)
11. [Sicherheit](#11-sicherheit)
12. [Performance](#12-performance)
13. [Bekannte Limitierungen](#13-bekannte-limitierungen)

---

## 1. Projektübersicht

VoxNote ist eine Desktop-Anwendung für macOS/Windows/Linux, die Sprachaufnahmen transkribiert und mittels KI in strukturierte Formate umwandelt.

### Kernfunktionen

| Feature | Beschreibung |
|---------|--------------|
| **Push-to-Talk** | Space-Taste gedrückt halten zum Aufnehmen |
| **Transkription** | OpenAI Whisper API für Speech-to-Text |
| **6 Ausgabemodi** | Meeting-Notiz, Aufgaben, E-Mail, Ticket, Dev Note, Bereinigen |
| **Konversations-KI** | Natürliche Chat-Interaktion mit Befehlserkennung |
| **History** | Lokale Speicherung aller Transkriptionen |
| **Global Hotkey** | Cmd+Shift+Space zum Öffnen |

---

## 2. Technologie-Stack

### Core

| Technologie | Version | Zweck |
|-------------|---------|-------|
| Electron | 33.2.0 | Desktop-Framework |
| Next.js | 14.2.18 | React-Framework (Static Export) |
| React | 18.3.1 | UI-Library |
| TypeScript | 5.6.3 | Typsicherheit |

### State & Data

| Technologie | Version | Zweck |
|-------------|---------|-------|
| Zustand | 5.0.1 | State Management |
| electron-store | 8.2.0 | Settings-Persistenz |
| JSONL | - | History-Speicherung |

### UI/UX

| Technologie | Version | Zweck |
|-------------|---------|-------|
| Tailwind CSS | 3.4.15 | Styling |
| Framer Motion | 11.18.2 | Animationen |
| Lucide React | 0.460.0 | Icons |
| React Markdown | 9.0.1 | Markdown-Rendering |

### APIs & Services

| Technologie | Version | Zweck |
|-------------|---------|-------|
| OpenAI SDK | 4.72.0 | Whisper + GPT-4o-mini |

### Build Tools

| Tool | Version | Zweck |
|------|---------|-------|
| TSUP | 8.3.5 | TypeScript Bundling |
| Electron Builder | 25.1.8 | App-Packaging |
| Concurrently | 9.1.0 | Dev-Prozesse |

---

## 3. Architektur

### 3.1 Multi-Process Model

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Application                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────┐    IPC     ┌─────────────────────┐ │
│  │   Main Process      │◄──────────►│  Renderer Process   │ │
│  │   (Node.js)         │            │  (Chromium)         │ │
│  │                     │            │                     │ │
│  │  • Window Manager   │            │  • React App        │ │
│  │  • Hotkey Handler   │            │  • Zustand Store    │ │
│  │  • Tray Icon        │            │  • UI Components    │ │
│  │  • Pipeline Service │            │  • Audio Recording  │ │
│  │  • OpenAI Client    │            │                     │ │
│  │  • Settings Store   │            │                     │ │
│  │  • History Manager  │            │                     │ │
│  └─────────────────────┘            └─────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Datenfluss

```
User Input (Sprache/Text)
         │
         ▼
┌─────────────────────┐
│  React Component    │  (page.tsx / Composer.tsx)
└─────────┬───────────┘
         │
         ▼
┌─────────────────────┐
│  Zustand Store      │  (store.ts)
│  Action Dispatch    │
└─────────┬───────────┘
         │
         ▼
┌─────────────────────┐
│  IPC Bridge         │  (ipc.ts → preload.ts)
└─────────┬───────────┘
         │
         ▼
┌─────────────────────┐
│  Main Process       │  (main.ts)
│  IPC Handler        │
└─────────┬───────────┘
         │
         ▼
┌─────────────────────┐
│  Service Layer      │
│  • pipeline.ts      │
│  • openai.ts        │
│  • history.ts       │
└─────────┬───────────┘
         │
         ▼
┌─────────────────────┐
│  External APIs      │  (OpenAI Whisper + GPT)
│  Local Storage      │  (electron-store, JSONL)
└─────────┬───────────┘
         │
         ▼
┌─────────────────────┐
│  Event Emission     │  (pipeline:event)
└─────────┬───────────┘
         │
         ▼
┌─────────────────────┐
│  Store Update       │  → UI Re-render
└─────────────────────┘
```

### 3.3 Pipeline-Architektur

```
┌─────────────────────────────────────────────────────────┐
│                   Pipeline Flow                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────┐     ┌──────────────┐     ┌─────────────┐  │
│  │ Audio   │────►│ Transcription│────►│ Transcript  │  │
│  │ Input   │     │ (Whisper)    │     │ Output      │  │
│  └─────────┘     └──────────────┘     └──────┬──────┘  │
│                                              │         │
│                        User wählt Modus      │         │
│                                              ▼         │
│                                       ┌─────────────┐  │
│                                       │ Enrichment  │  │
│                                       │ (GPT-4o)    │  │
│                                       └──────┬──────┘  │
│                                              │         │
│                                              ▼         │
│                                       ┌─────────────┐  │
│                                       │ Structured  │  │
│                                       │ Output      │  │
│                                       └─────────────┘  │
│                                                         │
│  Unterstützt: Cancellation via AbortController          │
│  Error Handling: Mapped zu PipelineErrorCode            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Projektstruktur

```
voxnote/
├── electron/                      # Electron Main Process
│   ├── main.ts                   # Entry Point, IPC Setup
│   ├── preload.ts                # Context Bridge API
│   ├── services/
│   │   ├── pipeline.ts           # Transcription + Enrichment
│   │   ├── openai.ts             # OpenAI API Client
│   │   ├── window.ts             # BrowserWindow Management
│   │   ├── hotkeys.ts            # Global Shortcuts
│   │   ├── tray.ts               # System Tray
│   │   ├── settings.ts           # Electron Store
│   │   └── history.ts            # JSONL History
│   └── shared/
│       ├── types.ts              # TypeScript Interfaces
│       ├── prompts.ts            # AI System Prompts
│       └── modes.ts              # Mode Definitions
│
├── src/                          # Next.js Frontend
│   ├── app/
│   │   ├── layout.tsx            # Root Layout
│   │   ├── page.tsx              # Main Page + Recording Logic
│   │   └── globals.css           # Global Styles + CSS Variables
│   ├── components/
│   │   ├── ChatThread.tsx        # Message List
│   │   ├── Composer.tsx          # Input Area
│   │   ├── MessageBubble.tsx     # Message Rendering
│   │   ├── HistoryDrawer.tsx     # History Sidebar
│   │   ├── SettingsModal.tsx     # Settings Dialog
│   │   └── SuggestedActions.tsx  # Action Chips
│   └── lib/
│       ├── store.ts              # Zustand Store
│       ├── ipc.ts                # IPC Wrapper
│       └── markdown.ts           # Utilities
│
├── .electron/                    # Compiled Electron Output
├── out/                          # Next.js Static Export
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.mjs
```

---

## 5. Electron Main Process

### 5.1 main.ts - Entry Point

**Verantwortlichkeiten:**
- App Lifecycle (ready, activate, quit)
- Single Instance Enforcement
- IPC Handler Registration
- Hotkey Registration

**IPC Handlers:**

| Channel | Funktion |
|---------|----------|
| `overlay:toggle` | Fenster ein-/ausblenden |
| `overlay:hide` | Fenster verstecken |
| `overlay:setLayout` | Layout wechseln (compact/expanded) |
| `pipeline:transcribe` | Nur Transkription starten |
| `pipeline:enrich` | Nur Enrichment starten |
| `pipeline:start` | Legacy: Combined Pipeline |
| `pipeline:cancel` | Laufende Pipeline abbrechen |
| `chat:send` | Konversations-Nachricht senden |
| `clipboard:write` | Text in Zwischenablage |
| `history:list/get/delete/clear` | History-Operationen |
| `settings:get/set` | Einstellungen |

### 5.2 window.ts - Fenster-Management

```typescript
// Fenster-Konfiguration
{
  width: 560,              // compact
  height: 720,
  minWidth: 400,
  minHeight: 500,
  frame: true,             // Native Frame
  titleBarStyle: 'hiddenInset',  // macOS Traffic Lights
  trafficLightPosition: { x: 12, y: 12 },
  resizable: true,
  alwaysOnTop: false,
  backgroundColor: '#0a0a0b'
}
```

**Layouts:**
- `compact`: 560x720 (Standard)
- `expanded`: 920x720 (mit History-Drawer)

### 5.3 pipeline.ts - Kernlogik

**Transcription Pipeline:**
1. Audio-Daten normalisieren (Uint8Array → Buffer)
2. Temp-Datei erstellen mit korrekter Extension
3. Minimum-Größe validieren (8KB)
4. OpenAI Whisper API aufrufen
5. Temp-Datei löschen
6. Transcript via Event zurückgeben

**Enrichment Pipeline:**
1. Modus-spezifischen Prompt laden
2. GPT-4o-mini API aufrufen
3. Ergebnis in History speichern
4. Markdown via Event zurückgeben

**Error Mapping:**

| Error | Code | Message |
|-------|------|---------|
| 401 | MISSING_API_KEY | API Key fehlt oder ungültig |
| 429 | RATE_LIMIT | Rate Limit erreicht |
| Network | NETWORK | Netzwerkfehler |
| < 8KB | AUDIO_TOO_SHORT | Aufnahme zu kurz |
| AbortError | CANCELLED | Abgebrochen |

### 5.4 openai.ts - API Client

**Funktionen:**

```typescript
// Transkription
transcribeAudio(tempFilePath: string, signal?: AbortSignal): Promise<string>

// Text-Enrichment
enrichText(options: {
  transcript: string;
  mode: ModeId;
  context?: string;
  language?: 'auto' | 'de' | 'en';
  signal?: AbortSignal;
}): Promise<string>

// Konversation
chat(messages: ChatMessageInput[], signal?: AbortSignal): Promise<ChatResponse>
```

**Chat System Prompt:**
- Sprache: Deutsch
- Erkennt Befehle: record, mode_select, help, settings, history
- Gibt JSON-strukturierte Antworten zurück

### 5.5 history.ts - Persistenz

**Format:** JSONL (JSON Lines)
```json
{"id":"uuid","createdAt":1706...,"mode":"meeting","transcript":"...","result":{"markdown":"..."}}
{"id":"uuid","createdAt":1706...,"mode":"tasks","transcript":"...","result":{"markdown":"..."}}
```

**Vorteile:**
- Append-only (schnell)
- Zeilenweise lesbar
- Crash-resistent

---

## 6. React Frontend

### 6.1 page.tsx - Hauptseite

**Verantwortlichkeiten:**
- Audio-Aufnahme via MediaRecorder API
- Keyboard Shortcuts
- App-Initialisierung

**Recording Flow:**
```typescript
1. Space down → getUserMedia() → MediaRecorder.start()
2. Audio chunks sammeln (100ms Intervall)
3. Space up → MediaRecorder.stop()
4. Validierung: Duration ≥ 700ms, Size ≥ 8KB
5. ArrayBuffer via IPC an Main Process
```

**Keyboard Shortcuts:**

| Taste | Funktion |
|-------|----------|
| Space (hold) | Aufnahme |
| Escape | Abbrechen / Schließen |
| Enter | Kopieren (wenn Ergebnis) |
| ⌘+Enter | Kopieren + Schließen |
| H | History Toggle |
| S | Settings Toggle |
| R | Rerun Enrichment |

### 6.2 Components

**ChatThread.tsx**
- AnimatePresence für Message-Animationen
- Auto-Scroll zu neuesten Messages
- Recording-Indicator mit Glow-Animation
- Empty State mit Anleitung

**MessageBubble.tsx**
- Polymorphes Rendering nach Message-Kind:
  - `text`: Normale Nachricht
  - `transcript`: User-Transkript
  - `question`: Mit Suggested Actions
  - `artifact`: Markdown mit Copy-Button
  - `status`: Loading-Spinner
  - `error`: Alert mit Recovery-Aktionen

**Composer.tsx**
- Glassmorphism Input
- Dynamische Placeholder
- Quick Actions (Kopieren, Abbrechen)
- Mic-Indicator mit Puls-Animation

**HistoryDrawer.tsx**
- Framer Motion Slide-Animation
- Suche/Filter
- Item-Preview mit Zeitstempel
- Delete/Clear Funktionen

**SettingsModal.tsx**
- API Key Input (mit Toggle)
- Model Selection
- Hotkey Konfiguration
- Spring-animierter Toggle Switch

---

## 7. State Management

### 7.1 Zustand Store Struktur

```typescript
interface AppState {
  // Phase (State Machine)
  phase: 'idle' | 'recording' | 'transcribing' |
         'awaiting_action' | 'awaiting_context' |
         'enriching' | 'done' | 'error' | 'cancelled';

  // Chat
  messages: ChatMessage[];
  draftText: string;

  // Pipeline
  pendingTranscript: string | null;
  selectedMode: ModeId | null;
  instruction: string | null;
  activeRunId: string | null;
  lastArtifactMarkdown: string | null;
  lastErrorCode: PipelineErrorCode | null;

  // Recording
  isRecording: boolean;
  recordingDuration: number;

  // UI
  historyOpen: boolean;
  settingsOpen: boolean;
  activeHistoryId: string | null;

  // Data
  settings: Settings | null;
  historyItems: HistoryItem[];
  language: 'auto' | 'de' | 'en';
}
```

### 7.2 State Machine

```
                    ┌──────────────────┐
                    │      idle        │
                    └────────┬─────────┘
                             │ Space pressed
                             ▼
                    ┌──────────────────┐
                    │    recording     │
                    └────────┬─────────┘
                             │ Space released
                             ▼
                    ┌──────────────────┐
                    │  transcribing    │
                    └────────┬─────────┘
                             │ Transcript received
                             ▼
                    ┌──────────────────┐
                    │ awaiting_action  │◄──────────┐
                    └────────┬─────────┘           │
                             │ Mode selected       │
            ┌────────────────┼────────────────┐    │
            │                │                │    │
            ▼                ▼                │    │
  ┌─────────────────┐ ┌─────────────────┐    │    │
  │awaiting_context │ │   enriching     │    │    │
  └────────┬────────┘ └────────┬────────┘    │    │
           │                   │              │    │
           │ Context provided  │ Result      │    │
           └─────────►─────────┼──────────►──┘    │
                               │                   │
                               ▼                   │
                      ┌──────────────────┐        │
                      │      done        │────────┘
                      └──────────────────┘  "Auch als anderes Format?"
```

### 7.3 Key Actions

```typescript
// Transcript empfangen → Mode-Auswahl anzeigen
handleTranscriptReceived(transcript: string)

// Mode oder Aktion gewählt → Enrichment starten
handleActionSelected(actionId: string)

// User-Nachricht → Konversation oder Context
handleUserMessage(text: string)

// Enrichment fertig → Artifact anzeigen
handleEnrichmentResult(result: EnrichedResult)

// Fehler → Error-Nachricht mit Recovery
handleError(message: string, code?: PipelineErrorCode)
```

---

## 8. IPC-Kommunikation

### 8.1 Context Bridge (preload.ts)

```typescript
contextBridge.exposeInMainWorld('api', {
  // Overlay
  toggleOverlay: () => ipcRenderer.invoke('overlay:toggle'),
  hideOverlay: () => ipcRenderer.invoke('overlay:hide'),

  // Pipeline
  startTranscription: (payload) => {
    // Audio serialisieren für IPC
    const serialized = {
      audio: new Uint8Array(payload.audio),
      mimeType: payload.mimeType,
      language: payload.language
    };
    return ipcRenderer.invoke('pipeline:transcribe', serialized);
  },

  // Events
  onPipelineEvent: (callback) => {
    const handler = (_, event) => callback(event);
    ipcRenderer.on('pipeline:event', handler);
    return () => ipcRenderer.removeListener('pipeline:event', handler);
  }
});
```

### 8.2 Audio Serialisierung

**Problem:** IPC kann nicht direkt ArrayBuffer übertragen

**Lösung:**
```typescript
// Renderer → Main
Uint8Array(audioBuffer)

// Main Process
function normalizeIPCAudio(audio: unknown): AudioData {
  if (audio instanceof Uint8Array) return audio;
  if (Array.isArray(audio)) return audio as number[];
  if (audio?.type === 'Buffer') return new Uint8Array(audio.data);
  return new Uint8Array(0);
}
```

### 8.3 Event-basierte Kommunikation

```typescript
// Main → Renderer
sendToRenderer('pipeline:event', {
  runId: 'uuid',
  type: 'status',
  stage: 'transcribing'
});

// Renderer empfängt
api.onPipelineEvent((event) => {
  switch (event.type) {
    case 'status': handleStatus(event.stage);
    case 'transcript': handleTranscript(event.transcript);
    case 'result': handleResult(event.result);
    case 'error': handleError(event.message, event.code);
  }
});
```

---

## 9. Features & Implementierung

### 9.1 Push-to-Talk Recording

```typescript
// MIME-Type Auswahl (Priorität)
const mimeTypes = [
  'audio/webm;codecs=opus',  // Chrome/Electron
  'audio/webm',
  'audio/ogg;codecs=opus',   // Firefox
  'audio/ogg'
];

// MediaRecorder Setup
const recorder = new MediaRecorder(stream, { mimeType });
recorder.ondataavailable = (e) => chunks.push(e.data);
recorder.start(100); // 100ms chunks
```

### 9.2 Die 6 Output-Modi

| Modus | Beschreibung | Prompt-Fokus |
|-------|--------------|--------------|
| `clean` | Bereinigter Text | Füllwörter entfernen, Interpunktion |
| `meeting` | Meeting-Notizen | Zusammenfassung, Entscheidungen, Action Items |
| `tasks` | Aufgabenliste | Checkbox-Format, Priorisierung |
| `email` | E-Mail-Entwurf | Professionell, Betreff, Grußformel |
| `ticket` | Jira-Ticket | Titel, Beschreibung, Akzeptanzkriterien |
| `devnote` | Changelog | Feature/Fix/Change Kategorisierung |

### 9.3 Konversations-KI

**Befehlserkennung:**
```typescript
// AI analysiert und gibt zurück:
{
  message: "Hallo! Wie kann ich dir helfen?",
  command: {
    type: "none" | "record" | "mode_select" | "settings" | "history" | "help",
    mode?: "meeting" | "tasks" | ...
  }
}
```

**Beispiel-Konversation:**
```
User: "Hallo"
AI: "Hallo! Wie kann ich dir helfen?"

User: "Ich möchte eine Meeting-Notiz erstellen"
AI: "Für Meeting-Notiz kannst du jetzt Text eingeben oder Space halten um aufzunehmen."
```

### 9.4 History-System

**Speicherung:**
- Pfad: `~/Library/Application Support/voxnote/history.jsonl`
- Format: Eine JSON-Zeile pro Eintrag
- Metadaten: id, createdAt, mode, language, title, transcript, result

**Abruf:**
```typescript
// Letzte 30 Einträge, neueste zuerst
const items = await ipc.getHistory(30);
```

---

## 10. UI/UX Design System

### 10.1 CSS Variables

```css
:root {
  /* Backgrounds */
  --bg-primary: #0a0a0b;
  --bg-secondary: #12121a;
  --bg-tertiary: #1a1a24;

  /* Glassmorphism */
  --surface-glass: rgba(255, 255, 255, 0.03);
  --surface-glass-hover: rgba(255, 255, 255, 0.06);

  /* Borders */
  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-default: rgba(255, 255, 255, 0.1);

  /* Accent */
  --accent-primary: #8b5cf6;      /* Purple */
  --accent-primary-glow: rgba(139, 92, 246, 0.3);

  /* Status */
  --status-danger: #ef4444;
  --status-success: #22c55e;
  --status-warning: #f59e0b;

  /* Text */
  --text-primary: #fafafa;
  --text-secondary: #a1a1aa;
  --text-muted: #71717a;
}
```

### 10.2 Animationen

```css
/* Message Slide-In */
@keyframes messageSlideIn {
  0% { opacity: 0; transform: translateY(8px); }
  100% { opacity: 1; transform: translateY(0); }
}

/* Recording Pulse */
@keyframes recordingPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.05); }
}

/* Recording Glow */
@keyframes recordingGlow {
  0%, 100% { box-shadow: 0 0 20px var(--status-danger-glow); }
  50% { box-shadow: 0 0 30px var(--status-danger-glow); }
}
```

### 10.3 Glassmorphism

```css
.glass {
  background: var(--surface-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border-subtle);
}
```

---

## 11. Sicherheit

### 11.1 Electron Security

| Maßnahme | Status |
|----------|--------|
| Context Isolation | ✅ Aktiviert |
| Node Integration | ✅ Deaktiviert |
| Preload Script | ✅ Nur definierte APIs |
| Remote Module | ✅ Nicht verwendet |
| webSecurity | ✅ Standard (aktiviert) |

### 11.2 API Key Handling

- Gespeichert via electron-store (OS-level Encryption)
- Nie im Renderer-Prozess sichtbar
- Nur im Main Process verwendet

### 11.3 IPC Validierung

```typescript
// Audio-Größe validiert
if (buffer.length < MIN_AUDIO_BYTES) {
  throw new Error('Audio too short');
}

// Typen via TypeScript erzwungen
ipcMain.handle('pipeline:transcribe', async (_, payload: TranscriptionPayload) => {
  // Payload ist typisiert
});
```

---

## 12. Performance

### 12.1 Optimierungen

| Bereich | Optimierung |
|---------|-------------|
| **Rendering** | Framer Motion GPU-Acceleration |
| **State** | Zustand selektive Subscriptions |
| **Audio** | 100ms Chunk-Buffering |
| **History** | JSONL Append-only, Lazy Load |
| **Temp Files** | Sofortige Cleanup nach Transcription |
| **Next.js** | Static Export (kein SSR Overhead) |

### 12.2 Bundle Sizes

```
.electron/main.js     ~32 KB
.electron/preload.js  ~3 KB
out/ (Next.js)        ~500 KB (gzipped)
```

### 12.3 Memory

- Idle: ~150 MB
- Recording: ~200 MB
- Mit History: ~180 MB

---

## 13. Bekannte Limitierungen

### 13.1 Technische Limitierungen

| Bereich | Limitierung |
|---------|-------------|
| Audio-Format | Nur WebM/OGG (Browser-abhängig) |
| Offline | Nicht verfügbar (OpenAI API required) |
| Multi-Language | Nur de/en + auto |
| History-Suche | Nur Client-side Filter |

### 13.2 Geplante Verbesserungen

- [ ] Lokale Whisper-Alternative (whisper.cpp)
- [ ] Streaming-Transcription
- [ ] Multi-File Audio Import
- [ ] Custom Prompts pro Mode
- [ ] Cloud Sync für History
- [ ] Tastaturkürzel-Anpassung

---

## Appendix

### A. NPM Scripts

```bash
npm run dev          # Dev: Next.js + Electron
npm run build        # Next.js Production Build
npm run electron:dev # Electron Dev Build
npm run dist         # Distribution Package
npm run lint         # ESLint
```

### B. Environment Variables

```bash
VOXNOTE_DEBUG_AUDIO=1   # Audio Debug Logging
DEBUG_AUDIO=1           # Alternative
```

### C. Dateipfade (macOS)

```
Settings: ~/Library/Application Support/voxnote/config.json
History:  ~/Library/Application Support/voxnote/history.jsonl
Temp:     /tmp/voxnote/recording-*.webm
```

---

*Generiert am: Januar 2026*
*VoxNote Version: 1.0.0*
