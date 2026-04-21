# OpenClaw Code Review Bot

AI-powered GitHub PR reviewer that automatically analyzes pull requests and pushes review summaries to messaging channels.

## Architecture

```
GitHub Webhook / Poll → PRReviewer (AI) → GitHub Comment + Notifier → Slack/Discord/Telegram/Feishu
```

- `src/index.ts` — CLI entry, polling loop, GitHub API calls
- `src/reviewer.ts` — AI review logic, diff analysis, comment formatting
- `src/notifier.ts` — Multi-channel notification dispatch
- `src/types.ts` — Shared type definitions

## Setup

### 1. Build

```bash
npm install
npm run build
```

### 2. Config

Create `~/.config/openclaw-review-bot/config.json`:

```json
{
  "github": {
    "token": "ghp_...",
    "repos": ["owner/repo1", "owner/repo2"],
    "pollIntervalMs": 60000
  },
  "ai": {
    "model": "gpt-4o",
    "apiKey": "sk-...",
    "baseUrl": "https://api.openai.com/v1"
  },
  "notify": [
    {
      "channel": "slack",
      "webhookUrl": "https://hooks.slack.com/services/..."
    },
    {
      "channel": "discord",
      "webhookUrl": "https://discord.com/api/webhooks/..."
    },
    {
      "channel": "telegram",
      "botToken": "...",
      "chatId": "-100..."
    },
    {
      "channel": "feishu",
      "webhookUrl": "https://open.feishu.cn/open-apis/bot/v2/hook/..."
    }
  ]
}
```

### 3. Run

```bash
# With default config path
node dist/index.js

# With custom config
node dist/index.js /path/to/config.json

# Or install globally
npm install -g .
openclaw-review-bot
```

## How It Works

1. Polls GitHub for open PRs on configured repos every `pollIntervalMs`
2. Skips already-reviewed PRs (in-memory dedup per session)
3. Sends PR diff to AI model for analysis
4. Posts structured review comment on the PR
5. Pushes summary notification to all configured channels

## Review Output

Each review includes:
- Score (0–100)
- Approval recommendation
- Critical issues (bugs, security, breaking changes)
- Warnings (code quality, performance)
- Improvement suggestions

## Requirements

- Node.js >= 20
- GitHub token with `repo` scope
- OpenAI-compatible API key (or any model with `/chat/completions` endpoint)
- At least one notification channel configured
