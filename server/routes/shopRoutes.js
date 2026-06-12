import crypto from 'crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import Order from '../models/Order.js';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createKhqrPayment, checkKhqrStatus } from '../utils/camrapidpay.js';
import { sendTelegramMessage, verifyTelegramLoginPayload } from '../utils/telegram.js';
import { getJwtSecret } from '../utils/token.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = express.Router();

// Checkout creates an Order + calls the payment gateway; throttle to curb spam.
const checkoutLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 20 });

// Authoritative product catalog — prices live here, never trusted from the client.
const PRODUCTS = {
  'nfc-normal': { id: 'nfc-normal', name: 'NFC Name Card', price: 2.0 },
  'nfc-uv': { id: 'nfc-uv', name: 'UV Printed NFC Card', price: 2.5 },
};

// Resolve the logged-in API user from a Bearer token, if present. Returns null
// for anonymous / local-only / demo sessions.
async function getOptionalUser(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  if (!token || token === 'demo-token' || token.startsWith('local:')) return null;
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    return await User.findById(decoded.id);
  } catch {
    return null;
  }
}

router.get('/products', (_req, res) => {
  res.json({ products: Object.values(PRODUCTS) });
});

router.post(
  '/checkout',
  checkoutLimiter,
  asyncHandler(async (req, res) => {
    const { items = [], customer = {}, telegram } = req.body;

    const lineItems = [];
    for (const item of items) {
      const product = PRODUCTS[item?.productId];
      const qty = Math.floor(Number(item?.qty) || 0);
      if (product && qty > 0) {
        lineItems.push({ productId: product.id, name: product.name, price: product.price, qty: Math.min(qty, 99) });
      }
    }
    if (lineItems.length === 0) {
      return res.status(400).json({ message: 'Your cart is empty.' });
    }

    // Identify the buyer's Telegram: a logged-in Telegram session, or a verified
    // Telegram Login Widget payload from an anonymous visitor.
    let telegramId = '';
    let telegramUsername = '';
    let name = String(customer.name || '').trim();

    const sessionUser = await getOptionalUser(req);
    if (sessionUser?.telegramId) {
      telegramId = sessionUser.telegramId;
      name = name || sessionUser.name || '';
    } else if (telegram) {
      const tg = verifyTelegramLoginPayload(telegram);
      telegramId = String(tg.id);
      telegramUsername = tg.username || '';
      name = name || `${tg.first_name || ''} ${tg.last_name || ''}`.trim();
    } else {
      return res.status(400).json({ message: 'Connect your Telegram to continue.' });
    }

    const amount = Math.round(lineItems.reduce((sum, i) => sum + i.price * i.qty, 0) * 100) / 100;
    const reference = `SHOP-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    await Order.create({
      reference,
      items: lineItems,
      amount,
      customer: { name, phone: String(customer.phone || '').trim() },
      telegramId,
      telegramUsername,
      status: 'pending',
    });

    const base = process.env.PUBLIC_BASE_URL || process.env.CLIENT_URL || 'https://onetapz.me';
    const payment = await createKhqrPayment({ amount, reference, webhookUrl: `${base}/api/shop/webhook` });

    res.status(201).json({
      reference,
      amount,
      qrCode: payment.qr_code,
      paymentUrl: payment.payment_url,
      expiresIn: payment.expires_in,
    });
  }),
);

// Escape user-controlled text for Telegram HTML parse mode (prevents markup /
// phishing injection in the buyer/admin notifications).
function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Notify the buyer (and admins) over Telegram once an order is paid.
async function notifyOrderPaid(order) {
  const lines = order.items.map((i) => `• ${esc(i.name)} ×${i.qty} — $${(i.price * i.qty).toFixed(2)}`).join('\n');
  const ref = esc(order.reference);

  if (order.telegramId) {
    const buyerMsg =
      `✅ <b>Order confirmed</b>\n\n${lines}\n\n<b>Total: $${order.amount.toFixed(2)}</b>\n` +
      `Ref: <code>${ref}</code>\n\nThanks for ordering with OneTapZ! Reply here and we'll arrange delivery.`;
    await sendTelegramMessage(order.telegramId, buyerMsg);
  }

  const admins = await User.find({ role: 'admin', telegramId: { $nin: ['', null] } }).select('telegramId');
  const buyer = esc(order.customer?.name || order.telegramUsername || order.telegramId);
  const handle = order.telegramUsername ? ` (@${esc(order.telegramUsername)})` : '';
  const phone = order.customer?.phone ? `Phone: ${esc(order.customer.phone)}\n` : '';
  const adminMsg =
    `🛒 <b>New paid order</b>\n\nBuyer: ${buyer}${handle}\n` +
    `${phone}${lines}\n<b>$${order.amount.toFixed(2)}</b>\n` +
    `Ref: <code>${ref}</code>`;
  for (const admin of admins) {
    await sendTelegramMessage(admin.telegramId, adminMsg);
  }
}

// Mark an order paid only after CamRapidPay confirms server-to-server. The
// status transition is atomic so the buyer/admin are notified exactly once,
// even if the webhook and the status poll race.
async function settleIfPaid(reference) {
  const order = await Order.findOne({ reference });
  if (!order) return null;
  if (order.status === 'paid') return order;

  const result = await checkKhqrStatus(reference);
  const status = String(result.status || '').toLowerCase();

  if (status === 'success') {
    const updated = await Order.findOneAndUpdate(
      { reference, status: { $ne: 'paid' } },
      { status: 'paid', paidAt: new Date() },
      { new: true },
    );
    if (updated) {
      await notifyOrderPaid(updated);
      return updated;
    }
    return Order.findOne({ reference });
  }

  if (status === 'expired') {
    order.status = 'expired';
    await order.save();
  }
  return order;
}

router.get(
  '/status',
  asyncHandler(async (req, res) => {
    const order = await settleIfPaid(String(req.query.reference || ''));
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    res.json({ status: order.status });
  }),
);

// Public invoice lookup by reference (settles status on view). Returns only
// invoice-safe fields — no phone or Telegram id.
router.get(
  '/order/:reference',
  asyncHandler(async (req, res) => {
    const order = await settleIfPaid(String(req.params.reference || ''));
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    res.json({
      order: {
        reference: order.reference,
        items: order.items,
        amount: order.amount,
        currency: order.currency,
        status: order.status,
        fulfilled: order.fulfilled,
        customerName: order.customer?.name || '',
        createdAt: order.createdAt,
        paidAt: order.paidAt,
      },
    });
  }),
);

router.post(
  '/webhook',
  asyncHandler(async (req, res) => {
    const reference = req.body?.reference;
    if (reference) {
      settleIfPaid(String(reference)).catch(() => {});
    }
    res.json({ received: true });
  }),
);

export default router;
