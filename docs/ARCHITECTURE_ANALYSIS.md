# VoxNote - Architektur-Analyse

Dieses Dokument beschreibt die Architektur der VoxNote App, damit ChatGPT die Struktur versteht und bei der Weiterentwicklung helfen kann.

---

## 1. Übersicht

**VoxNote** ist eine Electron + Next.js Desktop-App, die Spracheingaben in strukturierte Notizen umwandelt. Die App nutzt OpenAI für Transkription (Whisper) und Text-Enrichment (GPT-4o-mini).

### Technologie-Stack
- **Frontend**: Next.js 14, React, TailwindCSS
- **Desktop**: Electron (Main + Renderer)
- **State Management**: Zustand
- **Validierung**: Zod
- **Backend**: Supabase (Auth, PostgreSQL, RLS)
- **AI**: OpenAI (Whisper, GPT-4o-mini)

### Kernkonzepte
1. **Modes** - Verschiedene Ausgabeformate (Meeting, Tasks, Email, Plan, etc.)
2. **Intent Router** - AI-basierte Absichtserkennung
3. **Clarification State Machine** - Slot-Filling für fehlende Infos
4. **Projects** - Projektkontext für organisierte Artefakte

---

## 2. Datenfluss-Architektur

```
[User Input] → [Intent Router] → [Mode Selection] → [Enrichment] → [Artifact]
     ↓               ↓                                    ↓
  Speech/Text   OpenAI GPT-4o-mini               OpenAI GPT-4o-mini
     ↓               ↓                                    ↓
 Transkription  IntentResult                     Strukturierter Output
   (Whisper)    (mit mode, context)              (Markdown + JSON)
```

### 2.1 Vollständiger Ablauf

1. **User spricht oder tippt** → Audio wird transkribiert (Whisper)
2. **Transkript geht an Intent Router** → Analysiert Absicht mit OpenAI
3. **Intent Router gibt zurück**:
   - `create_artifact` → Direkt Enrichment starten
   - `clarify` → Rückfrage stellen, Clarification State setzen
   - `chat/help/query` → Konversationelle Antwort
   - `list_projects/create_project` → UI-Aktion auslösen
4. **Bei Clarification**: User antwortet → `resolveClarification()` → Enrichment OHNE nochmaliges Routing
5. **Enrichment** → Mode-spezifischer Prompt → Strukturiertes Ergebnis

---

## 3. Kern-Dateien und Funktionen

### 3.1 Intent Router (`electron/shared/intent-schema.ts`)

**Zweck**: Erkennt die Benutzerabsicht aus Text + Konversationshistorie.

```typescript
// Verfügbare Intents (Discriminated Union)
export const IntentSchema = z.discriminatedUnion('intent', [
  // User will Artefakt erstellen
  z.object({
    intent: z.literal('create_artifact'),
    mode: ModeIdSchema,           // z.B. 'plan', 'meeting', 'tasks'
    context: z.string().optional(), // Extrahierter Kontext
    confidence: z.number(),
  }),

  // Bot braucht mehr Info
  z.object({
    intent: z.literal('clarify'),
    mode: ModeIdSchema.optional(),
    missingField: z.string(),      // Was fehlt: 'time', 'recipient', etc.
    question: z.string(),          // Frage an User
    partialContext: z.string().optional(),
    confidence: z.number(),
  }),

  // Konversationell
  z.object({ intent: z.literal('chat'), response: z.string(), confidence: z.number() }),
  z.object({ intent: z.literal('help'), response: z.string(), confidence: z.number() }),

  // UI-Aktionen
  z.object({ intent: z.literal('list_projects'), response: z.string().optional(), confidence: z.number() }),
  z.object({ intent: z.literal('create_project'), projectName: z.string().optional(), ... }),
  // ... weitere Intents
]);
```

**System Prompt Highlights** (in `INTENT_ROUTER_PROMPT`):
- Unterscheidet **plan** (zukünftig, Strategie) vs **devnote** (vergangen, Dokumentation)
- Beispiele für Clarification-Fragen
- Projektvorschläge bei neuen Ideen

### 3.2 Modes (`electron/shared/types.ts`)

```typescript
export type ModeId =
  | 'clean'     // Text bereinigen
  | 'meeting'   // Meeting-Notizen
  | 'tasks'     // Aufgabenliste
  | 'email'     // E-Mail-Entwurf
  | 'ticket'    // Jira-Ticket
  | 'devnote'   // Changelog/Dev-Notiz (VERGANGENES)
  | 'reminder'  // Erinnerung mit Datum
  | 'plan';     // Projektplan mit Meilensteinen (ZUKÜNFTIGES)
```

