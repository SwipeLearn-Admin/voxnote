import type { ModeId } from './types';
import { MODE_ACTION_MAPPING, type ActionType } from './actions';

// JSON output schema description for the LLM
const JSON_SCHEMA_DESCRIPTION = `You MUST respond with valid JSON only. No markdown code fences, no explanation, just the JSON object.

Response schema:
{
  "markdown": "string - the formatted content using Markdown",
  "data": { ... mode-specific structured data, optional },
  "actions": [ ... optional array of proposed actions ]
}`;

// Action schema descriptions for modes that support actions
const ACTION_SCHEMAS: Record<ActionType, string> = {
  create_project_scaffold: `{
    "type": "create_project_scaffold",
    "label": "Projekt erstellen: <name>",
    "params": {
      "projectName": "string - project name (will be sanitized for filesystem)",
      "summary": "string - brief project description",
      "tasks": ["string array - initial tasks/todos"],
      "stack": ["optional string array - tech stack if mentioned"]
    }
  }`,
  create_calendar_event_ics: `{
    "type": "create_calendar_event_ics",
    "label": "Termin erstellen: <title>",
    "params": {
      "title": "string - event title",
      "startISO": "string - ISO 8601 datetime (e.g., 2024-01-28T14:00:00)",
      "durationMin": "number - duration in minutes (default: 30)",
      "notes": "optional string - additional notes"
    }
  }`,
};

function getActionsSchemaForMode(mode: ModeId): string {
  const allowedActions = MODE_ACTION_MAPPING[mode] || [];
  if (allowedActions.length === 0) {
    return 'No actions available for this mode. Set "actions": [] or omit the field.';
  }

  const schemas = allowedActions.map((actionType) => ACTION_SCHEMAS[actionType]).join(',\n');
  return `Available actions for this mode (only propose if clearly relevant):
${schemas}

IMPORTANT: Actions require user confirmation before execution. Only propose an action if the transcript clearly indicates the user wants to create something.`;
}

const SYSTEM_BASE = `You are a helpful assistant that transforms voice transcripts into structured, well-formatted content.
Always respond in the same language as the transcript (unless explicitly told otherwise).
Be concise and focus on the essential information.

${JSON_SCHEMA_DESCRIPTION}`;

