/**
 * VoxNote Eval System - Types
 * Self-improving test worker for prompt optimization
 */

import type { ModeId } from '../electron/shared/types';

// Test case definition
export interface TestCase {
  id: string;
  mode: ModeId;
  input: string;           // Simulated transcript
  instruction?: string;    // Optional context
  expectations: {
    mustInclude?: string[];      // Required content
    mustNotInclude?: string[];   // Forbidden content
    structure?: string[];        // Expected sections/format
    tone?: 'formal' | 'casual' | 'technical';
    language?: 'de' | 'en';
  };
  weight: number;          // Importance 1-10
}

// Evaluation result from LLM judge
export interface EvalResult {
  testId: string;
  runId: string;
  timestamp: number;

  // Input/Output
  input: string;
  output: string;
  mode: ModeId;

  // Scores (0-100)
  scores: {
    accuracy: number;      // Matches expectations
    completeness: number;  // All info captured
    structure: number;     // Proper formatting
    tone: number;          // Appropriate style
    actionability: number; // Clear next steps
    overall: number;       // Weighted average
  };

  // Qualitative feedback
  feedback: {
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
  };

  // Pass/Fail
  passed: boolean;
  threshold: number;
}

// Aggregate stats per mode
export interface ModeStats {
  mode: ModeId;
  totalRuns: number;
  avgScore: number;
  passRate: number;
  trend: 'improving' | 'stable' | 'declining';
  commonIssues: string[];
  lastUpdated: number;
}

// Prompt optimization suggestion
export interface PromptSuggestion {
  mode: ModeId;
  currentPrompt: string;
  suggestedPrompt: string;
  reasoning: string;
  expectedImprovement: number;
  basedOnRuns: number;
}

// Eval run configuration
export interface EvalConfig {
  testSuite: TestCase[];
  passThreshold: number;      // Min score to pass (0-100)
  runsPerTest: number;        // Repeat for consistency
  autoOptimize: boolean;      // Auto-update prompts
  reportPath: string;         // Where to save reports
}