### 3.3 Mode-Prompts (`electron/shared/prompts.ts`)

Jeder Mode hat einen spezifischen System-Prompt für das Enrichment.

**Beispiel: Plan-Mode**
```typescript
plan: `Your task is to create a structured project plan from the transcript.

JSON response format:
{
  "markdown": "## 📋 Projektplan: [project name]\\n\\n### Ziel\\n...### Meilensteine\\n...",
  "data": {
    "projectName": "string",
    "goal": "string",
    "milestones": [{
      "name": "string",
      "steps": ["array of steps"],
      "priority": "high|medium|low"
    }],
    "nextSteps": ["array of immediate actions"],
    "risks": ["array of risks if any"]
  }
}

Guidelines:
- Break down the project into logical milestones (3-5 typically)
- Each milestone should have concrete, actionable steps
...`
```

### 3.4 OpenAI Service (`electron/services/openai.ts`)

**Hauptfunktionen**:

```typescript
// 1. Transkription
export async function transcribeAudio(tempFilePath: string, signal?: AbortSignal): Promise<string>

// 2. Enrichment (Text → strukturiertes Artefakt)
export async function enrichText(options: {
  transcript: string;
  mode: ModeId;
  context?: string;
  language?: 'auto' | 'de' | 'en';
  signal?: AbortSignal;
}): Promise<EnrichedResult>

// 3. Intent Routing (Absichtserkennung)
export async function routeIntent(
  message: string,
  history: ChatMsgInput[],
  signal?: AbortSignal
): Promise<IntentResult>
```

**Wichtig**: JSON-Cleanup bei Parsing (für LLM-Robustheit):
```typescript
// Clean up content - remove markdown fences if present
content = content.trim();
if (content.startsWith('```json')) content = content.slice(7);
if (content.endsWith('```')) content = content.slice(0, -3);
```

### 3.5 State Management (`src/lib/store.ts`)

**Zustand Store** - Zentrale State-Verwaltung mit ~1400 Zeilen.

**Wichtige State-Felder**:
```typescript
interface AppState {
  // Phase der Konversation
  phase: 'idle' | 'recording' | 'transcribing' | 'awaiting_action' |
         'awaiting_context' | 'enriching' | 'done' | 'error' | 'cancelled';

  // Chat
  messages: ChatMessage[];

  // Pipeline
  pendingTranscript: string | null;  // Wartet auf Verarbeitung
  selectedMode: ModeId | null;

  // Clarification State Machine (M1)
  pendingClarification: PendingClarification | null;

  // Project Context (M2)
  activeProjectId: string | null;
  projects: Project[];
}
```

**Kern-Handler**:

```typescript
// 1. Transkript empfangen → Intent Router
handleTranscriptReceived: async (transcript) => {
  // Build conversation history
  const recentHistory = messages.slice(-10).map(...);

  // Route intent via OpenAI
  const intent = await ipc.routeIntent(transcript, recentHistory);

  switch (intent.intent) {
    case 'create_artifact':
      // Direkt Enrichment starten
      await ipc.startEnrichment({ transcript, mode: intent.mode, ... });
      break;

    case 'clarify':
      // Clarification State setzen
      get().setClarification({
        question: intent.question,
        kind: detectClarificationKind(intent.missingField),
        resumePayload: { intent: 'create_artifact', mode, transcript, partialContext }
      });
      break;

    case 'list_projects':
      get().setProjectSwitcherOpen(true);
      break;
      // ...
  }
}

// 2. User-Nachricht verarbeiten
handleUserMessage: async (text) => {
  // PRIORITÄT 1: Pending Clarification direkt auflösen
  if (pendingClarification) {
    await resolveClarification(text);  // Kein Re-Routing!
    return;
  }

  // Sonst: Intent Router aufrufen
  const intent = await ipc.routeIntent(text, recentHistory);
  // ...
}

// 3. Clarification auflösen (OHNE Re-Routing)
resolveClarification: async (answer) => {
  const { resumePayload } = pendingClarification;

  // Kontext kombinieren
  const combinedContext = `${resumePayload.partialContext}. ${answer}`;

  // Clarification clearen ZUERST
  set({ pendingClarification: null });

  // Direkt Enrichment starten
  await ipc.startEnrichment({
    transcript: resumePayload.transcript || answer,
    mode: resumePayload.mode,
    instruction: combinedContext,
  });
}
```

### 3.6 IPC Layer (`src/lib/ipc.ts`)

Bridge zwischen Renderer (React) und Main (Electron).

```typescript
// Safe access to electron API
function getApi(): ElectronAPI | null {
  if (typeof window !== 'undefined' && window.api) {
    return window.api;
  }
  return null;
}

