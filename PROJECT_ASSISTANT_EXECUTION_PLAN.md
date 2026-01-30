# PROJECT_ASSISTANT_EXECUTION_PLAN.md

**Datum:** 2026-01-29
**Projekt:** VoxNote - Projektbasierter Personal Assistant
**Supabase Project ID:** `puiqcxfibmnoimdsdjpq` (FIXED - NIEMALS ÄNDERN)

---

## 1. AUSGANGSZUSTAND (Verifiziert)

### Was funktioniert:
- ✅ Voice Pipeline: Hotkey → Record → Transcribe → Enrich → Output
- ✅ 7 Modi: meeting, tasks, email, ticket, devnote, clean, reminder
- ✅ 2 Actions: create_project_scaffold, create_calendar_event_ics
- ✅ Intent Router: Erkennt 8 Intent-Typen
- ✅ Supabase Auth + Sync
- ✅ Local History
- ✅ Memory Service (Backend komplett)

### Was fehlt:
- ❌ Intent Executor (Intent → Action Mapping)
- ❌ Clarify State Machine (zuverlässiges Slot-Filling)
- ❌ Project UI (Chip, Switcher, Create Flow)
- ❌ Contacts mit Disambiguation
- ❌ Project Plan Updates

### Datenbank (vorhanden):
- `profiles`, `artifacts`, `tags`, `artifact_tags`
- `subscriptions`, `usage_logs`
- `projects`, `entities`, `memory_chunks`

---

## 2. ZIELZUSTAND

Die App verhält sich wie ein **projektbasierter Personal Assistant**:

1. **Active Project Context**
   - User arbeitet immer in einem Projekt-Kontext
   - Artefakte werden automatisch zugeordnet
   - Context wird bei Enrichment injiziert (bereits implementiert)

2. **Zuverlässiger Intent Flow**
   - Intent → Deterministische Ausführung
   - Clarify → Slot-Filling ohne LLM-Rerun
   - Text Path → Direkt enrichen ohne Recording

3. **Project Management**
   - Project Chip zeigt aktives Projekt
   - Switcher für schnellen Wechsel
   - Create Flow für neue Projekte

4. **Contacts (M3)**
   - Personen aus Konversationen extrahieren
   - Bei Mehrdeutigkeit nachfragen
   - Notizen speichern

5. **Project Plan (M4)**
   - Plan-Items aus Artefakten extrahieren
   - Updates vorschlagen
   - Apply/Undo

---

## 3. ARCHITEKTURPRINZIPIEN

### Renderer (Next.js)
- Kein `fs`, keine Secrets
- Alle Backend-Calls via IPC
- State Management via Zustand
- UI-only Logic

### Main (Electron)
- Secrets in `process.env`
- OpenAI Calls
- Filesystem Operations
- Action Execution

### Supabase
- Auth + Storage
- RLS aktiv (nicht deaktivieren)
- Project ID fest: `puiqcxfibmnoimdsdjpq`

---

## 4. DATENMODELL

### Existierende Tabellen (keine Änderung)

```sql
-- Bereits vorhanden:
-- profiles, artifacts, tags, artifact_tags
-- subscriptions, usage_logs
-- projects, entities, memory_chunks
```

### Neue Tabelle: project_plan_items (M4)

```sql
CREATE TABLE project_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  parent_id UUID REFERENCES project_plan_items(id),
  type TEXT NOT NULL CHECK (type IN ('milestone', 'task', 'note')),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done', 'cancelled')),
  priority INTEGER DEFAULT 0,
  due_date TIMESTAMPTZ,
  order_index INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  source_artifact_id UUID REFERENCES artifacts(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE project_plan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own plan items"
  ON project_plan_items
  FOR ALL
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_plan_items_project ON project_plan_items(project_id, status, order_index);
CREATE INDEX idx_plan_items_user ON project_plan_items(user_id, updated_at DESC);
```

### Neue Tabelle: contacts (M3) - Optional

```sql
-- Contacts sind vorerst als entities mit type='person' abgebildet
-- Später: Dedizierte contacts Tabelle wenn nötig

-- contact_notes können in entities.metadata gespeichert werden
-- oder als separate memory_chunks mit chunk_type='contact_note'
```

---

## 5. MILESTONES

### M1 — Intent Executor + Clarify State Machine

**Ziele:**
- Intent Router Output wird deterministisch ausgeführt
- Clarify wird stabil: Antwort wird IMMER dem offenen Prompt zugeordnet
- Text Path: create_artifact ohne Recording möglich

**Tasks:**

