import type { ReviewResult, NotifyConfig, PRInfo } from './types.js';

export class Notifier {
  private configs: NotifyConfig[];

  constructor(configs: NotifyConfig[]) {
    this.configs = configs;
  }

  async notify(pr: PRInfo, result: ReviewResult): Promise<void> {
    const message = this.buildMessage(pr, result);
    await Promise.allSettled(this.configs.map(cfg => this.send(cfg, message)));
  }

  private buildMessage(pr: PRInfo, result: ReviewResult): string {
    const scoreEmoji = result.score >= 80 ? '✅' : result.score >= 60 ? '⚠️' : '❌';
    const criticals = result.issues.filter(i => i.severity === 'critical').length;
    const warnings = result.issues.filter(i => i.severity === 'warning').length;

    return [
      `${scoreEmoji} *PR Review: #${pr.number} ${pr.title}*`,
      `Repo: \`${pr.repo}\` | Author: @${pr.author}`,
      `Score: ${result.score}/100 | ${result.approved ? '✅ Approved' : '🔄 Changes Requested'}`,
      criticals > 0 ? `🚨 ${criticals} critical issue(s)` : '',
      warnings > 0 ? `⚠️ ${warnings} warning(s)` : '',
      '',
      result.summary,
      '',
      `🔗 ${pr.url}`,
    ].filter(l => l !== undefined).join('\n');
  }

  private async send(cfg: NotifyConfig, message: string): Promise<void> {
    switch (cfg.channel) {
      case 'slack':
        await this.sendSlack(cfg.webhookUrl!, message);
        break;
      case 'discord':
        await this.sendDiscord(cfg.webhookUrl!, message);
        break;
      case 'telegram':
        await this.sendTelegram(cfg.botToken!, cfg.chatId!, message);
        break;
      case 'feishu':
        await this.sendFeishu(cfg.webhookUrl!, message);
        break;
    }
  }

  private async sendSlack(webhookUrl: string, text: string): Promise<void> {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  }

  private async sendDiscord(webhookUrl: string, content: string): Promise<void> {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
  }

  private async sendTelegram(botToken: string, chatId: string, text: string): Promise<void> {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
  }

  private async sendFeishu(webhookUrl: string, text: string): Promise<void> {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg_type: 'text', content: { text } }),
    });
  }
}
