/**
 * VoxNote Eval System - Test Runner
 * Orchestrates test execution, evaluation, and optimization
 */

import * as fs from 'fs';
import * as path from 'path';
import { Evaluator } from './evaluator';
import { TEST_CASES } from './test-cases';
import type { TestCase, EvalResult, ModeStats, EvalConfig } from './types';
import type { ModeId } from '../electron/shared/types';

// Import the enrichment function
import { enrichText } from '../electron/services/openai';
import { getPromptForMode } from '../electron/shared/prompts';

const DEFAULT_CONFIG: EvalConfig = {
  testSuite: TEST_CASES,
  passThreshold: 70,
  runsPerTest: 1,
  autoOptimize: false,
  reportPath: './eval/reports',
};

export class EvalRunner {
  private evaluator: Evaluator;
  private config: EvalConfig;
  private results: EvalResult[] = [];
  private startTime: number = 0;

  constructor(apiKey: string, config: Partial<EvalConfig> = {}) {
    this.evaluator = new Evaluator(apiKey);
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Ensure report directory exists
    if (!fs.existsSync(this.config.reportPath)) {
      fs.mkdirSync(this.config.reportPath, { recursive: true });
    }
  }

  async runFullSuite(): Promise<void> {
    this.startTime = Date.now();
    this.results = [];

    console.log('\n🧪 VoxNote Eval Suite');
    console.log('='.repeat(50));
    console.log(`📋 ${this.config.testSuite.length} Test Cases`);
    console.log(`🎯 Pass Threshold: ${this.config.passThreshold}%`);
    console.log(`🔄 Runs per Test: ${this.config.runsPerTest}`);
    console.log('='.repeat(50));

    for (const testCase of this.config.testSuite) {
      await this.runTestCase(testCase);
    }

    await this.generateReport();

    if (this.config.autoOptimize) {
      await this.optimizePrompts();
    }
  }

  async runTestCase(testCase: TestCase): Promise<EvalResult[]> {
    const results: EvalResult[] = [];

    console.log(`\n🔬 Running: ${testCase.id} (${testCase.mode})`);

    for (let run = 0; run < this.config.runsPerTest; run++) {
      try {
        // Run the enrichment pipeline
        const output = await enrichText({
          transcript: testCase.input,
          mode: testCase.mode,
          language: 'auto',
          context: testCase.instruction,
        });

        // Evaluate the output
        const evalResult = await this.evaluator.evaluate(
          testCase,
          output.markdown,
          this.config.passThreshold
        );

        results.push(evalResult);
        this.results.push(evalResult);

        // Log result
        const icon = evalResult.passed ? '✅' : '❌';
        console.log(
          `  ${icon} Run ${run + 1}: ${evalResult.scores.overall.toFixed(1)}% ` +
            `(A:${evalResult.scores.accuracy} C:${evalResult.scores.completeness} ` +
            `S:${evalResult.scores.structure} T:${evalResult.scores.tone})`
        );

        if (!evalResult.passed) {
          console.log(`     ⚠️  ${evalResult.feedback.weaknesses.slice(0, 2).join(', ')}`);
        }
      } catch (error) {
        console.error(`  ❌ Error: ${error}`);
      }
    }

    return results;
  }

  async runSingleMode(mode: ModeId): Promise<EvalResult[]> {
    const modeTests = this.config.testSuite.filter((t) => t.mode === mode);
    console.log(`\n🎯 Running ${modeTests.length} tests for mode: ${mode}`);

    for (const testCase of modeTests) {
      await this.runTestCase(testCase);
    }

    return this.results.filter((r) => r.mode === mode);
  }

