/**
 * VoxNote Smoke Tests
 *
 * Manual smoke tests for the VoxNote Project Assistant features.
 * Run these tests manually after each deployment or significant change.
 *
 * Prerequisites:
 * - App is running
 * - User is authenticated with Supabase
 * - At least one project exists (or will be created during test)
 */

export interface SmokeTestCase {
  id: string;
  name: string;
  description: string;
  steps: string[];
  expectedResult: string;
  category: 'clarify' | 'text-path' | 'project' | 'intent';
}

export const SMOKE_TESTS: SmokeTestCase[] = [
  // ============================================
  // TEST 1: Clarify Flow
  // ============================================
  {
    id: 'clarify-time',
    name: 'Clarify Flow - Time Slot',
    description: 'Test that clarify prompts for missing time and processes answer correctly',
    category: 'clarify',
    steps: [
      '1. Open VoxNote app',
      '2. Hold Space and say: "Meeting morgen"',
      '3. Wait for transcription',
      '4. Observe: Bot should ask "Wann?" or similar time clarification',
      '5. Type: "10 Uhr"',
      '6. Press Enter',
    ],
    expectedResult: 'Meeting note is created with the time "10 Uhr" included. No double LLM call.',
  },
  {
    id: 'clarify-recipient',
    name: 'Clarify Flow - Recipient Slot',
    description: 'Test that clarify prompts for missing recipient',
    category: 'clarify',
    steps: [
      '1. Open VoxNote app',
      '2. Hold Space and say: "Schreibe eine Email über den Projektstand"',
      '3. Wait for transcription',
      '4. Observe: Bot should ask "An wen?" or similar recipient clarification',
      '5. Type: "an Max Müller"',
      '6. Press Enter',
    ],
    expectedResult: 'Email draft is created addressing Max Müller. Context is properly combined.',
  },
  {
    id: 'clarify-no-loop',
    name: 'Clarify Flow - No Infinite Loop',
    description: 'Verify that clarification answers do not trigger re-routing through Intent Router',
    category: 'clarify',
    steps: [
      '1. Open VoxNote app',
      '2. Open browser DevTools Console',
      '3. Hold Space and say: "Termin nächste Woche"',
      '4. Wait for clarification question',
      '5. Answer: "Dienstag 14 Uhr"',
      '6. Check Console for LLM call count',
    ],
    expectedResult: 'Only 1 enrichment LLM call after answer. No re-routing through Intent Router.',
  },

  // ============================================
  // TEST 2: Text Path (No Recording)
  // ============================================
  {
    id: 'text-path-reminder',
    name: 'Text Path - Direct Reminder',
    description: 'Test that text input creates artifact without requiring recording',
    category: 'text-path',
    steps: [
      '1. Open VoxNote app',
      '2. Type in text field: "Erinnerung: Arzt am Freitag um 15 Uhr"',
      '3. Press Enter',
      '4. Wait for processing',
    ],
    expectedResult: 'Reminder is created directly from text input. No "Press Space" prompt appears.',
  },
  {
    id: 'text-path-devnote',
    name: 'Text Path - DevNote Creation',
    description: 'Test text path with devnote mode',
    category: 'text-path',
    steps: [
      '1. Open VoxNote app',
      '2. Press key "6" to select devnote mode',
      '3. Type: "Fixed bug in auth flow where tokens were not refreshed"',
      '4. Press Enter',
    ],
    expectedResult: 'DevNote is created with the entered text as content.',
  },

  // ============================================
  // TEST 3: Project Context
  // ============================================
  {
    id: 'project-create',
    name: 'Project Creation',
    description: 'Test creating a new project',
    category: 'project',
    steps: [
      '1. Open VoxNote app',
      '2. Press Cmd+P to open Project Switcher',
      '3. Click "Neues Projekt erstellen"',
      '4. Enter name: "TestProjekt"',
      '5. Enter description: "Test Projekt für Smoke Tests"',
      '6. Check "Als Standard setzen"',
      '7. Click "Erstellen"',
    ],
    expectedResult: 'Project is created. Switcher closes. ProjectChip shows "TestProjekt".',
  },
  {
    id: 'project-context-injection',
    name: 'Project Context Injection',
    description: 'Test that project context is injected into enrichment',
    category: 'project',
    steps: [
      '1. Create and select project "VoxNote App"',
      '2. Hold Space and say: "Meeting mit Max über API Design"',
      '3. Select mode 1 (Meeting)',
      '4. Wait for enrichment',
      '5. Check the generated artifact',
    ],
    expectedResult: 'Artifact contains project context. artifact.project_id matches active project.',
  },
  {
    id: 'project-switch',
    name: 'Project Switching',
    description: 'Test switching between projects',
    category: 'project',
    steps: [
      '1. Create two projects: "Projekt A" and "Projekt B"',
      '2. Select "Projekt A"',
      '3. Create a note: "Note for Project A"',
      '4. Press Cmd+P',
      '5. Select "Projekt B"',
      '6. Create a note: "Note for Project B"',
      '7. Verify in Supabase that notes have correct project_id',
    ],
    expectedResult: 'Each note has the correct project_id assigned.',
  },
  {
    id: 'project-no-project',
    name: 'Working Without Project',
    description: 'Test that "Ohne Projekt" option works',
    category: 'project',
    steps: [
      '1. Press Cmd+P to open Project Switcher',
      '2. Click "Ohne Projekt"',
      '3. Verify ProjectChip shows "Kein Projekt"',
      '4. Create a note',
      '5. Verify in Supabase that artifact.project_id is null',
    ],
    expectedResult: 'Artifact is created with null project_id.',
  },

  // ============================================
  // TEST 4: Intent Routing
  // ============================================
  {
    id: 'intent-create-artifact',
    name: 'Intent Router - Create Artifact',
    description: 'Test that create_artifact intent triggers mode selection',
    category: 'intent',
    steps: [
      '1. Open VoxNote app',
      '2. Say: "Erstelle mir eine Zusammenfassung vom Meeting heute"',
      '3. Wait for Intent Router response',
    ],
    expectedResult: 'Intent Router identifies create_artifact. Mode selection is triggered or auto-selected.',
  },
  {
    id: 'intent-record',
    name: 'Intent Router - Record Intent',
    description: 'Test that record intent prompts for recording',
    category: 'intent',
    steps: [
      '1. Open VoxNote app',
      '2. Type: "Ich möchte etwas diktieren"',
      '3. Press Enter',
    ],
    expectedResult: 'Bot prompts to hold Space for recording.',
  },
  {
    id: 'intent-search',
    name: 'Intent Router - Search Intent',
    description: 'Test that search intent queries memory',
    category: 'intent',
    steps: [
      '1. Create some notes about "API Design"',
      '2. Type: "Was hatten wir zum API Design besprochen?"',
      '3. Press Enter',
    ],
    expectedResult: 'Bot searches memory and returns relevant context from previous notes.',
  },
];