// Beispiel: Intent Routing
export async function routeIntent(
  message: string,
  history: ChatMessageInput[]
): Promise<IntentResult | null> {
  const api = getApi();
  if (api) return api.routeIntent(message, history);
  return null;
}
```

### 3.7 Actions (`electron/shared/actions.ts`)

**Proposed Actions** - Aktionen, die der LLM vorschlagen kann:

```typescript
// Verfügbare Action-Typen
export type ActionType = 'create_project_scaffold' | 'create_calendar_event_ics';

// Mode → erlaubte Actions Mapping
export const MODE_ACTION_MAPPING: Record<string, ActionType[]> = {
  meeting: ['create_project_scaffold', 'create_calendar_event_ics'],
  tasks: ['create_project_scaffold'],
  devnote: ['create_project_scaffold'],
  reminder: ['create_calendar_event_ics'],
  email: [],   // Keine Actions
  ticket: [],  // Keine Actions
  clean: [],   // Keine Actions
};
```

**Robustes JSON Parsing**:
```typescript
export function parseEnrichmentResponse(content: string): ParsedEnrichmentResult {
  // Strategy 1: Direct JSON parse
  // Strategy 2: Extract from markdown code fence
  // Strategy 3: Find JSON object in text
  // Fallback: Treat as raw markdown
}
```

---

## 4. Clarification State Machine (M1)

**Problem**: Wenn der User nur "Meeting morgen" sagt, fehlt die Uhrzeit.

**Lösung**: Slot-Filling mit State Machine

```typescript
interface PendingClarification {
  id: string;
  question: string;           // "Um welche Uhrzeit ist das Meeting?"
  kind: ClarificationKind;    // 'time' | 'recipient' | 'details' | ...
  resumePayload: {
    intent: IntentType;
    mode?: ModeId;
    transcript: string;
    partialContext?: string;  // "Meeting morgen"
  };
}
```

**Flow**:
1. Intent Router erkennt fehlende Info → `clarify` Intent
2. Store setzt `pendingClarification` mit Frage + Resume-Payload
3. User antwortet (z.B. "10 Uhr")
4. `resolveClarification(answer)` kombiniert: "Meeting morgen. 10 Uhr"
5. Direkt Enrichment starten OHNE nochmaliges LLM-Routing

**Wichtig**: Das Umgehen des Re-Routings verhindert Endlosschleifen!

---

## 5. Project System (M2)

**Supabase Schema**:

```sql
-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  context TEXT,
  stack TEXT[],
  team JSONB,
  settings JSONB,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Artifacts (Notizen)
CREATE TABLE artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  mode TEXT CHECK (mode IN ('meeting','tasks','email','ticket','devnote','clean','reminder','plan')),
  transcript TEXT NOT NULL,
  result_markdown TEXT NOT NULL,
  result_data JSONB,
  ...
);

-- RLS Policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (auth.uid() = user_id);
```

**Store Integration**:
```typescript
// Projekte laden
loadProjects: async () => {
  const projects = await ipc.memoryListProjects();
  const defaultProject = projects.find(p => p.is_default);
  set({ projects, activeProjectId: defaultProject?.id || null });
}

// Intent Handler für Projekte
case 'list_projects':
  get().setProjectSwitcherOpen(true);
  break;
case 'create_project':
  get().setProjectSwitcherOpen(true);
  break;
