# EXECUTION_PLAN.md — VoxNote (48h Sprint → Full Product)

**Project:** VoxNote (Desktop Personal Assistant)
**Renderer:** Next.js (required)
**Desktop Runtime:** Electron
**Supabase Project (MUST NEVER CHANGE):** `puiqcxfibmnoimdsdjpq`
**Supabase URL (fixed):** `https://puiqcxfibmnoimdsdjpq.supabase.co`

> **Purpose of this document:**
> Single source of truth for: scope, milestones, timeline, exact tasks, acceptance criteria, and "don't break" rules.
> A code-assistant AI should be able to execute tasks with minimal reasoning.

---

## 1) Challenge Requirements (MUST ALWAYS HOLD)

### Goal
Develop a desktop application that records voice input, transcribes it, and enriches it through AI-supported processing. The result must be directly usable (structured note, formatted text, context-prepared output).

### Stack Constraints
- **Next.js must be the basis** ✅
- Desktop runtime: Electron or Tauri ✅ (Electron is used)
- Voice-to-text: any (local or API)
- LLM integration: any
- Any libraries/services allowed as long as Next.js is the basis.

### Guidelines / Must-Haves
- Standalone desktop app ✅
- Voice pipeline: Recording → Transcription → Enrichment ✅
- Hotkey activation ✅
- Usable end-to-end ✅
- README with: problem, architecture, setup, design decisions ✅

---

## 2) Product Direction (Scope) — Personal Assistant for Single Users

### Primary User
Single user (entrepreneur/developer) who wants:
- structured notes,
- tasks and tickets,
- emails,
- reminders,
- and **lightweight execution** of suggested actions (project scaffolds, calendar events).

### Must Deliver in 48h (Core Value)
1. Voice pipeline works reliably: hotkey → record → transcribe → enrich → output
2. Output is usable: Markdown + structured JSON (validated)
3. **At least 2 "Proposed Actions" that actually execute** (with user confirmation):
   - `create_project_scaffold`
   - `create_calendar_event_ics`
4. UI: assistant-like window (nearly square) + background feedback (fallback guaranteed)

### Explicit Non-Goals (48h Scope Protection)
- ❌ Notion integration (unnecessary; app already stores/displays artifacts)
- ❌ Phone calls (too large + legal/UX risk)
- ❌ Full RAG/embeddings memory (post-48h)
- ❌ Enterprise/team features (post-48h)

---

## 3) Architecture (IMPORTANT — Read First)

### Process Responsibilities

| Process | Responsibilities |
|---------|------------------|
| **Renderer (Next.js)** | UI, state, user input, `getUserMedia()` + `MediaRecorder`, displays transcript/result/actions, mic metering (optional) |
| **Main (Electron)** | IPC handlers, OpenAI calls, filesystem operations, temp files, action execution, secrets |
| **Supabase** (optional) | Auth + sync of artifacts |

### Recording Architecture (CONFIRMED)
- **Recording happens in Renderer** via `navigator.mediaDevices.getUserMedia()` + `MediaRecorder`
- Audio is sent as `ArrayBuffer` via IPC to Main
- Main writes temp file → calls Whisper API → returns transcript

### Data Flow
```
1. Hotkey opens assistant window
2. Push-to-talk (Space) records audio in Renderer
3. Audio ArrayBuffer → IPC → Main
4. Main: temp file → Whisper API → transcript
5. Main: transcript → LLM enrichment → { markdown, json, actions[] }
6. Renderer displays result + proposed actions
7. User confirms an action
8. Main executes action (filesystem / ICS / shell.open)
```

### Key Source Files (for Code Assistant)
| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Recording (getUserMedia + MediaRecorder + Space Push-to-talk) |
| `electron/preload.ts` | IPC bridge (window.api) |
| `electron/main.ts` | IPC handlers + app lifecycle |
| `electron/services/pipeline.ts` | Pipeline orchestration, temp files |
| `electron/services/openai.ts` | OpenAI integration (Whisper + Chat) |
| `electron/services/window.ts` | Window layouts, overlay management |
| `electron/services/settings.ts` | Settings + model config |