// ============================================
// Test Runner Helper
// ============================================
export function runSmokeTest(testId: string): void {
  const test = SMOKE_TESTS.find(t => t.id === testId);
  if (!test) {
    console.error(`Test not found: ${testId}`);
    return;
  }

  console.log('\n========================================');
  console.log(`SMOKE TEST: ${test.name}`);
  console.log(`Category: ${test.category}`);
  console.log('========================================');
  console.log(`\nDescription: ${test.description}`);
  console.log('\nSteps:');
  test.steps.forEach(step => console.log(`  ${step}`));
  console.log(`\nExpected Result: ${test.expectedResult}`);
  console.log('\n========================================\n');
}

export function listSmokeTests(): void {
  console.log('\n========================================');
  console.log('VOXNOTE SMOKE TESTS');
  console.log('========================================\n');

  const categories = ['clarify', 'text-path', 'project', 'intent'] as const;

  categories.forEach(category => {
    const tests = SMOKE_TESTS.filter(t => t.category === category);
    console.log(`\n${category.toUpperCase()}:`);
    tests.forEach(test => {
      console.log(`  - [${test.id}] ${test.name}`);
    });
  });

  console.log('\n========================================');
  console.log('To run a test: runSmokeTest("test-id")');
  console.log('========================================\n');
}

// ============================================
// Automated Test Helpers (for CI/CD)
// ============================================
export interface TestResult {
  testId: string;
  passed: boolean;
  error?: string;
  duration: number;
}

/**
 * Verifies store state for clarify flow
 */
export function verifyClarifyState(store: {
  pendingClarification: unknown | null;
  phase: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (store.phase === 'clarifying' && !store.pendingClarification) {
    errors.push('Phase is clarifying but pendingClarification is null');
  }

  if (store.pendingClarification && store.phase !== 'clarifying') {
    errors.push('pendingClarification exists but phase is not clarifying');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Verifies project state consistency
 */
export function verifyProjectState(store: {
  activeProjectId: string | null;
  projects: Array<{ id: string }>;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (store.activeProjectId) {
    const projectExists = store.projects.some(p => p.id === store.activeProjectId);
    if (!projectExists) {
      errors.push(`activeProjectId "${store.activeProjectId}" not found in projects list`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Export for use in tests
export default {
  SMOKE_TESTS,
  runSmokeTest,
  listSmokeTests,
  verifyClarifyState,
  verifyProjectState,
};
