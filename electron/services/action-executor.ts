import { app, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import {
  type ProposedAction,
  type ActionExecutionResult,
  type CreateProjectScaffoldAction,
  type CreateCalendarEventIcsAction,
  sanitizeProjectName,
  validateAction,
} from '../shared/actions';

// ============================================
// ACTION EXECUTOR - Entry Point
// ============================================

/**
 * Execute a proposed action.
 * IMPORTANT: This should ONLY be called after explicit user confirmation.
 */
export async function executeProposedAction(action: unknown): Promise<ActionExecutionResult> {
  // Validate action before execution
  const validated = validateAction(action);
  if (!validated) {
    return {
      success: false,
      message: 'Ungültige Aktion - Validierung fehlgeschlagen.',
    };
  }

  try {
    switch (validated.type) {
      case 'create_project_scaffold':
        return await executeCreateProjectScaffold(validated);
      case 'create_calendar_event_ics':
        return await executeCreateCalendarEventIcs(validated);
      default:
        return {
          success: false,
          message: `Unbekannter Aktionstyp: ${(validated as ProposedAction).type}`,
        };
    }
  } catch (error) {
    console.error('[ActionExecutor] Error executing action:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unbekannter Fehler',
    };
  }
}

// ============================================
// ACTION: create_project_scaffold
// ============================================

/**
 * Creates a project folder with standard files:
 * - README.md
 * - PLAN.md
 * - TASKS.md
 * - ARCHITECTURE.md (if stack is provided)
 */
async function executeCreateProjectScaffold(
  action: CreateProjectScaffoldAction
): Promise<ActionExecutionResult> {
  const { projectName, summary, tasks, stack } = action.params;

  // Get user's Documents folder as base path
  const documentsPath = app.getPath('documents');
  const projectsPath = path.join(documentsPath, 'VoxNote Projects');

  // Ensure VoxNote Projects folder exists
  if (!fs.existsSync(projectsPath)) {
    fs.mkdirSync(projectsPath, { recursive: true });
  }

  // Sanitize project name for filesystem
  const safeName = sanitizeProjectName(projectName);
  const projectDir = path.join(projectsPath, safeName);

  // Check if project already exists
  if (fs.existsSync(projectDir)) {
    // Add timestamp to make unique
    const timestamp = Date.now();
    const uniqueName = `${safeName}-${timestamp}`;
    const uniqueDir = path.join(projectsPath, uniqueName);
    fs.mkdirSync(uniqueDir, { recursive: true });
    await createProjectFiles(uniqueDir, projectName, summary, tasks, stack);
    return {
      success: true,
      message: `Projekt erstellt: ${uniqueName}`,
      outputPath: uniqueDir,
    };
  }

  // Create project directory
  fs.mkdirSync(projectDir, { recursive: true });
  await createProjectFiles(projectDir, projectName, summary, tasks, stack);

  return {
    success: true,
    message: `Projekt erstellt: ${safeName}`,
    outputPath: projectDir,
  };
}

async function createProjectFiles(
  projectDir: string,
  projectName: string,
  summary: string,
  tasks: string[],
  stack?: string[]
): Promise<void> {
  const now = new Date().toISOString().split('T')[0];

  // README.md
  const readmeContent = `# ${projectName}

${summary}

## Quick Start

_Beschreibe hier, wie das Projekt gestartet wird._

## Links

- [PLAN.md](./PLAN.md) - Projektplan
- [TASKS.md](./TASKS.md) - Aufgabenliste
${stack?.length ? '- [ARCHITECTURE.md](./ARCHITECTURE.md) - Architektur' : ''}

---
_Erstellt am ${now} mit VoxNote_
`;

  // PLAN.md
  const planContent = `# Projektplan: ${projectName}

## Zusammenfassung

${summary}

## Ziele

1. _Hauptziel 1_
2. _Hauptziel 2_
3. _Hauptziel 3_

## Meilensteine

### Phase 1: Setup
- [ ] Projekt initialisieren
- [ ] Grundstruktur anlegen

### Phase 2: Entwicklung
- [ ] Kernfunktionen implementieren

### Phase 3: Testing & Launch
- [ ] Tests schreiben
- [ ] Deployment vorbereiten

---
_Erstellt am ${now} mit VoxNote_
`;

  // TASKS.md
  const tasksContent = `# Aufgaben: ${projectName}

## Offen

${tasks.map((t) => `- [ ] ${t}`).join('\n')}

## In Bearbeitung

_Keine_

## Erledigt

_Keine_

---
_Erstellt am ${now} mit VoxNote_
`;

  // Write files
  fs.writeFileSync(path.join(projectDir, 'README.md'), readmeContent);
  fs.writeFileSync(path.join(projectDir, 'PLAN.md'), planContent);
  fs.writeFileSync(path.join(projectDir, 'TASKS.md'), tasksContent);

  // ARCHITECTURE.md (only if stack is provided)
  if (stack?.length) {
    const archContent = `# Architektur: ${projectName}

## Tech Stack

${stack.map((s) => `- ${s}`).join('\n')}

## Komponenten

### Frontend
_Beschreibung der Frontend-Architektur_

### Backend
_Beschreibung der Backend-Architektur_

### Datenbank
_Beschreibung des Datenbankschemas_

## Diagramme

\`\`\`
[Architekturdiagramm hier einfügen]
\`\`\`

---
_Erstellt am ${now} mit VoxNote_
`;
    fs.writeFileSync(path.join(projectDir, 'ARCHITECTURE.md'), archContent);
  }
}

// ============================================
// ACTION: create_calendar_event_ics
// ============================================

/**
 * Creates an .ics file and opens it with the default calendar app.
 */
async function executeCreateCalendarEventIcs(
  action: CreateCalendarEventIcsAction
): Promise<ActionExecutionResult> {
  const { title, startISO, durationMin = 30, notes } = action.params;

  // Parse start time
  const startDate = new Date(startISO);
  if (isNaN(startDate.getTime())) {
    return {
      success: false,
      message: 'Ungültiges Datum/Uhrzeit',
    };
  }

  // Calculate end time
  const endDate = new Date(startDate.getTime() + durationMin * 60 * 1000);

  // Format dates for ICS (YYYYMMDDTHHMMSSZ for UTC)
  const formatICSDate = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  const now = new Date();
  const uid = `voxnote-${now.getTime()}@local`;

  // Build ICS content (RFC 5545)
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VoxNote//VoxNote Calendar//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatICSDate(now)}`,
    `DTSTART:${formatICSDate(startDate)}`,
    `DTEND:${formatICSDate(endDate)}`,
    `SUMMARY:${escapeICSText(title)}`,
    notes ? `DESCRIPTION:${escapeICSText(notes)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');

  // Save to temp directory
  const tempDir = path.join(app.getPath('temp'), 'voxnote', 'calendar');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const safeTitle = sanitizeProjectName(title) || 'event';
  const fileName = `${safeTitle}-${Date.now()}.ics`;
  const filePath = path.join(tempDir, fileName);

  fs.writeFileSync(filePath, icsContent);

  // Open with default calendar app
  try {
    await shell.openPath(filePath);
    return {
      success: true,
      message: `Kalendereintrag erstellt: ${title}`,
      outputPath: filePath,
    };
  } catch (error) {
    // File was created but couldn't open
    return {
      success: true,
      message: `Kalendereintrag gespeichert: ${filePath}`,
      outputPath: filePath,
    };
  }
}

/**
 * Escape special characters for ICS format
 */
function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}
