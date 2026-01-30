/**
 * VoxNote Eval System
 * Self-improving test framework for LLM-powered voice assistant
 *
 * Usage:
 *   npx ts-node eval/index.ts              # Run full test suite
 *   npx ts-node eval/index.ts meeting      # Run only meeting mode tests
 *   npx ts-node eval/index.ts --optimize   # Run tests + auto-optimize prompts
 *
 * The system:
 * 1. Runs test cases through the enrichment pipeline
 * 2. Evaluates outputs using LLM-as-Judge
 * 3. Generates detailed reports with scores
 * 4. Optionally suggests prompt improvements
 */

export { Evaluator } from './evaluator';
export { EvalRunner } from './runner';
export { TEST_CASES } from './test-cases';
export type {
  TestCase,
  EvalResult,
  ModeStats,
  PromptSuggestion,
  EvalConfig,
} from './types';

// Re-export runner as default for CLI usage
import { EvalRunner } from './runner';
export default EvalRunner;
