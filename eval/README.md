# 🧪 VoxNote Eval System

Self-improving test framework that uses **LLM-as-Judge** to evaluate and optimize prompt quality.

## 🚀 Quick Start

```bash
# Install dependencies (only needed once)
npm install

# Run full test suite
npm run eval

# Run tests for specific mode
npm run eval:mode meeting

# Run tests + auto-optimize prompts
npm run eval:optimize

# Watch mode (re-run on changes)
npm run eval:watch
```

## 🔄 How It Works

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Test Cases  │────►│   Pipeline   │────►│  Evaluator   │
│  (20+ tests) │     │ (Enrichment) │     │  (LLM Judge) │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                 │
                     ┌──────────────┐     ┌──────▼───────┐
                     │   Optimize   │◄────│    Report    │
                     │   Prompts    │     │   + Scores   │
                     └──────────────┘     └──────────────┘
```

## 📊 Evaluation Criteria

Each output is scored 0-100 on:

| Criterion | Weight | Description |
|-----------|--------|-------------|
| **Accuracy** | 25% | All info captured, no hallucinations |
| **Completeness** | 20% | Nothing important missing |
| **Structure** | 20% | Correct format for mode |
| **Tone** | 20% | Appropriate style (formal/casual/technical) |
| **Actionability** | 15% | Clear next steps |

## 📁 Test Cases

Located in `test-cases.ts`:

- **Meeting** (3 tests): Summaries, action items, decisions
- **Tasks** (3 tests): Checkbox lists, priorities
- **Email** (3 tests): Professional drafts, formal/casual
- **Ticket** (2 tests): Bug reports, Jira-style
- **DevNote** (2 tests): Technical changes, changelogs
- **Clean** (2 tests): Filler word removal
- **Reminder** (2 tests): Time-based reminders
- **Edge Cases** (3 tests): Short input, no tasks, aggressive tone

## 📈 Reports

Reports are saved to `eval/reports/`:

```json
{
  "summary": {
    "total": 20,
    "passed": 17,
    "passRate": "85%",
    "avgScore": 78.5
  },
  "modeStats": [...],
  "results": [...]
}
```

## 🔧 Auto-Optimization

When running with `--optimize`:

1. Identifies modes with pass rate < 90%
2. Analyzes common failure patterns
3. Uses GPT-4 to suggest prompt improvements
4. Saves improved prompts to `eval/reports/prompt_*.txt`

## 🎯 Adding Test Cases

```typescript
// In test-cases.ts
{
  id: 'meeting-004',
  mode: 'meeting',
  input: 'Your test transcript...',
  expectations: {
    mustInclude: ['expected', 'words'],
    mustNotInclude: ['forbidden', 'words'],
    structure: ['Required', 'Sections'],
    tone: 'formal',
    language: 'de',
  },
  weight: 8, // 1-10 importance
}
```

## 🛠️ Configuration

```typescript
const runner = new EvalRunner(apiKey, {
  passThreshold: 70,     // Min score to pass (0-100)
  runsPerTest: 3,        // Repeat for consistency
  autoOptimize: true,    // Auto-update prompts
  reportPath: './eval/reports',
});
```

## 📊 Example Output

```
🧪 VoxNote Eval Suite
==================================================
📋 20 Test Cases
🎯 Pass Threshold: 70%
🔄 Runs per Test: 1
==================================================

🔬 Running: meeting-001 (meeting)
  ✅ Run 1: 85.2% (A:90 C:82 S:88 T:80)

🔬 Running: meeting-002 (meeting)
  ❌ Run 1: 62.4% (A:70 C:55 S:65 T:60)
     ⚠️  Missing action items, Informal tone

==================================================
📊 EVAL SUMMARY
==================================================
⏱️  Duration: 45.2s
📝 Total: 20 tests
✅ Passed: 17 (85.0%)
❌ Failed: 3
📈 Avg Score: 78.5%

📊 BY MODE:
  🟢 meeting    | Score: 82.3% | Pass: 100% | Trend: stable
  🟢 tasks      | Score: 79.1% | Pass: 100% | Trend: stable
  🟡 email      | Score: 68.5% | Pass: 67%  | Trend: improving
  🟢 ticket     | Score: 85.0% | Pass: 100% | Trend: stable

⚠️  TOP ISSUES:
  - missing action items (3x)
  - informal tone in formal context (2x)
  - filler words not removed (2x)
```

## 🔮 Future Ideas

- [ ] A/B testing different prompts
- [ ] Historical trend tracking
- [ ] Regression detection
- [ ] CI/CD integration
- [ ] Slack/Discord notifications
- [ ] Human-in-the-loop feedback
