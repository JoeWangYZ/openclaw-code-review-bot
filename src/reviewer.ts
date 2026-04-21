import type { PRInfo, ReviewResult, ReviewIssue } from './types.js';

const REVIEW_PROMPT = `You are a senior software engineer performing a code review.
Analyze the following PR diff and provide:
1. A concise summary (2-3 sentences)
2. Critical issues (bugs, security, breaking changes)
3. Warnings (code quality, performance, style)
4. Suggestions for improvement
5. An overall score (0-100) and approval recommendation

Respond in JSON format matching this schema:
{
  "summary": "string",
  "issues": [{"severity": "critical|warning|info", "file": "string?", "line": number?, "message": "string"}],
  "suggestions": ["string"],
  "score": number,
  "approved": boolean
}`;

export class PRReviewer {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(apiKey: string, model = 'gpt-4o', baseUrl = 'https://api.openai.com/v1') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl;
  }

  async review(pr: PRInfo): Promise<ReviewResult> {
    const diffSummary = this.buildDiffSummary(pr);
    const prompt = `PR #${pr.number}: ${pr.title}\nAuthor: ${pr.author}\nRepo: ${pr.repo}\n\n${diffSummary}`;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: REVIEW_PROMPT },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    const content = data.choices[0].message.content;
    return JSON.parse(content) as ReviewResult;
  }

  private buildDiffSummary(pr: PRInfo): string {
    const fileList = pr.files
      .map(f => `  ${f.status}: ${f.filename} (+${f.additions}/-${f.deletions})`)
      .join('\n');

    // Truncate diff to avoid token limits
    const diff = pr.diff.length > 8000 ? pr.diff.slice(0, 8000) + '\n... (truncated)' : pr.diff;

    return `Changed files:\n${fileList}\n\nDiff:\n\`\`\`diff\n${diff}\n\`\`\``;
  }

  formatReviewComment(result: ReviewResult): string {
    const scoreEmoji = result.score >= 80 ? '✅' : result.score >= 60 ? '⚠️' : '❌';
    const lines: string[] = [
      `## 🤖 AI Code Review ${scoreEmoji}`,
      '',
      `**Score:** ${result.score}/100 | **Decision:** ${result.approved ? '✅ Approved' : '🔄 Changes Requested'}`,
      '',
      `### Summary`,
      result.summary,
    ];

    const criticals = result.issues.filter(i => i.severity === 'critical');
    const warnings = result.issues.filter(i => i.severity === 'warning');

    if (criticals.length > 0) {
      lines.push('', '### 🚨 Critical Issues');
      criticals.forEach(i => lines.push(`- ${i.file ? `\`${i.file}\`` : ''} ${i.message}`));
    }

    if (warnings.length > 0) {
      lines.push('', '### ⚠️ Warnings');
      warnings.forEach(i => lines.push(`- ${i.message}`));
    }

    if (result.suggestions.length > 0) {
      lines.push('', '### 💡 Suggestions');
      result.suggestions.forEach(s => lines.push(`- ${s}`));
    }

    lines.push('', '*Powered by OpenClaw Code Review Bot*');
    return lines.join('\n');
  }
}