1. **Store erweitern** (`src/lib/store.ts`)
   ```typescript
   interface PendingClarification {
     id: string;
     question: string;
     kind: 'time' | 'recipient' | 'project' | 'person' | 'details';
     options?: string[];
     resumePayload: {
       intent: IntentType;
       mode?: ModeId;
       transcript: string;
       partialContext?: string;
     };
   }

   // Neuer State
   pendingClarification: PendingClarification | null;
   activeProjectId: string | null;

   // Neue Actions
   setClarification: (clarification: PendingClarification | null) => void;
   resolveClarification: (answer: string) => Promise<void>;
   setActiveProjectId: (id: string | null) => void;
   applyIntent: (intent: IntentResult) => Promise<void>;
   ```

2. **Intent Execution Layer** (`src/lib/intent-executor.ts`)
   ```typescript
   export async function applyIntent(
     intent: IntentResult,
     store: AppState
   ): Promise<void> {
     switch (intent.intent) {
       case 'create_artifact':
         if (intent.mode && store.pendingTranscript) {
           // Direkt enrichen
           await store.startEnrichment();
         } else if (intent.mode && !store.pendingTranscript) {
           // Text als Transcript verwenden
           // ... (Text Path)
         }
         break;

       case 'clarify':
         store.setClarification({
           id: uuidv4(),
           question: intent.question!,
           kind: detectClarificationKind(intent),
           resumePayload: {
             intent: 'create_artifact',
             mode: intent.mode,
             transcript: store.pendingTranscript || '',
             partialContext: intent.partialContext,
           },
         });
         break;

       case 'record':
         // Auto-Start Recording (falls möglich)
         // oder: Zeige "Space drücken" Hinweis
         break;

       // ... andere Intents
     }
   }
   ```

3. **Clarify Resolution** (`src/lib/store.ts`)
   ```typescript
   resolveClarification: async (answer: string) => {
     const { pendingClarification, addMessage, language } = get();
     if (!pendingClarification) return;

     // Kombiniere Answer mit Resume-Payload
     const { resumePayload } = pendingClarification;
     const combinedContext = resumePayload.partialContext
       ? `${resumePayload.partialContext}. ${answer}`
       : answer;

     // Clear clarification FIRST
     set({ pendingClarification: null });

     // Direkt enrichen ohne LLM-Rerun
     const mode = resumePayload.mode || 'meeting';

     addMessage({
       role: 'assistant',
       content: `Erstelle ${MODE_ACTIONS.find(a => a.id === mode)?.label}...`,
       kind: 'status',
       isStreaming: true,
     });

     set({
       phase: 'enriching',
       selectedMode: mode,
       instruction: combinedContext,
     });

     const response = await ipc.startEnrichment({
       transcript: resumePayload.transcript || answer,
       mode,
       language,
       instruction: combinedContext,
     });

     if (response) {
       set({ activeRunId: response.runId });
     }
   }
   ```

4. **handleUserMessage anpassen**
   ```typescript
   handleUserMessage: async (text) => {
     const { pendingClarification } = get();

     // PRIORITY 1: Clarification Resolution
     if (pendingClarification) {
       get().addMessage({ role: 'user', content: text, kind: 'text' });
       await get().resolveClarification(text);
       return;
     }

     // ... Rest der Logik
   }
   ```

**DoD:**
- [ ] "Meeting morgen" → "Wann?" → "10 Uhr" → Ergebnis wird korrekt erzeugt
- [ ] Keine doppelten LLM-Calls bei Clarify-Antwort
- [ ] Text-Input ohne Recording wird als Transcript verwendet

---

### M2 — Projects MVP

**Ziele:**
- Projekte persistent in Supabase (bereits vorhanden)
- Active Project UI (Chip + Dropdown)
- Artifacts werden automatisch zugeordnet

**Tasks:**

1. **Store erweitern**
   ```typescript
   // Neuer State
   projects: Project[];
   activeProjectId: string | null;
   projectsLoading: boolean;

   // Neue Actions
   loadProjects: () => Promise<void>;
   createProject: (project: CreateProjectInput) => Promise<Project | null>;
   setActiveProject: (projectId: string | null) => Promise<void>;
   ```

2. **ProjectChip.tsx** (Minimal UI)
   ```typescript
   // Zeigt aktives Projekt oder "Kein Projekt"
   // Click öffnet Dropdown/Modal
   ```

3. **ProjectSwitcher.tsx**
   ```typescript
   // Dropdown mit:
   // - Alle Projekte
   // - "Neues Projekt erstellen"
   // - "Ohne Projekt"
   ```

4. **CreateProjectModal.tsx**
   ```typescript
   // Minimale Felder:
   // - Name (required)
   // - Beschreibung (optional)
   // - Als Standard setzen (checkbox)
   ```