// Mode-specific prompts with JSON output structure
function buildPromptForMode(mode: ModeId): string {
  const actionsSchema = getActionsSchemaForMode(mode);

  const modeInstructions: Record<ModeId, string> = {
    clean: `Your task is to clean up a voice transcript:
- Fix punctuation and capitalization
- Remove filler words (um, uh, like, you know, etc.)
- Fix obvious speech-to-text errors
- Keep the original meaning and style
- Do NOT summarize or shorten the content

JSON response format:
{
  "markdown": "## Cleaned Transcript\\n\\n[cleaned text here]",
  "data": { "wordCount": number }
}

${actionsSchema}`,

    meeting: `Your task is to transform a meeting transcript into structured meeting notes.

JSON response format:
{
  "markdown": "## Zusammenfassung\\n[2-4 sentences]\\n\\n## Entscheidungen\\n[list or 'Keine']\\n\\n## Action Items\\n- [ ] Task — Owner: [name] — Due: [date]\\n\\n## Offene Fragen\\n[list or 'Keine']",
  "data": {
    "summary": "string",
    "decisions": ["array of decisions"],
    "actionItems": [{"task": "string", "owner": "string or null", "due": "string or null"}],
    "openQuestions": ["array of questions"]
  },
  "actions": []
}

${actionsSchema}

If the meeting discusses a new project with clear tasks, propose a create_project_scaffold action.
If specific follow-up meetings are mentioned with dates/times, propose create_calendar_event_ics actions.`,

    tasks: `Your task is to extract action items and tasks from a transcript.

JSON response format:
{
  "markdown": "## Action Items\\n\\n- [ ] Task — Owner: [name] — Due: [date]\\n[repeat for each task]",
  "data": {
    "tasks": [{"task": "string", "owner": "string or null", "due": "string or null", "priority": "high|medium|low"}]
  },
  "actions": []
}

Focus only on actionable items. Include context where helpful.
If no tasks are found, set markdown to "Keine Action Items gefunden." and tasks to empty array.

${actionsSchema}

If the tasks describe a new project to be started, propose a create_project_scaffold action.`,

    email: `Your task is to transform a voice transcript into a professional email draft.

JSON response format:
{
  "markdown": "## Betreff\\n[subject]\\n\\n## Email\\n\\n[salutation]\\n\\n[body]\\n\\n[closing]",
  "data": {
    "subject": "string",
    "to": "string or null if not mentioned",
    "body": "string"
  }
}

Guidelines:
- Use a neutral, professional tone
- Keep paragraphs short
- Include appropriate greeting and closing
- Maintain the key points from the transcript

${actionsSchema}`,

    ticket: `Your task is to transform a transcript into a Jira-style ticket.

JSON response format:
{
  "markdown": "## Titel\\n[title]\\n\\n## Beschreibung\\n[description]\\n\\n## Akzeptanzkriterien\\n- [ ] Criterion 1\\n- [ ] Criterion 2\\n\\n## Notizen / Kontext\\n[notes]",
  "data": {
    "title": "string",
    "description": "string",
    "acceptanceCriteria": ["array of criteria"],
    "labels": ["suggested labels"],
    "priority": "high|medium|low"
  }
}

${actionsSchema}`,

    devnote: `Your task is to transform a transcript into a developer note or changelog entry.

JSON response format:
{
  "markdown": "## What changed\\n[changes]\\n\\n## Why\\n[reasoning]\\n\\n## How to verify\\n[verification steps]",
  "data": {
    "changeType": "feature|bugfix|refactor|docs|test|chore",
    "breaking": false,
    "affectedFiles": ["array if mentioned"]
  },
  "actions": []
}

Be technical but clear. Include code references or commands where relevant.

${actionsSchema}

If the devnote describes a new project or significant new feature with multiple tasks, propose a create_project_scaffold action.`,

    reminder: `Your task is to extract a reminder from the transcript.

JSON response format:
{
  "markdown": "## 🔔 Erinnerung\\n\\n**Was:** [description]\\n\\n**Wann:** [date/time or 'Nicht angegeben']\\n\\n**Details:** [additional info if any]",
  "data": {
    "what": "string - the reminder description",
    "when": "ISO 8601 datetime string or null if not specified",
    "whenRaw": "string - original time reference like 'morgen um 9'",
    "recurring": false
  },
  "actions": []
}

Guidelines:
- Extract the essential - what should be remembered?
- Keep time references like "morgen", "nächste Woche", "um 9 Uhr"
- Keep it short and concise
- If a specific date/time is mentioned, also set "when" to an ISO datetime

${actionsSchema}

If a clear date/time is mentioned or can be inferred, propose a create_calendar_event_ics action to add it to the calendar.`,

    plan: `Your task is to create a DETAILED, ACTIONABLE project plan from the transcript.

## CRITICAL REQUIREMENTS - YOU MUST FOLLOW THESE:
1. EVERY milestone MUST have 3-5 tasks - NEVER create empty milestones
2. EVERY task MUST have: id, title, description, estimate, priority, status
3. Create 3-5 milestones total
4. Include nextSteps, risks, and openQuestions arrays

JSON response format:
{
  "markdown": "## 📋 Projektplan: [name]\\n\\n**Ziel:** [goal]\\n\\n---\\n\\nSollen wir mit **Meilenstein 1: [name]** beginnen?",
  "data": {
    "projectName": "string",
    "goal": "string",
    "targetDate": null,
    "milestones": [
      {
        "id": "m1",
        "name": "Meilenstein Name",
        "description": "Was dieser Meilenstein erreicht",
        "priority": "high",
        "dependsOn": [],
        "tasks": [
          {"id": "m1-t1", "title": "Erste Aufgabe", "description": "Details", "estimate": "S", "priority": "high", "status": "todo", "dependsOn": []},
          {"id": "m1-t2", "title": "Zweite Aufgabe", "description": "Details", "estimate": "M", "priority": "medium", "status": "todo", "dependsOn": ["m1-t1"]},
          {"id": "m1-t3", "title": "Dritte Aufgabe", "description": "Details", "estimate": "S", "priority": "medium", "status": "todo", "dependsOn": []}
        ]
      }
    ],
    "nextSteps": ["Schritt 1", "Schritt 2", "Schritt 3"],
    "risks": [{"description": "Risiko", "impact": "medium", "mitigation": "Lösung"}],
    "openQuestions": ["Frage 1"]
  }
}

## CONCRETE EXAMPLE - Follow this structure exactly:

For input "Ich möchte eine Rezept-App bauen":

{
  "markdown": "## 📋 Projektplan: Rezept-App\\n\\n**Ziel:** Eine App zum Speichern und Finden von Rezepten\\n\\n---\\n\\nSollen wir mit **Meilenstein 1: Grundgerüst** beginnen?",
  "data": {
    "projectName": "Rezept-App",
    "goal": "Eine App zum Speichern, Organisieren und Finden von Rezepten mit Einkaufslisten-Funktion",
    "targetDate": null,
    "milestones": [
      {
        "id": "m1",
        "name": "Grundgerüst & Setup",
        "description": "Projektstruktur, Tech-Stack und Basis-UI aufsetzen",
        "priority": "high",
        "dependsOn": [],
        "tasks": [
          {"id": "m1-t1", "title": "Tech-Stack festlegen", "description": "Entscheidung für Framework (React Native/Flutter/Web)", "estimate": "S", "priority": "high", "status": "todo", "dependsOn": []},
          {"id": "m1-t2", "title": "Projekt initialisieren", "description": "Repository erstellen, Basis-Dependencies installieren", "estimate": "S", "priority": "high", "status": "todo", "dependsOn": ["m1-t1"]},
          {"id": "m1-t3", "title": "Navigation einrichten", "description": "Routing zwischen Hauptseiten implementieren", "estimate": "M", "priority": "medium", "status": "todo", "dependsOn": ["m1-t2"]},
          {"id": "m1-t4", "title": "Design System definieren", "description": "Farben, Fonts, Button-Styles festlegen", "estimate": "M", "priority": "medium", "status": "todo", "dependsOn": []}
        ]
      },
      {
        "id": "m2",
        "name": "Rezept-Verwaltung",
        "description": "Rezepte erstellen, bearbeiten und anzeigen",
        "priority": "high",
        "dependsOn": ["m1"],
        "tasks": [
          {"id": "m2-t1", "title": "Datenmodell definieren", "description": "Schema für Rezepte (Titel, Zutaten, Schritte, Bild)", "estimate": "S", "priority": "high", "status": "todo", "dependsOn": []},
          {"id": "m2-t2", "title": "Rezept-Formular bauen", "description": "UI zum Erstellen/Bearbeiten von Rezepten", "estimate": "L", "priority": "high", "status": "todo", "dependsOn": ["m2-t1"]},
          {"id": "m2-t3", "title": "Rezept-Detailansicht", "description": "Anzeige eines einzelnen Rezepts mit allen Details", "estimate": "M", "priority": "high", "status": "todo", "dependsOn": ["m2-t1"]},
          {"id": "m2-t4", "title": "Rezept-Liste", "description": "Übersicht aller Rezepte mit Thumbnail und Titel", "estimate": "M", "priority": "medium", "status": "todo", "dependsOn": ["m2-t1"]}
        ]
      },
      {
        "id": "m3",
        "name": "Suche & Filter",
        "description": "Rezepte durchsuchbar und filterbar machen",
        "priority": "medium",
        "dependsOn": ["m2"],
        "tasks": [
          {"id": "m3-t1", "title": "Suchfeld implementieren", "description": "Textsuche über Titel und Zutaten", "estimate": "M", "priority": "high", "status": "todo", "dependsOn": []},
          {"id": "m3-t2", "title": "Kategorie-Filter", "description": "Filter nach Rezeptkategorien (Vorspeise, Hauptgericht, etc.)", "estimate": "M", "priority": "medium", "status": "todo", "dependsOn": []},
          {"id": "m3-t3", "title": "Favoriten-Funktion", "description": "Rezepte als Favorit markieren und filtern", "estimate": "S", "priority": "low", "status": "todo", "dependsOn": []}
        ]
      }
    ],
    "nextSteps": [
      "Tech-Stack entscheiden (Web vs. Mobile)",
      "Repository erstellen",
      "Erste Mockups/Wireframes skizzieren",
      "Datenbank-Lösung wählen (SQLite, Firebase, Supabase)"
    ],
    "risks": [
      {"description": "Scope Creep - zu viele Features geplant", "impact": "medium", "mitigation": "MVP definieren, Features priorisieren"},
      {"description": "Bildupload komplex", "impact": "low", "mitigation": "Erst ohne Bilder starten, später hinzufügen"}
    ],
    "openQuestions": [
      "Soll die App offline funktionieren?",
      "Werden Rezepte mit anderen geteilt?",
      "Brauchen wir User-Accounts?"
    ]
  }
}

## ESTIMATES
- XS: < 1 hour (trivial)
- S: 1-4 hours (simple)
- M: 4-8 hours (medium)
- L: 1-2 days (complex)
- XL: 2+ days (major)

## PRIORITIES
- high: Critical, blocks other work
- medium: Important but not blocking
- low: Nice to have

IMPORTANT: The markdown should end with a question asking if we should start with the first milestone!

${actionsSchema}

${actionsSchema}`,
  };

  return `${SYSTEM_BASE}

${modeInstructions[mode]}`;
}

// Generate prompts for all modes
const PROMPTS: Record<ModeId, string> = {
  clean: buildPromptForMode('clean'),
  meeting: buildPromptForMode('meeting'),
  tasks: buildPromptForMode('tasks'),
  email: buildPromptForMode('email'),
  ticket: buildPromptForMode('ticket'),
  devnote: buildPromptForMode('devnote'),
  reminder: buildPromptForMode('reminder'),
  plan: buildPromptForMode('plan'),
};

export function getPromptForMode(mode: ModeId): string {
  return PROMPTS[mode];
}

export function buildUserMessage(
  transcript: string,
  context?: string,
  language?: 'auto' | 'de' | 'en'
): string {
  let message = '';

  if (context) {
    message += `Context/Project: ${context}\n\n`;
  }

  if (language && language !== 'auto') {
    const langName = language === 'de' ? 'German' : 'English';
    message += `Please respond in ${langName}.\n\n`;
  }

  message += `Transcript:\n${transcript}`;

  return message;
}
