# PROJECT_ASSISTANT_EVALUATION.md

**Datum:** 2026-01-29
**Projekt:** VoxNote - Personal Assistant
**Supabase Project ID:** `puiqcxfibmnoimdsdjpq` (FIXED)

---

## 1. EXECUTIVE SUMMARY

| Kategorie | Status | Bemerkung |
|-----------|--------|-----------|
| Core Pipeline (Record → Transcribe → Enrich) | ✅ Stabil | Funktioniert zuverlässig |
| Intent Router | ✅ Vorhanden | Erkennt Intents, aber Execution ist lückenhaft |
| Clarify Flow | ⚠️ Teilweise | Funktioniert, aber nicht zuverlässig bei Follow-ups |
| Projects/Memory System | ⚠️ Backend nur | DB + Service vorhanden, keine UI |
| Contacts/Disambiguation | ❌ Fehlt | Nicht implementiert |
| Action Execution | ✅ Stabil | 2 Actions funktionieren (Scaffold, ICS) |

**Gesamt-Readiness für Ziel:** ~55%

---

## 2. VERIFIZIERTE KOMPONENTEN

### 2.1 Datenbank (Supabase)

**Existierende Tabellen (alle mit RLS aktiviert):**

| Tabelle | Rows | Zweck | Status |
|---------|------|-------|--------|
| `profiles` | 0 | User-Profile (1:1 auth.users) | ✅ OK |
| `artifacts` | 0 | Artefakte/Notizen | ✅ OK, hat `project_id` FK |
| `tags` | 0 | Tags für Kategorisierung | ✅ OK |
| `artifact_tags` | 0 | M:N Join Table | ✅ OK |
| `subscriptions` | 0 | Abo-Management | ✅ OK |
| `usage_logs` | 0 | Usage Tracking | ✅ OK |
| `projects` | 0 | Projekt-Kontext | ✅ OK |
| `entities` | 0 | Personen/Konzepte/etc. | ✅ OK |
| `memory_chunks` | 0 | RAG-Chunks mit Embeddings | ✅ OK |

**Existierende Functions:**
- `handle_new_user` - Trigger für Profile-Erstellung
- `handle_new_profile_subscription` - Trigger für Subscription
- `update_updated_at_column` - Timestamp-Update
- `find_entities` - Entity-Suche (mit Trigram)
- `search_memory` - Semantische Suche (pgvector)

**Security Warnings (nicht kritisch):**
- 3 Functions ohne festen `search_path` - Best Practice Fix empfohlen

### 2.2 Intent Router (`electron/shared/intent-schema.ts`)

**Unterstützte Intents:**

| Intent | Erkannt | Ausgeführt | Bemerkung |
|--------|---------|------------|-----------|
| `create_artifact` | ✅ | ⚠️ | Startet Enrichment, aber NICHT automatisch Recording |
| `clarify` | ✅ | ⚠️ | Zeigt Frage, aber Follow-up oft nicht korrekt kombiniert |
| `record` | ✅ | ❌ | Zeigt nur Text, startet NICHT Recording |
| `query` | ✅ | ✅ | Zeigt Antwort |
| `settings` | ✅ | ✅ | Öffnet Settings |
| `history` | ✅ | ✅ | Öffnet History |
| `help` | ✅ | ✅ | Zeigt Hilfe |
| `chat` | ✅ | ✅ | Zeigt Antwort |

### 2.3 Actions (`electron/shared/actions.ts`)

| Action | Schema | Execution | UI Confirm |
|--------|--------|-----------|------------|
| `create_project_scaffold` | ✅ Zod | ✅ Main | ✅ Modal |
| `create_calendar_event_ics` | ✅ Zod | ✅ Main | ✅ Modal |

### 2.4 Memory Service (`electron/services/memory.ts`)

| Feature | Implementiert | Integriert | UI |
|---------|--------------|------------|-----|
| Projects CRUD | ✅ | ✅ IPC | ❌ |
| Entities CRUD | ✅ | ✅ IPC | ❌ |
| Memory Chunks | ✅ | ✅ Pipeline | ❌ |
| Semantic Search | ✅ | ✅ | ❌ |
| Entity Extraction | ✅ | ✅ Pipeline | ❌ |
| Context Building | ✅ | ✅ Pipeline | ❌ |

---

## 3. GAP-ANALYSE (Soll vs. Ist)

### Gap 1: Intent → Action Execution

**Ist:** Intent Router erkennt Intents und gibt JSON zurück. Store reagiert, aber führt nicht konsequent aus.

**Soll:** `applyIntent(result)` mappt deterministisch Intent → UI/Actions

**Ursache:**
- `src/lib/store.ts:360-507` - `handleTranscriptReceived` hat komplexe Switch-Logik
- Keine dedizierte Execution-Layer zwischen Intent und UI

**Impact:** Hoch - User muss manuell nachhelfen

**Fix:**
- Neuer `IntentExecutor` in Store
- Mapping: `record` → Auto-Start Recording, `create_artifact` → Direct Enrich (Text als Transcript)