### Principles ("Don't Break")
- Renderer remains unprivileged: no `fs`, no secrets
- All side effects occur in Main
- LLM output must be validated; failure must degrade gracefully

---

## 4) Supabase Reality & Guardrails

### Fixed Project ID (NEVER CHANGE)
- Project ref: `puiqcxfibmnoimdsdjpq`
- URL: `https://puiqcxfibmnoimdsdjpq.supabase.co`

**Rule:** Never create or switch to another Supabase project.
**Rule:** Never rewrite SUPABASE_URL to a different domain.

### Current DB Schema (FACTUAL)
This Supabase project already has:
- `public.profiles` (1:1 auth.users)
- `public.artifacts` (user artifacts)
- `public.tags` + `public.artifact_tags`
- `public.subscriptions`
- `public.usage_logs`

**Sprint rule:** Do NOT delete these tables. They are "ahead of schedule."
Use them only if explicitly required by a sprint milestone.

### DB Scalability Rules
- Keep RLS enabled on all user tables.
- Add indexes only if they solve a real query path in sprint.
- Use JSONB (`result_json`) to avoid schema churn.
- Avoid cross-user queries; always filter by `auth.uid()` or `user_id`.

---

## 5) Security + API Key Policy (Critical)

### Requirement: Global LLM API Key
Users must NOT enter their own OpenAI API key. Billing goes through one account.

### 48h Approach (OK for challenge, not production-secure)
- Store OpenAI key in `.env.local` (developer machine / build environment)
- Main process reads `process.env.OPENAI_API_KEY`
- Renderer has **no access** to keys
- Remove key input UI (or hide it)

### Environment Loading (CORRECT Implementation)

```typescript
// electron/main.ts (at the very top)
import dotenv from "dotenv";
import path from "path";
import { app } from "electron";

const isDev = !app.isPackaged;

if (isDev) {
  // Development: load from project root
  dotenv.config({ path: path.join(process.cwd(), ".env.local") });
} else {
  // Production: rely on process.env (injected at build/runtime)
  // Optional: allow userData env file for local installs
  // dotenv.config({ path: path.join(app.getPath("userData"), ".env.local") });
}
```

> **Production note (post-48h):**
> Desktop binaries are untrusted. Global API keys can be extracted.
> For a real product, move OpenAI calls to server-side proxy (Supabase Edge Functions).

---

## 6) Required Dependencies

### Already Present
- `zod` ✅

### Add for Sprint
```json
{
  "dotenv": "^16.x",
  "ics": "^3.x"
}
```

### Only for M4b (Neural Background Stretch Goal)
```json
{
  "ogl": "^1.x"
}
```

---

## 7) 48h Definition of Done (End Goal)

A build is considered "complete for challenge" if:

1. ✅ Hotkey reliably toggles the assistant window
2. ✅ Space push-to-talk works (recording starts/stops reliably)
3. ✅ Transcription works reliably
4. ✅ Enrichment returns usable output (Markdown + structured JSON)
5. ✅ At least two actions execute with confirm:
   - Create project folder scaffold (writes files, opens folder)
   - Create calendar event ICS (writes .ics, opens it)
6. ✅ UI is assistant-like (nearly square) and provides feedback:
   - background reacts to mouse + recording/thinking (fallback is acceptable)
7. ✅ Local history works
8. ✅ README includes setup + architecture + demo steps + design decisions

---

## 8) Timeline & Milestones

