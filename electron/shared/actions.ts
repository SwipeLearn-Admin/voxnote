import { z } from 'zod';

// ============================================
// ACTION SCHEMAS (Zod)
// ============================================

/**
 * Action 1: Create Project Scaffold
 * Creates a project folder with README, PLAN, TASKS, ARCHITECTURE files
 */
export const CreateProjectScaffoldSchema = z.object({
  type: z.literal('create_project_scaffold'),
  label: z.string(),
  params: z.object({
    projectName: z.string().min(1),
    summary: z.string(),
    tasks: z.array(z.string()),
    stack: z.array(z.string()).optional(),
  }),
});

/**
 * Action 2: Create Calendar Event ICS
 * Creates an .ics file and opens it with the default calendar app
 */
export const CreateCalendarEventIcsSchema = z.object({
  type: z.literal('create_calendar_event_ics'),
  label: z.string(),
  params: z.object({
    title: z.string().min(1),
    startISO: z.string(), // ISO datetime string
    durationMin: z.number().positive().optional().default(30),
    notes: z.string().optional(),
  }),
});

/**
 * Union of all possible actions
 */
export const ProposedActionSchema = z.discriminatedUnion('type', [
  CreateProjectScaffoldSchema,
  CreateCalendarEventIcsSchema,
]);

// ============================================
// TYPESCRIPT TYPES (inferred from Zod)
// ============================================

export type CreateProjectScaffoldAction = z.infer<typeof CreateProjectScaffoldSchema>;
export type CreateCalendarEventIcsAction = z.infer<typeof CreateCalendarEventIcsSchema>;

/**
 * IMPORTANT: Actions must NEVER be executed without explicit user confirmation.
 * The UI must show a confirmation dialog before calling executeProposedAction().
 */
export type ProposedAction = z.infer<typeof ProposedActionSchema>;

export type ActionType = ProposedAction['type'];

// ============================================
// ACTION RESULT TYPE
// ============================================

export interface ActionExecutionResult {
  success: boolean;
  message?: string;
  outputPath?: string;
}

// ============================================
// PARSER FUNCTIONS
// ============================================

/**
 * Parse and validate an array of proposed actions
 * Invalid actions are silently filtered out (graceful degradation)
 */
export function parseProposedActions(actions: unknown): ProposedAction[] {
  if (!Array.isArray(actions)) {
    return [];
  }

  const valid: ProposedAction[] = [];

  for (const action of actions) {
    const result = ProposedActionSchema.safeParse(action);
    if (result.success) {
      valid.push(result.data);
    } else {
      console.warn('[Actions] Invalid action skipped:', result.error.message);
    }
  }

  return valid;
}

/**
 * Validate a single action
 */
export function validateAction(action: unknown): ProposedAction | null {
  const result = ProposedActionSchema.safeParse(action);
  return result.success ? result.data : null;
}

// ============================================
// MODE -> ACTION MAPPING
// ============================================

/**
 * Defines which actions are allowed for each mode.
 * This is used in prompts to constrain LLM output.
 */
export const MODE_ACTION_MAPPING: Record<string, ActionType[]> = {
  meeting: ['create_project_scaffold', 'create_calendar_event_ics'],
  tasks: ['create_project_scaffold'],
  devnote: ['create_project_scaffold'],
  reminder: ['create_calendar_event_ics'],
  plan: ['create_project_scaffold'], // Plans can create project scaffolds
  email: [], // No actions - output is the draft
  ticket: [], // No actions - output is the ticket
  clean: [], // No actions - output is clean text
};

/**
 * Get allowed actions for a mode
 */
export function getAllowedActionsForMode(mode: string): ActionType[] {
  return MODE_ACTION_MAPPING[mode] || [];
}

/**
 * Check if an action is allowed for a mode
 */
export function isActionAllowedForMode(actionType: ActionType, mode: string): boolean {
  const allowed = MODE_ACTION_MAPPING[mode] || [];
  return allowed.includes(actionType);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Sanitize project name for filesystem safety
 */
export function sanitizeProjectName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]/g, '-')  // only safe chars
    .replace(/-+/g, '-')           // collapse dashes
    .replace(/^-|-$/g, '')         // no leading/trailing dash
    .slice(0, 50)                  // length cap
    || 'project';                  // fallback
}

// ============================================
// ROBUST JSON PARSE STRATEGY
// ============================================

interface ParsedEnrichmentResult {
  markdown: string;
  data?: unknown;
  actions?: ProposedAction[];
}

/**
 * Robustly extract JSON from LLM response.
 * Handles:
 * - Clean JSON
 * - JSON wrapped in markdown code fences
 * - Leading/trailing whitespace
 * - Invalid JSON with fallback to raw text
 */
export function parseEnrichmentResponse(content: string): ParsedEnrichmentResult {
  const trimmed = content.trim();

  // Strategy 1: Direct JSON parse
  try {
    const parsed = JSON.parse(trimmed);
    return validateAndNormalize(parsed);
  } catch {
    // Continue to next strategy
  }

  // Strategy 2: Extract from markdown code fence
  const jsonCodeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonCodeBlockMatch) {
    try {
      const parsed = JSON.parse(jsonCodeBlockMatch[1].trim());
      return validateAndNormalize(parsed);
    } catch {
      // Continue to next strategy
    }
  }

  // Strategy 3: Find JSON object in text (greedy match for outermost braces)
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return validateAndNormalize(parsed);
    } catch {
      // Continue to fallback
    }
  }

  // Fallback: Treat entire content as markdown
  console.warn('[parseEnrichmentResponse] Failed to parse JSON, falling back to raw content');
  return {
    markdown: trimmed,
    data: undefined,
    actions: [],
  };
}

/**
 * Validate and normalize parsed JSON into EnrichmentResult
 */
function validateAndNormalize(parsed: unknown): ParsedEnrichmentResult {
  if (typeof parsed !== 'object' || parsed === null) {
    return { markdown: String(parsed), actions: [] };
  }

  const obj = parsed as Record<string, unknown>;

  // Extract markdown (required)
  let markdown: string;
  if (typeof obj.markdown === 'string') {
    markdown = obj.markdown;
  } else if (typeof obj.content === 'string') {
    // Fallback field name
    markdown = obj.content;
  } else if (typeof obj.text === 'string') {
    // Another fallback
    markdown = obj.text;
  } else {
    // Last resort: stringify the whole thing
    markdown = JSON.stringify(parsed, null, 2);
  }

  // Extract and validate actions
  const actions = parseProposedActions(obj.actions);

  // Extract data (optional, pass through)
  const data = obj.data;

  return { markdown, data, actions };
}