---

### Gap 2: Clarify State Machine instabil

**Ist:** `pendingTranscript` + `instruction` + `selectedMode` werden gesetzt, aber bei Follow-up wird oft nochmal Intent Router aufgerufen statt direkt kombiniert.

**Soll:** Wenn `pendingClarification` gesetzt ist, wird nächste User-Nachricht IMMER als Slot-Fill behandelt, ohne erneuten LLM-Call.

**Ursache:**
- `src/lib/store.ts:580-685` - `handleUserMessage` bei `awaiting_context` ruft `routeIntent` auf
- Keine State Machine mit explizitem `pendingClarification` State

**Impact:** Hoch - "Meeting morgen" → "Wann?" → "10 Uhr" funktioniert nicht zuverlässig

**Fix:**
- Neuer State `pendingClarification: { id, question, kind, resumePayload } | null`
- Bei gesetztem State: Skip Intent Router, direkt `resolveClarification()`

---

### Gap 3: Project Context UI fehlt

**Ist:**
- Backend komplett (DB, Service, IPC)
- Pipeline injiziert Project Context wenn Default-Project existiert
- Aber: Keine UI zum Erstellen/Verwalten von Projekten

**Soll:**
- Active Project Chip in UI
- Project Switcher (Cmd+P)
- "Create Project" Flow
- Artifacts werden automatisch zugeordnet

**Ursache:**
- Keine UI-Komponenten erstellt
- Store hat kein `activeProjectId`

**Impact:** Mittel - Feature existiert, aber unzugänglich

**Fix:**
- Store: `activeProjectId: string | null`
- UI: `ProjectChip.tsx`, `ProjectSwitcher.tsx`
- Auto-Assign bei Enrichment

---

### Gap 4: Contacts/Disambiguation fehlt komplett

**Ist:**
- `entities` Tabelle existiert
- Entity Extraction funktioniert
- Aber: Keine Contact-spezifische Logik, keine Disambiguation bei Mehrdeutigkeit

**Soll:**
- Contacts als spezielle Entities (type=person)
- Notizen zu Kontakten speichern
- Bei "Max" mit 2+ Treffern: Clarify "Welcher Max?"

**Ursache:**
- Nicht implementiert

**Impact:** Mittel - Feature-Gap für Personal Assistant

**Fix:**
- Contacts als Entity-Subset
- `contact_notes` Tabelle (oder `entities.metadata`)
- Disambiguation-Flow in Intent Execution

---

### Gap 5: Project Plan/Checklist fehlt

**Ist:**
- Artifacts werden gespeichert
- Action Items werden als Memory Chunks extrahiert
- Aber: Keine dedizierte Plan-Tabelle, kein Update-Flow

**Soll:**
- `project_plan_items` Tabelle
- LLM schlägt Plan-Updates vor
- UI zeigt Änderungsvorschau
- Apply/Undo möglich

**Ursache:**
- Nicht implementiert

**Impact:** Mittel - Core Feature für projektbasierten Assistant

**Fix:**
- Neue Tabelle `project_plan_items`
- Enrichment Response um `project_updates` erweitern
- UI für Apply/Undo

---

## 4. ARCHITEKTUR-VERIFIZIERUNG

### Renderer (Next.js) - ✅ Korrekt
- Kein `fs`, keine Secrets
- Recording via `getUserMedia`
- IPC für alle Backend-Calls

### Main (Electron) - ✅ Korrekt
- Alle Secrets in `process.env`
- OpenAI Calls nur hier
- Action Execution nur hier

### Supabase - ✅ Korrekt
- Project ID fest: `puiqcxfibmnoimdsdjpq`
- URL fest: `https://puiqcxfibmnoimdsdjpq.supabase.co`
- RLS aktiv auf allen Tabellen
- Runtime-Guard in `supabase.ts`

---

## 5. RISIKEN

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| Clarify-Loop (endlose Nachfragen) | Mittel | Hoch | Max 3 Clarify-Rounds, dann Fallback |
| Memory Chunks wachsen schnell | Niedrig | Mittel | Chunk-Limit pro Project, Cleanup-Job |
| Intent Router halluziniert Mode | Niedrig | Mittel | Zod-Validation bereits vorhanden |
| Offline-Nutzung fehlschlägt | Niedrig | Niedrig | Local History funktioniert |

---

## 6. EMPFEHLUNGEN

### Sofort umsetzen (M1-M2):
1. **Intent Executor** - Deterministische Ausführung
2. **Clarify State Machine** - Slot-Filling ohne LLM-Rerun
3. **Project UI MVP** - Chip + Switcher + Create

### Später (M3-M4):
4. **Contacts MVP** - Disambiguation
5. **Project Plan Updates** - Apply/Undo

### Post-MVP:
6. Security Warnings fixen (search_path)
7. Chunk-Cleanup-Job
8. Full RAG Memory with summarization

---

**END OF EVALUATION**