| Time | Milestone | Goal | Priority |
|------|-----------|------|----------|
| H0–H2 | M0 Setup & Guardrails | repo stable, env works, Supabase fixed | 🔴 Critical |
| H2–H5 | M1 Global Key + Error UX | no per-user keys, clear error states | 🔴 Critical |
| H5–H7 | M2a Window Minimal Fix | assistant window usable (size/layout) | 🔴 Critical |
| H7–H19 | M3 Action System MVP | validated JSON + 2 executing actions | 🔴 Critical |
| H19–H23 | M4a Background Fallback | always-works animated background + energy | 🟡 Important |
| H23–H30 | M4b Neural Background | WebGL shader + mouse + voice feedback | 🟢 Stretch |
| H30–H34 | M5 Supabase Sync | optional login + sync artifacts | 🟢 Stretch |
| H34–H42 | M6 Build + QA | dist builds, smoke tests, crash-free | 🔴 Critical |
| H42–H48 | M7 README + Demo | submission-ready docs + demo script | 🔴 Critical |

**Priority Rule:** QA > Supabase Sync. If time is short, skip M5.

---

## 9) Milestone Details

### M0 — Setup & Guardrails (H0–H2)

#### M0.1 Baseline Run
- [ ] `npm install`
- [ ] `npm run dev`
- [ ] Verify: window opens, hotkey works, recording works, transcription + enrichment returns text

**DoD:** baseline works before any refactors.

#### M0.2 Add this plan to repo
- [ ] Save this file as `EXECUTION_PLAN.md` at repo root
- [ ] Add link from README

**DoD:** plan is discoverable.

#### M0.3 Environment loading in Main process
- [ ] Add `dotenv` dependency (if missing)
- [ ] In `electron/main.ts` at the very top, add:

```typescript
import dotenv from "dotenv";
import path from "path";
import { app } from "electron";

const isDev = !app.isPackaged;

if (isDev) {
  dotenv.config({ path: path.join(process.cwd(), ".env.local") });
}
// Production: rely on process.env injected at build time
```

**DoD:** `process.env.OPENAI_API_KEY` is available in Main (dev and prod).

#### M0.4 Supabase guard
- [ ] Locate Supabase init (search: `createClient(`)
- [ ] Ensure URL contains `puiqcxfibmnoimdsdjpq`
- [ ] Add runtime assertion in dev

**DoD:** cannot silently switch projects.

---

### M1 — Global OpenAI Key + Error UX (H2–H5)

#### M1.1 Remove per-user OpenAI key input
- [ ] Find Settings UI containing OpenAI key field
- [ ] Remove the input field entirely OR hide behind dev flag
- [ ] Ensure no "API key required" banner shows for normal users

**DoD:** user never needs to enter a key.

#### M1.2 Enforce Main-only key usage
- [ ] Find key access function (search: `getApiKey`)
- [ ] Ensure it returns `process.env.OPENAI_API_KEY` (highest priority)
- [ ] DO NOT store key in renderer
- [ ] If existing `settings.openaiApiKey` exists, ignore it

**DoD:** the only operational key source is env.

#### M1.3 Error states (MUST implement)

| Error | UI Behavior |
|-------|-------------|
| Network error / timeout | Show error card + "Retry" button |
| 401 Unauthorized | Show "System configuration missing: OPENAI_API_KEY" |
| 429 Rate Limited | Show "Rate limited: please wait and retry" |
| Any error | Always allow user to copy transcript if it exists |

**DoD:** no silent failures; no dead ends.

---

### M2a — Window Minimal Fix (H5–H7)

#### M2a.1 Set default window size
- [ ] Find window config (search: `setSize(`, `WindowLayouts`, `windowState`)
- [ ] Default to approx: width 600, height 520
- [ ] Keep "compact" mode optional

**DoD:** default window is usable without toggles.

#### M2a.2 Ensure always-on-top + quick show/hide works
- [ ] Verify hotkey toggles show/hide without losing state
- [ ] If window closes, it should reopen quickly

**DoD:** assistant feels like a tool, not a big app.

---

### M3 — Action System MVP (H7–H19) — CRITICAL PATH

#### M3.0 JSON Output Requirements

