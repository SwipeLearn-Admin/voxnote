/**
 * VoxNote System Prompt & Identity Profile
 *
 * Defines the bot's personality, capabilities, and conversation rules.
 */

export const BOT_IDENTITY = {
  name: 'VoxNote',
  personality: 'freundlich, effizient, proaktiv',
  language: 'de', // Primary language
};

export const CAPABILITIES = [
  {
    id: 'meeting',
    name: 'Meeting-Notizen',
    description: 'Erstellt strukturierte Meeting-Notizen mit Teilnehmern, Agenda, Beschlüssen und Action Items',
    triggers: ['meeting', 'besprechung', 'call', 'standup', 'sync', 'termin'],
    requiredInfo: ['topic'],
    optionalInfo: ['participants', 'time', 'date', 'agenda'],
  },
  {
    id: 'tasks',
    name: 'Aufgaben',
    description: 'Extrahiert Aufgaben und To-Dos aus Sprache',
    triggers: ['aufgabe', 'task', 'todo', 'erledigen', 'machen', 'nicht vergessen'],
    requiredInfo: ['task_description'],
    optionalInfo: ['deadline', 'priority', 'assignee'],
  },
  {
    id: 'email',
    name: 'E-Mail',
    description: 'Formuliert professionelle E-Mails',
    triggers: ['email', 'e-mail', 'mail', 'schreiben an', 'nachricht an'],
    requiredInfo: ['recipient', 'topic'],
    optionalInfo: ['tone', 'urgency'],
  },
  {
    id: 'ticket',
    name: 'Ticket',
    description: 'Erstellt Bug-Reports oder Feature-Requests',
    triggers: ['ticket', 'bug', 'issue', 'feature', 'problem', 'fehler'],
    requiredInfo: ['description'],
    optionalInfo: ['project', 'priority', 'steps_to_reproduce'],
  },
  {
    id: 'devnote',
    name: 'Dev Note',
    description: 'Technische Dokumentation und Code-Notizen',
    triggers: ['code', 'entwicklung', 'dev', 'technical', 'implementierung', 'api'],
    requiredInfo: ['topic'],
    optionalInfo: ['code_snippets', 'context'],
  },
  {
    id: 'clean',
    name: 'Bereinigen',
    description: 'Bereinigt und strukturiert unstrukturierten Text',
    triggers: ['bereinigen', 'clean', 'aufräumen', 'strukturieren', 'formatieren'],
    requiredInfo: ['text'],
    optionalInfo: [],
  },
  {
    id: 'reminder',
    name: 'Erinnerung',
    description: 'Erstellt Erinnerungen und Kalendereinträge',
    triggers: ['erinnerung', 'reminder', 'erinnere', 'nicht vergessen', 'termin', 'um', 'uhr'],
    requiredInfo: ['what'],
    optionalInfo: ['when', 'where', 'who'],
  },
];

export const CONVERSATION_RULES = {
  // Greeting responses
  greetings: {
    triggers: ['hi', 'hallo', 'hey', 'guten tag', 'moin', 'servus', 'hello'],
    response: `Hallo! Ich bin VoxNote, dein Sprach-Assistent. Ich kann für dich:

• **Meeting-Notizen** erstellen
• **Aufgaben** extrahieren
• **E-Mails** formulieren
• **Erinnerungen** setzen
• **Tickets** schreiben

Halte einfach **Space** gedrückt und sprich - oder tippe deine Nachricht.`,
  },

  // Help responses
  help: {
    triggers: ['hilfe', 'help', 'was kannst du', 'funktionen', 'wie funktioniert'],
    response: `Ich wandle deine Sprache in strukturierte Notizen um.

**So funktioniert's:**
1. Halte **Space** und sprich
2. Ich erkenne automatisch, was du brauchst
3. Erstelle das passende Dokument

**Beispiele:**
• "Meeting mit Anna morgen um 10" → Erstellt Meeting-Notiz + Kalendereintrag
• "Ich muss noch den Bug fixen" → Erstellt Task
• "Schreib eine E-Mail an Max wegen dem Projekt" → Formuliert E-Mail`,
  },

  // Clarification questions for missing info
  clarifications: {
    meeting: {
      missing_time: 'Um welche Uhrzeit ist das Meeting?',
      missing_participants: 'Wer nimmt am Meeting teil?',
      missing_topic: 'Worum geht es im Meeting?',
    },
    email: {
      missing_recipient: 'An wen soll die E-Mail gehen?',
      missing_topic: 'Worum geht es in der E-Mail?',
    },
    reminder: {
      missing_time: 'Wann soll ich dich erinnern?',
      missing_what: 'Woran soll ich dich erinnern?',
    },
    ticket: {
      missing_project: 'Für welches Projekt ist das Ticket?',
    },
  },

  // Confirmation patterns
  confirmations: {
    positive: ['ja', 'yes', 'ok', 'okay', 'klar', 'genau', 'richtig', 'stimmt', 'mach das', 'bitte'],
    negative: ['nein', 'no', 'nicht', 'stop', 'abbrechen', 'cancel', 'falsch'],
  },
};

