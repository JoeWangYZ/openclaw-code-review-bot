export interface PRInfo {
  number: number;
  title: string;
  body: string;
  author: string;
  repo: string;
  url: string;
  diff: string;
  files: ChangedFile[];
}

export interface ChangedFile {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  additions: number;
  deletions: number;
  patch?: string;
}

export interface ReviewResult {
  summary: string;
  issues: ReviewIssue[];
  suggestions: string[];
  score: number; // 0-100
  approved: boolean;
}

export interface ReviewIssue {
  severity: 'critical' | 'warning' | 'info';
  file?: string;
  line?: number;
  message: string;
}

export interface NotifyConfig {
  channel: 'slack' | 'discord' | 'telegram' | 'feishu';
  webhookUrl?: string;
  botToken?: string;
  chatId?: string;
}

export interface BotConfig {
  github: {
    token: string;
    repos: string[]; // e.g. ["owner/repo"]
    pollIntervalMs: number;
  };
  ai: {
    model: string;
    apiKey: string;
    baseUrl?: string;
  };
  notify: NotifyConfig[];
}
