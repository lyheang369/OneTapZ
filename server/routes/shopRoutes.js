import crypto from 'crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createKhqrPayment, checkKhqrStatus } from '../utils/camrapidpay.js';
import { sendTelegramMessage, verifyTelegramLoginPayload } from '../utils/telegram.js';
import { getJwtSecret } from '../utils/token.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = express.Router();

// Checkout creates an Order + calls the payment gateway; throttle to curb spam.
const checkoutLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 20 });

// The catalog IS the set of card designs — one product per design (slug = the
// design's template id). Seeded into the DB-backed catalog so a fresh deploy has
// something to sell; prices/availability are editable from the admin dashboard.
const DESIGN_PRODUCTS = [
  { slug: 'acid-pop', name: 'UV DTF Sticker design with NFC Card', description: 'UV DTF sticker design printed on an NFC card — bold 3D type with star & heart art.', price: 2.5, discountPrice: 0, active: true, sort: 0 },
  { slug: 'mono', name: 'Blank NFC card', description: 'Plain NFC card — no printed design.', price: 1, discountPrice: 0, active: true, sort: 1 },
];

// Flat fee added to the order total when the buyer chooses delivery (pickup is free).
export const DELIVERY_FEE = 1.5;

// Charged price: the discount when set and below full price, else full price.
export function effectivePrice(p) {
  return p.discountPrice > 0 && p.discountPrice < p.price ? p.discountPrice : p.price;
}

// Ensure the design products exist (insert missing ones without clobbering admin
// edits) and retire the legacy single product. Runs once per warm instance.
let catalogEnsured = false;
async function ensureCatalog() {
  if (catalogEnsured) return;
  for (const p of DESIGN_PRODUCTS) {
    await Product.updateOne({ slug: p.slug }, { $setOnInsert: p }, { upsert: true }).catch(() => {});
  }
  await Product.deleteOne({ slug: 'nfc-card' }).catch(() => {});
  catalogEnsured = true;
}

export async function getActiveProducts() {
  await ensureCatalog();
  return Product.find({ active: true }).sort('sort');
}

function productView(p) {
  return {
    id: p.slug,
    name: p.name,
    description: p.description,
    price: p.price,
    discountPrice: p.discountPrice || 0,
    effectivePrice: effectivePrice(p),
  };
}

// Map raw {productId, qty} entries onto the authoritative DB catalog (qty clamped
// 1..99, prices read from the DB at the effective/discounted rate, never the
// caller). Shared by the web checkout and the Telegram /buy command.
export async function resolveLineItems(items = []) {
  const slugs = [...new Set((items || []).map((i) => i?.productId).filter((s) => typeof s === 'string'))];
  if (slugs.length === 0) return [];
  const products = await Product.find({ slug: { $in: slugs }, active: true });
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const lineItems = [];
  for (const item of items) {
    const product = bySlug.get(item?.productId);
    const qty = Math.floor(Number(item?.qty) || 0);
    if (product && qty > 0) {
      lineItems.push({ productId: product.slug, name: product.name, price: effectivePrice(product), qty: Math.min(qty, 99) });
    }
  }
  return lineItems;
}

// Coerce an untrusted cardDesign payload to a flat string record (req.body
// reaches Mongoose, so never store it raw — strip non-strings, cap length).
function sanitizeCardDesign(cd) {
  if (!cd || typeof cd !== 'object') return undefined;
  const s = (v) => (typeof v === 'string' ? v.slice(0, 300) : '');
  return {
    template: s(cd.template),
    name: s(cd.name),
    tagline: s(cd.tagline),
    handle: s(cd.handle),
    phone: s(cd.phone),
    email: s(cd.email),
    profileUrl: s(cd.profileUrl),
  };
}

// Coerce an untrusted delivery payload; whitelist enums, cap free text.
function sanitizeDelivery(d) {
  if (!d || typeof d !== 'object') return undefined;
  const method = d.method === 'delivery' ? 'delivery' : 'pickup';
  if (method === 'pickup') return { method, area: '', courier: '', address: '' };
  const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  return {
    method,
    area: d.area === 'province' ? 'province' : 'phnom-penh',
    courier: d.area === 'province' ? str(d.courier, 40) : '',
    address: str(d.address, 400),
  };
}