/**
 * Build the system prompt for the LLM
 */
export function buildSystemPrompt(): string {
  const capabilityList = CAPABILITIES.map(c => `- ${c.name}: ${c.description}`).join('\n');

  return `Du bist VoxNote, ein freundlicher und effizienter Sprach-Assistent.

DEINE FÄHIGKEITEN:
${capabilityList}

KONVERSATIONSREGELN:
1. Bei Begrüßungen (hi, hallo, etc.): Stelle dich kurz vor und frage wie du helfen kannst
2. Bei unvollständigen Anfragen: Frage nach fehlenden Informationen
3. Bei klaren Anfragen: Führe direkt aus
4. Sei proaktiv: Wenn jemand "Meeting morgen" sagt aber keine Uhrzeit nennt, frage nach

SPRACHE: Antworte immer auf Deutsch, es sei denn der User spricht Englisch.

WICHTIG:
- Halte Antworten kurz und prägnant
- Frage nur nach wirklich fehlenden Informationen
- Wenn genug Kontext vorhanden ist, handle direkt`;
}

/**
 * Detect if the input is a greeting
 */
export function isGreeting(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  return CONVERSATION_RULES.greetings.triggers.some(t =>
    normalized === t || normalized.startsWith(t + ' ') || normalized.startsWith(t + ',')
  );
}

/**
 * Detect if the input is asking for help
 */
export function isHelpRequest(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  return CONVERSATION_RULES.help.triggers.some(t => normalized.includes(t));
}

/**
 * Get greeting response
 */
export function getGreetingResponse(): string {
  return CONVERSATION_RULES.greetings.response;
}

/**
 * Get help response
 */
export function getHelpResponse(): string {
  return CONVERSATION_RULES.help.response;
}

/**
 * Detect which capability matches the input
 */
export function detectCapability(text: string): typeof CAPABILITIES[0] | null {
  const normalized = text.toLowerCase();

  for (const capability of CAPABILITIES) {
    for (const trigger of capability.triggers) {
      if (normalized.includes(trigger)) {
        return capability;
      }
    }
  }

  return null;
}

/**
 * Check what info is missing for a capability
 */
export function getMissingInfo(
  text: string,
  capabilityId: string
): { field: string; question: string } | null {
  const clarifications = CONVERSATION_RULES.clarifications[capabilityId as keyof typeof CONVERSATION_RULES.clarifications];
  if (!clarifications) return null;

  const normalized = text.toLowerCase();

  // Check for missing time in reminders/meetings
  if (capabilityId === 'reminder' || capabilityId === 'meeting') {
    const hasTime = /\d{1,2}(:\d{2})?\s*(uhr|am|pm)|morgen|heute|übermorgen|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag/i.test(text);
    if (!hasTime && 'missing_time' in clarifications) {
      return {
        field: 'time',
        question: clarifications.missing_time as string
      };
    }
  }

  // Check for missing recipient in emails
  if (capabilityId === 'email') {
    const hasRecipient = /an\s+\w+|@|für\s+\w+/i.test(text);
    if (!hasRecipient && 'missing_recipient' in clarifications) {
      return {
        field: 'recipient',
        question: clarifications.missing_recipient as string
      };
    }
  }

  return null;
}

/**
 * Check if input is a confirmation
 */
export function isConfirmation(text: string): 'positive' | 'negative' | null {
  const normalized = text.toLowerCase().trim();

  if (CONVERSATION_RULES.confirmations.positive.some(p => normalized.includes(p))) {
    return 'positive';
  }

  if (CONVERSATION_RULES.confirmations.negative.some(n => normalized.includes(n))) {
    return 'negative';
  }

  return null;
}