5. **Auto-Assign bei Enrichment**
   ```typescript
   // In pipeline.ts (bereits vorhanden):
   // - getDefaultProject() wird aufgerufen
   // - Context wird injiziert

   // NEU: Artifact bekommt project_id
   // In enrichText Response oder History-Save
   ```

6. **UI Integration**
   ```typescript
   // In page.tsx:
   // - ProjectChip oben im Header
   // - Hotkey Cmd+P für Switcher
   ```

**DoD:**
- [ ] Projekt erstellen funktioniert
- [ ] Aktives Projekt wird angezeigt
- [ ] Projekt wechseln funktioniert
- [ ] Neue Artefakte werden automatisch zugeordnet

---

### M3 — Contacts MVP (Später)

**Ziele:**
- Kontakte aus Konversationen extrahieren
- Bei Mehrdeutigkeit nachfragen
- Notizen zu Kontakten speichern

**Tasks:**
1. Contact Disambiguation Logic
2. "Welcher Max?" Flow
3. Contact Notes in Entity Metadata
4. Contact List UI (optional)

**DoD:**
- [ ] "Treffe Max" mit 2 Maxen → Fragt nach
- [ ] Neuer Kontakt kann angelegt werden
- [ ] Notiz wird richtigem Kontakt zugeordnet

---

### M4 — Project Plan Updates (Später)

**Ziele:**
- Plan-Items aus Artefakten extrahieren
- Updates vorschlagen
- Apply/Undo

**Tasks:**
1. DB Migration (project_plan_items)
2. Plan Service
3. Enrichment Response erweitern
4. Update Preview UI
5. Apply/Undo Logic

**DoD:**
- [ ] Action Items aus Meeting werden als Tasks vorgeschlagen
- [ ] User kann Apply/Reject
- [ ] Tasks erscheinen in Projekt

---

## 6. SMOKE TESTS

### Test 1: Clarify Flow
```
1. Öffne App
2. Sage: "Meeting morgen"
3. Bot fragt: "Wann?"
4. Antworte: "10 Uhr"
5. ERWARTUNG: Meeting-Notiz wird erstellt (ohne erneute Nachfrage)
```

### Test 2: Text Path
```
1. Öffne App
2. Tippe: "Erinnerung: Arzt am Freitag um 15 Uhr"
3. ERWARTUNG: Reminder wird direkt erstellt (ohne Recording)
```

### Test 3: Project Context
```
1. Erstelle Projekt "VoxNote"
2. Setze als Standard
3. Sage: "Meeting mit Max über API Design"
4. ERWARTUNG: Artefakt wird Projekt zugeordnet, Context enthält Projekt-Info
```

### Test 4: Project Switch
```
1. Erstelle Projekt A
2. Erstelle Projekt B
3. Wechsle zu Projekt B
4. Erstelle Notiz
5. ERWARTUNG: Notiz gehört zu Projekt B
```

---

## 7. DEBUG CHECKLIST

### Bei Clarify-Problemen:
- [ ] Prüfe `pendingClarification` State
- [ ] Prüfe ob `handleUserMessage` Clarification checkt ZUERST
- [ ] Prüfe Console auf LLM-Calls (sollte nur 1 sein)

### Bei Project-Problemen:
- [ ] Prüfe `activeProjectId` State
- [ ] Prüfe Supabase Console für RLS-Fehler
- [ ] Prüfe `getDefaultProject()` Return

### Bei Intent-Problemen:
- [ ] Prüfe Intent Router Response (Console)
- [ ] Prüfe `applyIntent` Switch-Case
- [ ] Prüfe Phase-Transitions

---

## 8. IMPLEMENTIERUNGSREIHENFOLGE

```
┌─────────────────────────────────────────────────────┐
│ M1: Intent Executor + Clarify State Machine        │
│ ├── 1. Store: pendingClarification State           │
│ ├── 2. Store: resolveClarification Action          │
│ ├── 3. Store: handleUserMessage anpassen           │
│ ├── 4. intent-executor.ts erstellen                │
│ └── 5. Text Path implementieren                    │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ M2: Projects MVP                                    │
│ ├── 1. Store: projects, activeProjectId State      │
│ ├── 2. Store: loadProjects, setActiveProject       │
│ ├── 3. ProjectChip.tsx                             │
│ ├── 4. ProjectSwitcher.tsx                         │
│ ├── 5. CreateProjectModal.tsx                      │
│ └── 6. page.tsx Integration                        │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ M3: Contacts MVP (später)                           │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ M4: Project Plan Updates (später)                   │
└─────────────────────────────────────────────────────┘
```

---

**END OF EXECUTION PLAN**