```

---

## 6. UI Components

### 6.1 Mode System

```typescript
// ModeDock.tsx - Mode Buttons
export const MODES: ModeConfig[] = [
  { id: 'meeting', label: 'Meeting', icon: Users, hotkey: '1' },
  { id: 'tasks', label: 'Aufgaben', icon: CheckSquare, hotkey: '2' },
  { id: 'email', label: 'E-Mail', icon: Mail, hotkey: '3' },
  { id: 'ticket', label: 'Ticket', icon: Ticket, hotkey: '4' },
  { id: 'devnote', label: 'Dev Note', icon: Code, hotkey: '5' },
  { id: 'clean', label: 'Bereinigen', icon: Eraser, hotkey: '6' },
  { id: 'reminder', label: 'Erinnerung', icon: Bell, hotkey: '7' },
  { id: 'plan', label: 'Plan', icon: ClipboardList, hotkey: '8' },
];
```

### 6.2 Mode Activation Feedback

```typescript
// Store
activateModeWithFeedback: (mode) => {
  const modeLabel = MODE_ACTIONS.find(a => a.id === mode)?.label || mode;
  set({ selectedMode: mode });
  get().addMessage({
    role: 'assistant',
    content: `**${modeLabel}** Modus aktiviert. Halte Space zum Sprechen...`,
    kind: 'status',
  });
}
```

---

## 7. Bekannte Verbesserungsmöglichkeiten

### 7.1 Plan-Mode Verbesserungen
- **Mehr Detailtiefe**: Schritte mit geschätztem Aufwand
- **Abhängigkeiten**: Visueller Dependency-Graph
- **Timeline**: Optionale Zeitschätzungen
- **Progress-Tracking**: Meilensteine abhaken

### 7.2 Clarification Flow
- **Smarter Context**: Conversation-History besser nutzen
- **Multi-Slot**: Mehrere fehlende Infos auf einmal abfragen
- **Cancel-Option**: "Lass gut sein" erkennen

### 7.3 Project Integration
- **Auto-Project-Suggest**: Beim Erstellen eines Plans automatisch Projekt vorschlagen
- **Project Context in Prompts**: Projekt-Kontext ins Enrichment einbeziehen
- **Cross-Project Search**: Artefakte projektübergreifend suchen

### 7.4 UI/UX
- **Streaming-Output**: Enrichment-Ergebnis streamen
- **Undo/Redo**: Letzte Aktion rückgängig machen
- **Templates**: Vorgefertigte Prompts für häufige Tasks

---

## 8. Wichtige Code-Patterns

### 8.1 Zod für LLM-Output-Validierung
```typescript
const validated = IntentSchema.safeParse(parsed);
if (validated.success) {
  // Typsichere Verwendung
} else {
  // Graceful fallback
}
```

### 8.2 Discriminated Unions für Intents
```typescript
z.discriminatedUnion('intent', [
  z.object({ intent: z.literal('create_artifact'), mode: ... }),
  z.object({ intent: z.literal('clarify'), question: ... }),
])
```

### 8.3 State Machine Pattern
```typescript
// Phase-basierte Logik
if (phase === 'awaiting_context') {
  // Spezielle Behandlung
} else if (phase === 'idle') {
  // Standard-Flow
}
```

---

## 9. Datei-Struktur

```
voxnote/
├── electron/
│   ├── main.ts              # Electron Main Process
│   ├── preload.ts           # IPC Bridge
│   ├── services/
│   │   ├── openai.ts        # OpenAI Integration
│   │   ├── settings.ts      # Settings Management
│   │   └── ...
│   └── shared/
│       ├── types.ts         # TypeScript Types
│       ├── prompts.ts       # Mode-spezifische Prompts
│       ├── intent-schema.ts # Intent Router Schema + Prompt
│       └── actions.ts       # Proposed Actions
├── src/
│   ├── app/
│   │   └── page.tsx         # Haupt-UI
│   ├── components/
│   │   ├── ModeDock.tsx     # Mode-Auswahl
│   │   ├── ProjectChip.tsx  # Aktives Projekt anzeigen
│   │   └── ...
│   └── lib/
│       ├── store.ts         # Zustand State Management
│       └── ipc.ts           # IPC Wrapper
└── docs/
    └── ARCHITECTURE_ANALYSIS.md  # Diese Datei
```

---

## 10. Zusammenfassung für ChatGPT

**VoxNote** wandelt Sprache in strukturierte Notizen um. Der Kern-Flow ist:

1. **Input** (Sprache/Text) → **Intent Router** (OpenAI) → **Intent**
2. **Intent** bestimmt Aktion:
   - `create_artifact` → Direkt Mode-spezifisches Enrichment
   - `clarify` → Rückfrage, State Machine für Slot-Filling
   - `chat/help` → Konversationelle Antwort
   - `list_projects/create_project` → UI-Aktion
3. **Enrichment** mit Mode-Prompt → JSON mit `markdown` + `data` + `actions`
4. **Output** wird in UI angezeigt und in Supabase gespeichert

**Wichtige Konzepte**:
- **Clarification ohne Re-Routing**: `resolveClarification()` umgeht Intent Router
- **Zod Validation**: Typsichere LLM-Output-Validierung
- **Mode-spezifische Prompts**: Jeder Mode hat eigenes Output-Schema
- **Project Context**: Artefakte können Projekten zugeordnet werden

Um die App zu verbessern, konzentriere dich auf:
1. `electron/shared/intent-schema.ts` - Intent Router verbessern
2. `electron/shared/prompts.ts` - Mode-Prompts optimieren
3. `src/lib/store.ts` - Flow-Logik anpassen