  async generateReport(): Promise<void> {
    const duration = Date.now() - this.startTime;
    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.length - passed;
    const passRate = (passed / this.results.length) * 100;

    // Calculate stats per mode
    const modeStats = this.calculateModeStats();

    // Create report
    const report = {
      timestamp: new Date().toISOString(),
      duration: `${(duration / 1000).toFixed(1)}s`,
      summary: {
        total: this.results.length,
        passed,
        failed,
        passRate: `${passRate.toFixed(1)}%`,
        avgScore: this.calculateAvgScore(),
      },
      modeStats,
      results: this.results,
      config: {
        threshold: this.config.passThreshold,
        runsPerTest: this.config.runsPerTest,
      },
    };

    // Save JSON report
    const reportFile = path.join(
      this.config.reportPath,
      `report_${Date.now()}.json`
    );
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 EVAL SUMMARY');
    console.log('='.repeat(50));
    console.log(`⏱️  Duration: ${report.duration}`);
    console.log(`📝 Total: ${report.summary.total} tests`);
    console.log(`✅ Passed: ${passed} (${passRate.toFixed(1)}%)`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Avg Score: ${report.summary.avgScore.toFixed(1)}%`);
    console.log('\n📁 Report saved: ' + reportFile);

    // Mode breakdown
    console.log('\n📊 BY MODE:');
    for (const stats of modeStats) {
      const icon = stats.passRate >= 80 ? '🟢' : stats.passRate >= 60 ? '🟡' : '🔴';
      console.log(
        `  ${icon} ${stats.mode.padEnd(10)} | ` +
          `Score: ${stats.avgScore.toFixed(1)}% | ` +
          `Pass: ${stats.passRate.toFixed(0)}% | ` +
          `Trend: ${stats.trend}`
      );
    }

    // Top issues
    const allIssues = this.results
      .filter((r) => !r.passed)
      .flatMap((r) => r.feedback.weaknesses);
    const topIssues = this.countOccurrences(allIssues).slice(0, 5);

    if (topIssues.length > 0) {
      console.log('\n⚠️  TOP ISSUES:');
      topIssues.forEach(([issue, count]) => {
        console.log(`  - ${issue} (${count}x)`);
      });
    }
  }

  private calculateModeStats(): ModeStats[] {
    const modes: ModeId[] = ['meeting', 'tasks', 'email', 'ticket', 'devnote', 'clean', 'reminder'];
    const stats: ModeStats[] = [];

    for (const mode of modes) {
      const modeResults = this.results.filter((r) => r.mode === mode);
      if (modeResults.length === 0) continue;

      const avgScore =
        modeResults.reduce((sum, r) => sum + r.scores.overall, 0) / modeResults.length;
      const passRate =
        (modeResults.filter((r) => r.passed).length / modeResults.length) * 100;

      // Determine trend (would need historical data)
      const trend = avgScore >= 80 ? 'stable' : avgScore >= 60 ? 'improving' : 'declining';

      const commonIssues = this.countOccurrences(
        modeResults.filter((r) => !r.passed).flatMap((r) => r.feedback.weaknesses)
      )
        .slice(0, 3)
        .map(([issue]) => issue);

      stats.push({
        mode,
        totalRuns: modeResults.length,
        avgScore,
        passRate,
        trend: trend as 'improving' | 'stable' | 'declining',
        commonIssues,
        lastUpdated: Date.now(),
      });
    }

    return stats;
  }

  private calculateAvgScore(): number {
    if (this.results.length === 0) return 0;
    return this.results.reduce((sum, r) => sum + r.scores.overall, 0) / this.results.length;
  }

  private countOccurrences(items: string[]): [string, number][] {
    const counts = new Map<string, number>();
    for (const item of items) {
      const normalized = item.toLowerCase().trim();
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }

  async optimizePrompts(): Promise<void> {
    console.log('\n🔧 AUTO-OPTIMIZING PROMPTS...');

    const modes: ModeId[] = ['meeting', 'tasks', 'email', 'ticket', 'devnote', 'clean', 'reminder'];

    for (const mode of modes) {
      const modeResults = this.results.filter((r) => r.mode === mode);
      const failedResults = modeResults.filter((r) => !r.passed);

      if (failedResults.length < 2) {
        console.log(`  ⏭️  ${mode}: Not enough failures to optimize`);
        continue;
      }

      const passRate = ((modeResults.length - failedResults.length) / modeResults.length) * 100;

      if (passRate >= 90) {
        console.log(`  ✅ ${mode}: Already at ${passRate.toFixed(0)}% - skipping`);
        continue;
      }

      console.log(`  🔄 ${mode}: Optimizing (current: ${passRate.toFixed(0)}%)...`);

      const currentPrompt = getPromptForMode(mode);
      const improvedPrompt = await this.evaluator.suggestPromptImprovement(
        mode,
        currentPrompt,
        failedResults
      );

      // Save improved prompt to file
      const promptFile = path.join(this.config.reportPath, `prompt_${mode}_improved.txt`);
      fs.writeFileSync(promptFile, improvedPrompt);
      console.log(`     💾 Saved: ${promptFile}`);
    }
  }

  getResults(): EvalResult[] {
    return this.results;
  }
}

// CLI interface
async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY not set');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const autoOptimize = args.includes('--optimize');
  const mode = args.find((a) => !a.startsWith('--')) as ModeId | undefined;

  const runner = new EvalRunner(apiKey, {
    autoOptimize,
    passThreshold: 70,
    runsPerTest: 1,
  });

  if (mode) {
    await runner.runSingleMode(mode);
  } else {
    await runner.runFullSuite();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export default EvalRunner;
