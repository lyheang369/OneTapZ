import 'dotenv/config';

// One-time setup: register the webhook URL (+ secret) and the bot's command menu
// with Telegram. Telegram requires an HTTPS URL, so run this with the PRODUCTION
// env (PUBLIC_BASE_URL=https://onetapz.me) — it cannot point at localhost.
const token = process.env.TELEGRAM_BOT_TOKEN;
const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!token || !base || !secret) {
  console.error(
    'Missing env. Need TELEGRAM_BOT_TOKEN, PUBLIC_BASE_URL (https), TELEGRAM_WEBHOOK_SECRET.',
  );
  process.exit(1);
}
if (!base.startsWith('https://')) {
  console.error(`PUBLIC_BASE_URL must be https for a Telegram webhook (got: ${base}).`);
  process.exit(1);
}

const api = (method) => `https://api.telegram.org/bot${token}/${method}`;

async function main() {
  const webhookUrl = `${base}/api/telegram/webhook`;

  const setWebhook = await fetch(api('setWebhook'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ['message'],
    }),
  }).then((r) => r.json());
  console.log('setWebhook →', setWebhook);

  const setMyCommands = await fetch(api('setMyCommands'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commands: [
        { command: 'shop', description: 'Browse & order NFC cards' },
        { command: 'myprofile', description: 'Your public link + QR' },
        { command: 'stats', description: 'Your profile views & link clicks' },
        { command: 'addlink', description: 'Add a link: /addlink <url> [title]' },
        { command: 'help', description: 'Show available commands' },
      ],
    }),
  }).then((r) => r.json());
  console.log('setMyCommands →', setMyCommands);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
