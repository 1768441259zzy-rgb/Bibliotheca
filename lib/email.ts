import nodemailer from 'nodemailer';
import type { Message } from '@/lib/messages';

function getMailConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const to = process.env.NOTIFY_EMAIL?.trim() || user;

  if (!host || !user || !pass || !to) return null;

  return {
    host,
    port,
    secure: port === 465,
    user,
    pass,
    to,
    from: process.env.SMTP_FROM?.trim() || `Bibliotheca <${user}>`,
  };
}

export async function sendMessageNotification(
  message: Message
): Promise<{ sent: boolean; reason?: string }> {
  const config = getMailConfig();
  if (!config) {
    return {
      sent: false,
      reason: '邮件未配置：请在 .env.local 填写 SMTP 信息',
    };
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  const when = new Date(message.createdAt).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
  });

  const text = [
    'Bibliotheca 收到一条新留言',
    '',
    `姓名：${message.name}`,
    `联系方式：${message.contact || '（未填写）'}`,
    `藏书印：${message.stamp || '（无）'}`,
    `时间：${when}`,
    '',
    '内容：',
    message.content,
  ].join('\n');

  const html = `
    <div style="font-family:Georgia,serif;color:#3d2f2a;line-height:1.7;max-width:560px">
      <h2 style="font-weight:400;letter-spacing:0.08em;margin:0 0 12px">Bibliotheca · 新留言</h2>
      <p style="margin:0 0 8px"><strong>姓名：</strong>${escapeHtml(message.name)}</p>
      <p style="margin:0 0 8px"><strong>联系方式：</strong>${escapeHtml(message.contact || '（未填写）')}</p>
      <p style="margin:0 0 8px"><strong>藏书印：</strong><span style="font-size:1.25em">${escapeHtml(message.stamp || '—')}</span></p>
      <p style="margin:0 0 16px"><strong>时间：</strong>${escapeHtml(when)}</p>
      <div style="border-left:3px solid #c9a84c;padding:8px 14px;background:#fdfbf7">
        ${escapeHtml(message.content).replace(/\n/g, '<br/>')}
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: config.from,
    to: config.to,
    subject: `【Bibliotheca】新留言 · ${message.name}`,
    text,
    html,
    replyTo: message.contact || undefined,
  });

  return { sent: true };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