LLM must produce a single JSON object:
```json
{
  "markdown": "string (human-friendly output)",
  "data": { "mode": "tasks|meeting|...", "...": "..." },
  "actions": [
    { "type": "create_project_scaffold", "label": "...", "params": { ... } }
  ]
}
```

**Model Configuration:**
- Use versioned model with Structured Outputs support
- Recommended: `OPENAI_CHAT_MODEL=gpt-4o-mini-2024-07-18`
- Enable `response_format: { type: "json_object" }` in `electron/services/openai.ts`

#### M3.1 Define action types + Zod validation

Create/update `electron/shared/actions.ts`:

```typescript
import { z } from "zod";

// Action 1: Create Project Scaffold
const CreateProjectScaffoldSchema = z.object({
  type: z.literal("create_project_scaffold"),
  label: z.string(),
  params: z.object({
    projectName: z.string(),
    summary: z.string(),
    tasks: z.array(z.string()),
    stack: z.array(z.string()).optional(),
  }),
});

// Action 2: Create Calendar Event ICS
const CreateCalendarEventIcsSchema = z.object({
  type: z.literal("create_calendar_event_ics"),
  label: z.string(),
  params: z.object({
    title: z.string(),
    startISO: z.string(),
    durationMin: z.number().optional().default(30),
    notes: z.string().optional(),
  }),
});

// Union
export const ProposedActionSchema = z.discriminatedUnion("type", [
  CreateProjectScaffoldSchema,
  CreateCalendarEventIcsSchema,
]);

export type ProposedAction = z.infer<typeof ProposedActionSchema>;

// Parser function
export function parseProposedActions(actions: unknown[]): ProposedAction[] {
  const valid: ProposedAction[] = [];
  for (const action of actions) {
    const result = ProposedActionSchema.safeParse(action);
    if (result.success) {
      valid.push(result.data);
    }
  }
  return valid;
}
```

**DoD:** `parseProposedActions()` returns validated actions or empty array.

#### M3.2 Mode → Action Mapping (Prompt Guardrails)

| Mode | Allowed Actions |
|------|-----------------|
| `meeting` | `create_project_scaffold` (optional), `create_calendar_event_ics` (follow-up) |
| `tasks` | `create_project_scaffold` |
| `devnote` | `create_project_scaffold` (optional) |
| `reminder` | `create_calendar_event_ics` |
| `email` | None (output is the draft) |
| `ticket` | None (output is the ticket) |
| `clean` | None |

**Implementation:** In each mode's system prompt, explicitly state allowed actions.

**Time field consolidation:**
- `reminder.data.reminders[].whenISO` → maps to `create_calendar_event_ics.params.startISO`

#### M3.3 Parse strategy (MUST be robust)

```typescript
function parseEnrichmentOutput(raw: string): EnrichmentResult {
  // 1. Try direct parse
  try {
    const parsed = JSON.parse(raw);
    return validateEnrichmentResult(parsed);
  } catch (e) {
    // 2. Try to extract JSON substring
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return validateEnrichmentResult(parsed);
      } catch {}
    }

    // 3. Graceful degradation
    return {
      markdown: raw,
      data: { mode: "unknown", error: "unparsed" },
      actions: [],
    };
  }
}
```

**DoD:** No crash on bad JSON. Actions simply disappear.

#### M3.4 Utility: sanitizeProjectName

```typescript
export function sanitizeProjectName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]/g, "-")  // only safe chars
    .replace(/-+/g, "-")           // collapse dashes
    .replace(/^-|-$/g, "")         // no leading/trailing dash
    .slice(0, 50)                  // length cap
    || "project";                  // fallback
}
```

#### M3.5 IPC contract: execute action

Add to preload API:
```typescript
executeProposedAction(action: ProposedAction): Promise<{
  success: boolean;
  message?: string;
  outputPath?: string;
}>
```

