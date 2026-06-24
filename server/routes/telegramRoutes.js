import express from 'express';
import crypto from 'crypto';
import QRCode from 'qrcode';
import User from '../models/User.js';
import Link from '../models/Link.js';
import Analytics from '../models/Analytics.js';
import { sendTelegramMessage, sendTelegramPhoto, htmlEscape as esc } from '../utils/telegram.js';
import { checkUrl } from '../utils/urlFilter.js';
import { getActiveProducts, effectivePrice, resolveLineItems, createShopOrder } from './shopRoutes.js';

const router = express.Router();

function profileBase() {
  return (process.env.PUBLIC_BASE_URL || 'https://onetapz.me').replace(/\/$/, '');
}

// Telegram echoes the secret_token set via setWebhook in this header on every
// call. Without a matching secret, anyone who learns the URL could POST forged
// updates — so reject mismatches with a constant-time compare.
function verifySecret(req) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET || '';
  const got = req.get('X-Telegram-Bot-Api-Secret-Token') || '';
  if (!expected) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const HELP = [
  '<b>OneTapZ bot</b>',
  '',
  '/shop — browse &amp; order NFC cards',
  '/myprofile — your public link + QR',
  '/stats — your profile views &amp; link clicks',
  '/addlink &lt;url&gt; [title] — add a link to your profile',
  '/help — show this message',
].join('\n');

// List the catalog with the /buy command for each. Open to everyone — buying a
// card doesn't require a OneTapZ account.
async function cmdShop(chatId) {
  const products = await getActiveProducts();
  if (products.length === 0) {
    await sendTelegramMessage(chatId, 'The shop is empty right now — check back soon.');
    return;
  }
  const lines = ['<b>🛒 OneTapZ Shop</b>', ''];
  for (const p of products) {
    const eff = effectivePrice(p);
    const price = eff < p.price ? `$${eff.toFixed(2)} <s>$${p.price.toFixed(2)}</s>` : `$${p.price.toFixed(2)}`;
    lines.push(`• <b>${esc(p.name)}</b> — ${price}`);
    lines.push(`   order: <code>/buy ${esc(p.slug)}</code>`);
  }
  lines.push('', 'Add a quantity too, e.g. <code>/buy nfc-card 2</code>.');
  lines.push('Pay the KHQR with any Bakong-enabled banking app.');
  await sendTelegramMessage(chatId, lines.join('\n'));
}

// /buy <productId> [qty] — create the order, send the KHQR to scan. The paid
// confirmation arrives later via the shop webhook (settleIfPaid -> notify).
async function cmdBuy(args, chatId, telegramId, username) {
  const parts = args.trim().split(/\s+/).filter(Boolean);
  const productId = (parts[0] || '').toLowerCase();
  const qty = Math.min(Math.max(Math.floor(Number(parts[1]) || 1), 1), 99);

  const lineItems = await resolveLineItems([{ productId, qty }]);
  if (lineItems.length === 0) {
    await sendTelegramMessage(chatId, 'Usage: <code>/buy &lt;product&gt; [qty]</code>\nSee /shop for the product list.');
    return;
  }

  let order;
  try {
    order = await createShopOrder({
      lineItems,
      telegramId: String(telegramId),
      telegramUsername: username || '',
    });
  } catch (err) {
    const msg = err?.status === 501 ? 'Payments are not available right now.' : 'Could not create your order — please try again.';
    await sendTelegramMessage(chatId, msg);
    return;
  }

  const item = lineItems[0];
  const caption = [
    `🛒 <b>${esc(item.name)}</b> ×${qty}`,
    `<b>Total: $${order.amount.toFixed(2)}</b>`,
    `Ref: <code>${esc(order.reference)}</code>`,
    '',
    'Scan this KHQR with any Bakong app to pay.',
    `Invoice: ${profileBase()}/order/${esc(order.reference)}`,
    "You'll get a confirmation here once payment is received.",
  ].join('\n');

  try {
    const png = await QRCode.toBuffer(order.qrCode, { width: 512, margin: 2 });
    await sendTelegramPhoto(chatId, png, caption);
  } catch (err) {
    console.error('Telegram KHQR render failed', err?.message);
    await sendTelegramMessage(chatId, `${caption}\n\nKHQR string:\n<code>${esc(order.qrCode)}</code>`);
  }
}

