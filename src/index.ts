#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { BotConfig, PRInfo } from './types.js';
import { PRReviewer } from './reviewer.js';
import { Notifier } from './notifier.js';

const REVIEWED_PRS_KEY = new Set<string>();

async function fetchOpenPRs(repo: string, token: string): Promise<PRInfo[]> {
  const [owner, repoName] = repo.split('/');
  const res = await fetch(`https://api.github.com/repos/${owner}/${repoName}/pulls?state=open&per_page=20`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const prs = await res.json() as any[];

  return Promise.all(prs.map(async pr => {
    const diffRes = await fetch(pr.url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.diff' },
    });
    const diff = diffRes.ok ? await diffRes.text() : '';

    const filesRes = await fetch(`${pr.url}/files`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    const files = filesRes.ok ? await filesRes.json() as any[] : [];

    return {
      number: pr.number,
      title: pr.title,
      body: pr.body ?? '',
      author: pr.user.login,
      repo,
      url: pr.html_url,
      diff,
      files: files.map(f => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch,
      })),
    } satisfies PRInfo;
  }));
}

async function postReviewComment(pr: PRInfo, comment: string, token: string): Promise<void> {
  const [owner, repo] = pr.repo.split('/');
  await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${pr.number}/comments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body: comment }),
  });
}

async function runOnce(config: BotConfig, reviewer: PRReviewer, notifier: Notifier): Promise<void> {
  for (const repo of config.github.repos) {
    try {
      const prs = await fetchOpenPRs(repo, config.github.token);
      for (const pr of prs) {
        const key = `${repo}#${pr.number}`;
        if (REVIEWED_PRS_KEY.has(key)) continue;
        REVIEWED_PRS_KEY.add(key);

        console.log(`Reviewing PR #${pr.number}: ${pr.title} (${repo})`);
        const result = await reviewer.review(pr);
        const comment = reviewer.formatReviewComment(result);

        await postReviewComment(pr, comment, config.github.token);
        await notifier.notify(pr, result);
        console.log(`  → Score: ${result.score}/100, Approved: ${result.approved}`);
      }
    } catch (err) {
      console.error(`Error processing ${repo}:`, err);
    }
  }
}

async function main(): Promise<void> {
  const configPath = process.argv[2] ?? resolve(process.env.HOME!, '.config/openclaw-review-bot/config.json');

  if (!existsSync(configPath)) {
    console.error(`Config not found: ${configPath}`);
    console.error('Create a config file. See README.md for the schema.');
    process.exit(1);
  }

  const config: BotConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
  const reviewer = new PRReviewer(config.ai.apiKey, config.ai.model, config.ai.baseUrl);
  const notifier = new Notifier(config.notify);

  console.log(`OpenClaw Code Review Bot started. Watching: ${config.github.repos.join(', ')}`);
  console.log(`Poll interval: ${config.github.pollIntervalMs}ms`);

  // Initial run
  await runOnce(config, reviewer, notifier);

  // Poll loop
  setInterval(() => runOnce(config, reviewer, notifier), config.github.pollIntervalMs);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
