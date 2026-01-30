/**
 * VoxNote Eval System - LLM Evaluator
 * Uses GPT to judge output quality and suggest improvements
 */

import OpenAI from 'openai';
import type { TestCase, EvalResult } from './types';
import type { ModeId } from '../electron/shared/types';

const EVAL_SYSTEM_PROMPT = `Du bist ein strenger aber fairer Evaluator für einen Voice-to-Text Assistenten namens VoxNote.

Deine Aufgabe ist es, die Qualität der generierten Outputs zu bewerten.

BEWERTUNGSKRITERIEN (0-100 Punkte):

1. ACCURACY (Genauigkeit)
   - Wurden alle wichtigen Informationen aus dem Input erfasst?
   - Gibt es Halluzinationen (erfundene Inhalte)?
   - Sind Namen, Zahlen, Daten korrekt?

2. COMPLETENESS (Vollständigkeit)
   - Fehlen wichtige Details?
   - Wurde der Kontext richtig verstanden?

3. STRUCTURE (Struktur)
   - Passt das Format zum Modus (Meeting → Zusammenfassung, Tasks → Checkboxen, etc.)?
   - Ist der Output gut gegliedert?
   - Markdown korrekt verwendet?

4. TONE (Tonalität)
   - Email → professionell
   - DevNote → technisch
   - Tasks → actionable
   - Clean → neutral, keine Füllwörter

5. ACTIONABILITY (Handlungsfähigkeit)
   - Sind nächste Schritte klar?
   - Kann der User direkt damit arbeiten?

FÜLLWÖRTER die NICHT im Output sein sollten:
- Deutsch: ähm, äh, halt, quasi, sozusagen, irgendwie, also, naja
- English: um, uh, like, you know, basically, kind of, sort of

Antworte IMMER im folgenden JSON-Format:
{
  "scores": {
    "accuracy": <0-100>,
    "completeness": <0-100>,
    "structure": <0-100>,
    "tone": <0-100>,
    "actionability": <0-100>,
    "overall": <gewichteter Durchschnitt>
  },
  "feedback": {
    "strengths": ["...", "..."],
    "weaknesses": ["...", "..."],
    "suggestions": ["...", "..."]
  },
  "passed": <true/false basierend auf overall >= threshold>,
  "reasoning": "Kurze Begründung der Bewertung"
}`;

export class Evaluator {
  private openai: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4o-mini') {
    this.openai = new OpenAI({ apiKey });
    this.model = model;
  }

  async evaluate(
    testCase: TestCase,
    output: string,
    threshold: number = 70
  ): Promise<EvalResult> {
    const userPrompt = this.buildEvalPrompt(testCase, output, threshold);

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: EVAL_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1, // Low temperature for consistent evaluation
      response_format: { type: 'json_object' },
    });

    const evalJson = JSON.parse(response.choices[0].message.content || '{}');

    return {
      testId: testCase.id,
      runId: `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      input: testCase.input,
      output: output,
      mode: testCase.mode,
      scores: evalJson.scores,
      feedback: evalJson.feedback,
      passed: evalJson.passed,
      threshold,
    };
  }

  private buildEvalPrompt(testCase: TestCase, output: string, threshold: number): string {
    const expectations = testCase.expectations;

    let prompt = `EVALUIERE DIESEN OUTPUT:

=== MODUS ===
${testCase.mode}

=== INPUT (Transkript) ===
${testCase.input}

${testCase.instruction ? `=== KONTEXT ===\n${testCase.instruction}\n` : ''}

=== OUTPUT (zu bewerten) ===
${output}

=== ERWARTUNGEN ===
`;

    if (expectations.mustInclude?.length) {
      prompt += `MUSS ENTHALTEN: ${expectations.mustInclude.join(', ')}\n`;
    }
    if (expectations.mustNotInclude?.length) {
      prompt += `DARF NICHT ENTHALTEN: ${expectations.mustNotInclude.join(', ')}\n`;
    }
    if (expectations.structure?.length) {
      prompt += `STRUKTUR: ${expectations.structure.join(', ')}\n`;
    }
    if (expectations.tone) {
      prompt += `TON: ${expectations.tone}\n`;
    }
    if (expectations.language) {
      prompt += `SPRACHE: ${expectations.language}\n`;
    }

    prompt += `
=== THRESHOLD ===
Pass-Grenze: ${threshold} Punkte (overall)
Gewichtung dieses Tests: ${testCase.weight}/10

Bewerte jetzt den Output nach den Kriterien.`;

    return prompt;
  }

  async suggestPromptImprovement(
    mode: ModeId,
    currentPrompt: string,
    failedResults: EvalResult[]
  ): Promise<string> {
    const issuesSummary = failedResults
      .map((r) => `- Score: ${r.scores.overall}, Issues: ${r.feedback.weaknesses.join(', ')}`)
      .join('\n');

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o', // Use stronger model for prompt optimization
      messages: [
        {
          role: 'system',
          content: `Du bist ein Experte für Prompt Engineering.
Analysiere die Fehler und verbessere den System-Prompt so, dass diese Fehler nicht mehr auftreten.
Behalte den Grundcharakter des Prompts bei, aber mache ihn präziser.`,
        },
        {
          role: 'user',
          content: `MODUS: ${mode}

AKTUELLER PROMPT:
${currentPrompt}

HÄUFIGE FEHLER (aus ${failedResults.length} fehlgeschlagenen Tests):
${issuesSummary}

HÄUFIGSTE PROBLEME:
${this.extractCommonIssues(failedResults).join('\n')}

Erstelle einen VERBESSERTEN Prompt der diese Probleme löst.
Antworte NUR mit dem neuen Prompt, keine Erklärungen.`,
        },
      ],
      temperature: 0.7,
    });

    return response.choices[0].message.content || currentPrompt;
  }

  private extractCommonIssues(results: EvalResult[]): string[] {
    const issueCounts = new Map<string, number>();

    for (const result of results) {
      for (const weakness of result.feedback.weaknesses) {
        const normalized = weakness.toLowerCase().trim();
        issueCounts.set(normalized, (issueCounts.get(normalized) || 0) + 1);
      }
    }

    return Array.from(issueCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([issue, count]) => `- "${issue}" (${count}x)`);
  }
}

export default Evaluator;