async function cmdMyProfile(user, chatId) {
  const url = `${profileBase()}/${user.username}`;
  try {
    const png = await QRCode.toBuffer(url, { width: 512, margin: 2 });
    await sendTelegramPhoto(chatId, png, `Your OneTapZ profile:\n${esc(url)}`);
  } catch (err) {
    console.error('Telegram QR generation failed', err?.message);
    await sendTelegramMessage(chatId, `Your OneTapZ profile:\n${esc(url)}`);
  }
}

async function cmdStats(user, chatId) {
  const analytics = await Analytics.findOne({ userId: user._id });
  const top = await Link.findOne({ userId: user._id }).sort('-clickCount');
  const lines = [
    `<b>Stats for @${esc(user.username)}</b>`,
    `👁 Profile views: ${analytics?.profileViews ?? 0}`,
    `🔗 Link clicks: ${analytics?.linkClicks ?? 0}`,
  ];
  if (top) lines.push(`⭐ Top link: ${esc(top.title)} (${top.clickCount} clicks)`);
  await sendTelegramMessage(chatId, lines.join('\n'));
}

async function cmdAddLink(user, args, chatId) {
  const text = args.trim();
  if (!text) {
    await sendTelegramMessage(chatId, 'Usage: /addlink &lt;url&gt; [title]');
    return;
  }
  const [rawUrl, ...rest] = text.split(/\s+/);
  const check = checkUrl(rawUrl);
  if (!check.ok) {
    await sendTelegramMessage(chatId, esc(check.reason));
    return;
  }
  // checkUrl accepts schemeless input; normalize the stored value the same way.
  const url = /^[a-z][a-z0-9+.-]*:/i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  let title = rest.join(' ').trim();
  if (!title) {
    try {
      title = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      title = url;
    }
  }
  title = title.slice(0, 100).trim();
  const count = await Link.countDocuments({ userId: user._id });
  await Link.create({
    userId: user._id,
    title,
    url,
    icon: 'link',
    order: count,
    isActive: true,
    display: 'button',
  });
  await sendTelegramMessage(chatId, `✅ Added <b>${esc(title)}</b> to your profile.`);
}

async function handleUpdate(update) {
  const message = update?.message;
  const chatId = message?.chat?.id;
  const fromId = message?.from?.id;
  const text = (message?.text || '').trim();
  if (!chatId || !fromId || !text.startsWith('/')) return;

  const [token] = text.split(/\s+/);
  const command = token.replace(/@.*$/, '').toLowerCase(); // strip @botname suffix
  const args = text.slice(token.length); // everything after the command token

  const user = await User.findOne({ telegramId: String(fromId) });

  if (command === '/start' || command === '/help') {
    const greeting = user ? `Hi ${esc(user.name || user.username)}!\n\n` : '';
    await sendTelegramMessage(chatId, greeting + HELP);
    return;
  }

  // Shop is open to everyone — no OneTapZ account required to buy a card.
  if (command === '/shop') {
    await cmdShop(chatId);
    return;
  }
  if (command === '/buy') {
    await cmdBuy(args, chatId, fromId, message.from?.username);
    return;
  }

  if (!user) {
    await sendTelegramMessage(
      chatId,
      'Open OneTapZ inside Telegram (or log in with Telegram on onetapz.me) to link your account, then try again.',
    );
    return;
  }

  switch (command) {
    case '/myprofile':
      await cmdMyProfile(user, chatId);
      break;
    case '/stats':
      await cmdStats(user, chatId);
      break;
    case '/addlink':
      await cmdAddLink(user, args, chatId);
      break;
    default:
      await sendTelegramMessage(chatId, HELP);
  }
}

// Telegram POSTs each update here. We authenticate, then process the update
// BEFORE responding 200 — on serverless, work after res.end() may not run. Any
// handler error is logged and swallowed so we still return 200 (a non-2xx makes
// Telegram redeliver the same update on a backoff).
router.post('/webhook', async (req, res) => {
  if (!verifySecret(req)) {
    return res.status(401).json({ ok: false });
  }
  try {
    await handleUpdate(req.body);
  } catch (err) {
    console.error('Telegram webhook handler error', err?.message);
  }
  res.json({ ok: true });
});

export default router;
