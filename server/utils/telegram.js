import crypto from 'crypto';

// Verify a Telegram Login Widget payload (HMAC over SHA256(bot_token)).
// Returns the payload on success; throws with a status code otherwise.
export function verifyTelegramLoginPayload(payload) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    const error = new Error('Telegram is not configured.');
    error.status = 501;
    throw error;
  }
  const { hash, ...data } = payload || {};
  if (!hash) {
    const error = new Error('Telegram payload is missing a hash.');
    error.status = 400;
    throw error;
  }

  const checkString = Object.keys(data)
    .sort()
    .map((key) => `${key}=${data[key]}`)
    .join('\n');
  const secret = crypto.createHash('sha256').update(botToken).digest();
  const expected = crypto.createHmac('sha256', secret).update(checkString).digest('hex');

  if (expected.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hash))) {
    const error = new Error('Telegram verification failed.');
    error.status = 401;
    throw error;
  }

  const authDate = Number(payload.auth_date || 0) * 1000;
  if (!authDate || Date.now() - authDate > 24 * 60 * 60 * 1000) {
    const error = new Error('Telegram session expired.');
    error.status = 401;
    throw error;
  }
  return payload;
}

// Send a bot message to a Telegram chat (the user's telegramId). Best-effort.
export async function sendTelegramMessage(chatId, text) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || !chatId) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: String(chatId), text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    if (!res.ok) {
      // Most common: 403 "bot can't initiate conversation with a user" — the
      // recipient hasn't started @onetapzbot yet.
      const body = await res.text().catch(() => '');
      console.error('Telegram sendMessage failed', res.status, body);
    }
  } catch (err) {
    console.error('Telegram sendMessage error', err?.message);
  }
}

// HTML-escape user-controlled text before interpolating into a parse_mode:'HTML'
// message. Mirrors the esc() guard used for order-notification DMs.
export function htmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Send a photo (e.g. a QR PNG buffer) to a Telegram chat. Best-effort, mirrors
// sendTelegramMessage's error handling. Uses multipart upload via global
// FormData/Blob (native on Node 18+).
export async function sendTelegramPhoto(chatId, photoBuffer, caption) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || !chatId) return;
  try {
    const form = new FormData();
    form.append('chat_id', String(chatId));
    if (caption) {
      form.append('caption', caption);
      form.append('parse_mode', 'HTML');
    }
    form.append('photo', new Blob([photoBuffer], { type: 'image/png' }), 'profile-qr.png');
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('Telegram sendPhoto failed', res.status, body);
    }
  } catch (err) {
    console.error('Telegram sendPhoto error', err?.message);
  }
}