**DoD:** renderer remains unprivileged; main executes all side effects.

#### M3.6 Implement Action 1: create_project_scaffold

Main executes:
1. Ask user for base folder (directory picker)
2. Create folder: `<base>/<projectName-sanitized>/`
3. Write files:
   - `README.md` (summary)
   - `PLAN.md` (milestones)
   - `TASKS.md` (checkbox list)
   - `ARCHITECTURE.md` (short outline)
4. Open folder in OS (`shell.openPath`)

Edge cases:
- sanitize projectName using `sanitizeProjectName()`
- if exists: append suffix `-2`, `-3`, etc.
- handle permission errors and return failure message

**DoD:** one click creates real output; perfect for demo.

#### M3.7 Implement Action 2: create_calendar_event_ics

Main executes:
```typescript
import { app, shell } from "electron";
import fs from "fs/promises";
import path from "path";

async function createCalendarEventIcs(params: {
  title: string;
  startISO: string;
  durationMin?: number;
  notes?: string;
}): Promise<{ success: boolean; outputPath?: string; message?: string }> {
  try {
    // Ensure events directory exists
    const eventsDir = path.join(app.getPath("userData"), "events");
    await fs.mkdir(eventsDir, { recursive: true });

    // Generate ICS content
    const icsContent = generateIcsContent(params);

    // Write file
    const filePath = path.join(eventsDir, `${Date.now()}.ics`);
    await fs.writeFile(filePath, icsContent, "utf8");

    // Open with default calendar app
    await shell.openPath(filePath);

    return { success: true, outputPath: filePath };
  } catch (error) {
    return { success: false, message: String(error) };
  }
}
```

**DoD:** a real calendar event can be imported in one click.

#### M3.8 UI: render actions with confirmation

- Under result output, show "Suggested Actions" section
- Each action is a card with: label, short params preview, "Run" button
- Clicking "Run" opens confirm modal: "This will create files on your disk… Continue?"
- Only then call IPC

**DoD:** actions are never executed without explicit user consent.

---

### M4a — Background Fallback (Guaranteed) (H19–H23)

#### Requirements
- Works even without WebGL
- Reacts to mouse movement
- Reacts to recording/thinking with an "energy" value (0..1)

#### Implementation: BackgroundFallback.tsx

```typescript
// src/components/BackgroundFallback.tsx
import { useEffect, useRef } from "react";

interface Props {
  energy: number; // 0..1
  mouseX: number; // 0..1 normalized
  mouseY: number; // 0..1 normalized
}

export function BackgroundFallback({ energy, mouseX, mouseY }: Props) {
  // CSS animated gradient that responds to energy + mouse
  const intensity = 0.3 + energy * 0.7;
  const hue = 220 + mouseX * 40;

  return (
    <div
      className="fixed inset-0 -z-10 pointer-events-none transition-all duration-300"
      style={{
        background: `radial-gradient(
          ellipse at ${mouseX * 100}% ${mouseY * 100}%,
          hsla(${hue}, 70%, ${30 + energy * 20}%, ${intensity}),
          hsla(${hue + 30}, 50%, 10%, 0.9)
        )`,
      }}
    />
  );
}
```

#### useEnergy Hook (Mic Metering)

```typescript
// src/hooks/useEnergy.ts
import { useEffect, useRef, useState } from "react";

export function useEnergy(stream: MediaStream | null, isRecording: boolean) {
  const [energy, setEnergy] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const prevEnergyRef = useRef(0);

  useEffect(() => {
    if (!stream || !isRecording) {
      setEnergy(0);
      return;
    }

    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;

    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    audioCtxRef.current = audioCtx;
    analyserRef.current = analyser;

    const data = new Uint8Array(analyser.fftSize);

    const tick = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteTimeDomainData(data);

      // RMS calculation
      let sum = 0;
      for (const v of data) {
        const x = (v - 128) / 128;
        sum += x * x;
      }
      const rms = Math.sqrt(sum / data.length);
      const rawEnergy = Math.min(Math.max(rms * 2.0, 0), 1);

      // Smoothing (EMA)
      const smoothed = rawEnergy * 0.2 + prevEnergyRef.current * 0.8;
      prevEnergyRef.current = smoothed;
      setEnergy(smoothed);

      rafRef.current = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioCtx.close();
    };
  }, [stream, isRecording]);

  return energy;
}
```