// Create a pending Order + its KHQR payment, returning the invoice essentials.
// Used by both the web checkout and the bot's /buy command. The reference is an
// unauthenticated bearer capability for the public invoice, so the random part
// stays 16 bytes (128 bits) of CSPRNG output.
export async function createShopOrder({ lineItems, telegramId, telegramUsername = '', name = '', phone = '', cardDesign = null, delivery = null }) {
  const dv = sanitizeDelivery(delivery);
  const fee = dv?.method === 'delivery' ? DELIVERY_FEE : 0;
  const itemsTotal = lineItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  const amount = Math.round((itemsTotal + fee) * 100) / 100;
  const reference = `SHOP-${Date.now()}-${crypto.randomBytes(16).toString('hex')}`;
  await Order.create({
    reference,
    items: lineItems,
    amount,
    customer: { name, phone },
    telegramId,
    telegramUsername,
    cardDesign: sanitizeCardDesign(cardDesign),
    delivery: dv ? { ...dv, fee } : undefined,
    status: 'pending',
  });
  const base = process.env.PUBLIC_BASE_URL || process.env.CLIENT_URL || 'https://onetapz.me';
  const payment = await createKhqrPayment({ amount, reference, webhookUrl: `${base}/api/shop/webhook` });
  return { reference, amount, qrCode: payment.qr_code, paymentUrl: payment.payment_url, expiresIn: payment.expires_in };
}

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

router.get(
  '/products',
  asyncHandler(async (_req, res) => {
    const products = await getActiveProducts();
    res.json({ products: products.map(productView) });
  }),
);

router.post(
  '/checkout',
  checkoutLimiter,
  asyncHandler(async (req, res) => {
    const { items = [], customer = {}, telegram, cardDesign } = req.body;

    const lineItems = await resolveLineItems(items);
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

    const order = await createShopOrder({
      lineItems,
      telegramId,
      telegramUsername,
      name,
      phone: String(customer.phone || '').trim(),
      cardDesign,
      delivery: req.body.delivery,
    });
    res.status(201).json(order);
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

  const dv = order.delivery;
  const fulfilment =
    dv?.method === 'delivery'
      ? "We'll deliver to your address once it's printed."
      : 'Pick it up at our CamTech campus when ready.';

  if (order.telegramId) {
    const buyerMsg =
      `✅ <b>Order confirmed</b>\n\n${lines}\n\n<b>Total: $${order.amount.toFixed(2)}</b>\n` +
      `Ref: <code>${ref}</code>\n\nThanks for ordering with OneTapZ! Your card is customized & printed in ` +
      `3–5 working days. ${fulfilment}`;
    await sendTelegramMessage(order.telegramId, buyerMsg);
  }

  const admins = await User.find({ role: 'admin', telegramId: { $nin: ['', null] } }).select('telegramId');
  const buyer = esc(order.customer?.name || order.telegramUsername || order.telegramId);
  const handle = order.telegramUsername ? ` (@${esc(order.telegramUsername)})` : '';
  const phone = order.customer?.phone ? `Phone: ${esc(order.customer.phone)}\n` : '';

  // Card design block so the fulfiller has everything to print the card.
  const cd = order.cardDesign;
  let designBlock = '';
  if (cd && (cd.name || cd.tagline || cd.handle || cd.phone || cd.email)) {
    const rows = [
      cd.template && `Template: ${esc(cd.template)}`,
      cd.name && `Name: ${esc(cd.name)}`,
      cd.tagline && `Tagline: ${esc(cd.tagline)}`,
      cd.handle && `Handle: @${esc(cd.handle)}`,
      cd.phone && `Phone: ${esc(cd.phone)}`,
      cd.email && `Email: ${esc(cd.email)}`,
      cd.profileUrl && `Profile: ${esc(cd.profileUrl)}`,
    ].filter(Boolean).join('\n');
    designBlock = `\n\n🎨 <b>Card design</b>\n${rows}`;
  }

  // Fulfillment block so the admin knows pickup vs where to ship.
  let deliveryBlock = '';
  if (dv?.method === 'delivery') {
    const area = dv.area === 'province' ? `Province${dv.courier ? ` · ${esc(dv.courier)}` : ''}` : 'Phnom Penh';
    const feeLine = dv.fee ? `\nFee: $${dv.fee.toFixed(2)}` : '';
    deliveryBlock = `\n\n🚚 <b>Delivery</b>\n${area}${dv.address ? `\n${esc(dv.address)}` : ''}${feeLine}`;
  } else {
    deliveryBlock = `\n\n🚚 <b>Pickup</b>\nCamTech campus`;
  }

  const adminMsg =
    `🛒 <b>New paid order</b>\n\nBuyer: ${buyer}${handle}\n` +
    `${phone}${lines}\n<b>$${order.amount.toFixed(2)}</b>\n` +
    `Ref: <code>${ref}</code>${deliveryBlock}${designBlock}`;
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
