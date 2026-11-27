const automatedSender = /^(?:no[._-]?reply|do[._-]?not[._-]?reply|notifications?|security|alerts?|mailer-daemon)(?:[+._-][a-z0-9-]+)?$/i;
const securityNotice = /security alert|security notification|critical security|unusual (?:activity|sign[ -]?in)|(?:new|suspicious) (?:sign[ -]?in|login|device)|signed in|verification code|verify (?:your (?:email|device|identity)|this device)|one[ -]time (?:password|code)|two[ -]factor|sign[ -]?in attempt|password (?:reset|changed)|reset your password|(?:new|changed|added|revoked) (?:an? )?(?:ssh key|passkey|access token)|personal access token|oauth (?:app|application|access)|[a-z ]+was granted access to your (?:account|organization)|هشدار امنیتی|کد (?:ورود|تأیید)|ورود (?:جدید|مشکوک)|بازنشانی رمز/i;
const infrastructureNotice = /^(?:(?:\[[^\]]+\]\s*)?(?:deployment|build|workflow run) (?:failed|succeeded|completed|cancelled)\b|(?:your )?(?:api|usage|rate) limit (?:reached|exceeded)\b|(?:invitation to|you(?:'ve| have) been invited to) (?:connect|install)\b|(?:app|plugin|integration) (?:connected|disconnected|installed|authorized|revoked)\b)/i;
const toolDomains = ['github.com', 'google.com', 'googlemail.com', 'openai.com', 'chatgpt.com', 'hostinger.com', 'supabase.com', 'vercel.com', 'cloudflare.com', 'zapier.com', 'make.com', 'slack.com', 'atlassian.com', 'sentry.io'];
const accountSenders = new Set(['no-reply@accounts.google.com', 'account-security@github.com', 'security@github.com']);

export function mailIntakeExclusion({ email, clientName, title }) {
  const from = String(email || '').trim().toLowerCase();
  const sender = (from.match(/<([^<>]+)>$/)?.[1] || from).trim();
  const name = String(clientName || '').normalize('NFKC').trim().replace(/^["']+|["']+$/g, '').trim().toLowerCase();
  if (sender === '30napse@gmail.com' && name === 'ai manager') return 'aiManager';

  if (accountSenders.has(sender)) return 'securityNotice';
  const address = sender.match(/^([^@\s]+)@([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/);
  if (!address || !automatedSender.test(address[1])) return null;
  const subject = String(title || '').normalize('NFKC').trim();
  if (securityNotice.test(subject)) return 'securityNotice';
  if (toolDomains.some(domain => address[2] === domain || address[2].endsWith('.' + domain)) && infrastructureNotice.test(subject)) {
    return 'toolNotification';
  }
  return null;
}