**DoD:** background always looks alive and gives feedback.

---

### M4b — Neural Background (Stretch) (H23–H30)

**Timebox rule:** Stop if not stable after 4h; fallback remains.

#### Requirements
- Must not block UI interaction (`pointer-events: none`)
- Must cap DPR for performance (max 1.5)
- Must pause when window hidden
- Must have fallback on init failure

**DoD:** background is interactive + stable.
**If not achieved:** revert to fallback only and proceed to QA.

---

### M5 — Supabase Sync (Stretch) (H30–H34)

**Sprint rule:** Optional. Do NOT jeopardize core demo. QA > Sync.

#### Minimal DoD if implemented
- Login/logout works
- Sync artifacts (push/pull)
- Store `result_json` (including actions)

#### Conflict strategy (simple)
- Local-first: newest `updated_at` wins
- Never delete remotely during sprint

**DoD:** cloud is a bonus; local remains authoritative.

---

### M6 — Build + QA (H34–H42)

#### M6.1 Build
- [ ] `npm run lint`
- [ ] `npm run dist`

**DoD:** distributable app is produced.

#### M6.2 Smoke Tests (Mandatory)

| Test | Expected |
|------|----------|
| Launch app | Window opens |
| Hotkey show/hide | Toggles correctly |
| Hold Space → record → release | Audio captured |
| Transcribe | Returns text |
| Enrich | Returns markdown + JSON |
| Action: project scaffold | Creates folder/files, opens in Finder |
| Action: ICS | Opens calendar import |
| Disconnect network | Error + retry shown |
| Force parse fail | Still shows markdown, no crash |

**DoD:** crash-free demo.

---

### M7 — README + Demo Script (H42–H48)

#### README must include
- Problem statement
- Architecture overview (renderer/main/supabase)
- Setup instructions:
  - `.env.local` with `OPENAI_API_KEY`
  - `npm run dev` + `npm run dist`
- Design decisions:
  - local-first
  - actions with confirm-first
  - global key (48h) + server proxy roadmap

#### DEMO_SCRIPT.md
60–120 second script:
1. Hotkey opens assistant
2. Speak a request
3. Show structured output
4. Click action → folder appears
5. Click calendar action → event import opens

**DoD:** reviewer can reproduce success quickly.

---

## 10) Error States & Recovery (MUST IMPLEMENT)

| Error Type | UI Behavior |
|------------|-------------|
| Network / timeout | Error card + "Retry" + copy transcript if exists |
| 401 Unauthorized | "System configuration missing: OPENAI_API_KEY" (no user input) |
| 429 Rate Limited | "Please wait and retry" + one-click retry |
| JSON Parse Failure | Degrade to markdown-only, log error, optional repair retry |
| Action Execution Failure | Toast/card with error reason, stay in result view |

**Rule:** Never crash. Never block output.

---

## 11) Offline-First Definition

- Local history works offline ✅
- Transcription/enrichment requires internet (unless local models added post-48h)
- Supabase sync is optional and gracefully degrades when offline

---

## 12) Data Contracts (Exact Specs)

### EnrichmentResult (Top-level JSON)

```typescript
type EnrichmentResult = {
  markdown: string;
  data: {
    mode: "meeting" | "tasks" | "email" | "ticket" | "devnote" | "clean" | "reminder";
    title?: string;
    language?: string;
    [k: string]: unknown; // mode-specific fields
  };
  actions?: ProposedAction[];
};
```

### Mode-specific data fields

| Mode | Required Fields |
|------|-----------------|
| `tasks` | `tasks: { title, due?, priority?, notes? }[]` |
| `meeting` | `summary`, `decisions[]`, `action_items[]`, `open_questions[]` |
| `email` | `subject`, `to?[]`, `body` |
| `ticket` | `title`, `steps_to_reproduce[]`, `expected`, `actual`, `acceptance_criteria[]` |
| `devnote` | `changes[]`, `why`, `how_to_verify[]` |
| `clean` | `clean_transcript` |
| `reminder` | `reminders: { title, whenISO?, notes? }[]` |

### ProposedAction (Strict)

```typescript
/**
 * IMPORTANT: Actions must NEVER be executed without explicit user confirmation.
 * The UI must show a confirmation dialog before calling executeProposedAction().
 */
type ProposedAction =
  | {
      type: "create_project_scaffold";
      label: string;
      params: {
        projectName: string;
        summary: string;
        tasks: string[];
        stack?: string[];
      };
    }
  | {
      type: "create_calendar_event_ics";
      label: string;
      params: {
        title: string;
        startISO: string;
        durationMin?: number;
        notes?: string;
      };
    };
```

---

## 13) Git Workflow

- Work on branch: `feature/48h-sprint`
- Commit naming: `M0: ...`, `M1: ...`, `M3: ...`
- Do not mix milestones in one commit when avoidable

---

## 14) Post-48h Roadmap (Full Product)

### R0.5 — Server-side OpenAI Proxy (Security)
- Supabase Edge Functions: `/transcribe`, `/enrich`
- Store OpenAI key as Supabase secret
- Add rate limiting + usage logs (`usage_logs` table already exists)

### R1 — Usage & Subscription enforcement
- Use `usage_logs` + `subscriptions` to gate advanced features
- Continue local-first: offline remains usable

### R2 — Search & Organization
- Use `tags` + `artifact_tags` (already exists)
- Add full text search (`tsvector` + GIN) on artifacts

### R3 — Assistant Memory (lightweight)
- Retrieval from user's own artifacts
- Optional embeddings later

### R4 — Plugin Actions
- Safe tool registry
- Permissioned actions with confirm-first

---

## 15) Progress Checklist

- [x] M0: Setup & Guardrails ✅
- [x] M1: Global Key + Error UX ✅
- [x] M2a: Window Minimal Fix ✅
- [x] M3: Action System MVP ✅
- [x] M4a: Background Fallback ✅
- [ ] M4b: Neural Background (Stretch) ⏭️ Skipped
- [x] M5: Supabase Sync ✅
- [x] M6: Build + QA ✅
- [x] M7: README + Demo ✅

### Bonus Features (Beyond Plan)
- [x] Context-Aware Bot with Greetings
- [x] Clarify Intent for Missing Information
- [x] Multi-Turn Conversation Memory
- [x] Auto-Mode Detection
- [x] Full Chat Layout Redesign

---

## 16) Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-28 | Recording in Renderer, not Main | Browser APIs (getUserMedia) only available in Renderer |
| 2026-01-28 | Global API key via env, not user input | Challenge requirement: no per-user keys |
| 2026-01-28 | Context-aware bot with clarify intent | Better UX: bot asks questions instead of guessing, multi-turn memory for natural conversations |
| 2026-01-28 | Auto-mode detection before showing selector | Reduces friction: if bot knows what user wants, execute immediately |
| 2026-01-28 | Skip M4b (Neural Background) | Fallback CSS background works well, WebGL adds complexity without core value |
| 2026-01-28 | Implement M5 (Supabase Sync) | Backend already existed, only needed UI integration (AuthButton) |
| 2026-01-28 | QA priority over Supabase Sync | End-to-end functionality > cloud features |
| 2026-01-28 | Fallback background guaranteed | WebGL is stretch; CSS fallback always works |

---

**END OF PLAN**
