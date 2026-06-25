import express from 'express';
import User from '../models/User.js';
import Link from '../models/Link.js';
import Analytics from '../models/Analytics.js';
import NfcCard from '../models/NfcCard.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { adminOnly, protect } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendTelegramMessage, htmlEscape } from '../utils/telegram.js';
import { ORDER_STAGES, stageLabel } from '../utils/orderStage.js';

const router = express.Router();

router.use(protect, adminOnly);

const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const USERNAME_RE = /^[a-z0-9_-]+$/;
const USERS_PER_PAGE = 20;

// ---- Overview stats -------------------------------------------------------

router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [totalUsers, newUsers7d, totalLinks, analyticsTotals, orderTotals] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: weekAgo } }),
      Link.countDocuments(),
      Analytics.aggregate([
        {
          $group: {
            _id: null,
            profileViews: { $sum: '$profileViews' },
            linkClicks: { $sum: '$linkClicks' },
            tapCount: { $sum: '$tapCount' },
          },
        },
      ]),
      Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: '$amount' } } }]),
    ]);

    const totals = analyticsTotals[0] ?? { profileViews: 0, linkClicks: 0, tapCount: 0 };
    const orders = { pending: 0, paid: 0, expired: 0 };
    let revenue = 0;
    for (const row of orderTotals) {
      if (row._id in orders) orders[row._id] = row.count;
      if (row._id === 'paid') revenue = row.revenue;
    }

    res.json({
      stats: {
        totalUsers,
        newUsers7d,
        totalLinks,
        profileViews: totals.profileViews,
        linkClicks: totals.linkClicks,
        tapCount: totals.tapCount,
        orders,
        revenue,
      },
    });
  }),
);

// ---- Users ----------------------------------------------------------------

router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const filter = {};

    const search = String(req.query.search ?? '').trim();
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ name: rx }, { username: rx }, { email: rx }];
    }
    if (req.query.status === 'active') filter.isActive = true;
    if (req.query.status === 'inactive') filter.isActive = false;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .sort('-createdAt')
        .skip((page - 1) * USERS_PER_PAGE)
        .limit(USERS_PER_PAGE),
      User.countDocuments(filter),
    ]);

    res.json({ users, total, page, pages: Math.max(1, Math.ceil(total / USERS_PER_PAGE)) });
  }),
);

router.put(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const isSelf = req.user.id === req.params.id;
    const updates = {};

    for (const field of ['name', 'bio', 'profileImage']) {
      if (typeof req.body[field] === 'string') updates[field] = req.body[field].trim();
    }

    if (typeof req.body.email === 'string') {
      const email = req.body.email.trim().toLowerCase();
      const taken = await User.findOne({ email, _id: { $ne: req.params.id } });
      if (taken) throw httpError(400, 'Email is already in use.');
      updates.email = email;
    }

    if (typeof req.body.username === 'string') {
      const username = req.body.username.trim().toLowerCase();
      if (!USERNAME_RE.test(username)) {
        throw httpError(400, 'Username may only contain letters, numbers, hyphens and underscores.');
      }
      const taken = await User.findOne({ username, _id: { $ne: req.params.id } });
      if (taken) throw httpError(400, 'Username is already taken.');
      updates.username = username;
    }

    if (req.body.role === 'user' || req.body.role === 'admin') {
      if (isSelf && req.body.role !== req.user.role) throw httpError(400, 'You cannot change your own role.');
      updates.role = req.body.role;
    }

    if (typeof req.body.isActive === 'boolean') {
      if (isSelf && !req.body.isActive) throw httpError(400, 'You cannot deactivate your own account.');
      updates.isActive = req.body.isActive;
    }

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).select(
      '-password',
    );
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ user });
  }),
);

router.delete(
  '/users/:id',
  asyncHandler(async (req, res) => {
    if (req.user.id === req.params.id) throw httpError(400, 'You cannot delete your own account.');

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    // Cascade: profile data goes with the account. Orders are kept for accounting.
    await Promise.all([
      Link.deleteMany({ userId: user._id }),
      Analytics.deleteOne({ userId: user._id }),
      NfcCard.deleteMany({ userId: user._id }),
    ]);

    res.json({ message: 'User and related data deleted.' });
  }),
);

// ---- Link moderation --------------------------------------------------------

router.get(
  '/users/:id/links',
  asyncHandler(async (req, res) => {
    const links = await Link.find({ userId: req.params.id }).sort('order');
    res.json({ links });
  }),
);

router.put(
  '/links/:id/status',
  asyncHandler(async (req, res) => {
    const link = await Link.findByIdAndUpdate(req.params.id, { isActive: !!req.body.isActive }, { new: true });
    if (!link) return res.status(404).json({ message: 'Link not found.' });
    res.json({ link });
  }),
);

router.delete(
  '/links/:id',
  asyncHandler(async (req, res) => {
    const link = await Link.findByIdAndDelete(req.params.id);
    if (!link) return res.status(404).json({ message: 'Link not found.' });
    res.json({ message: 'Link deleted.' });
  }),
);

// ---- Orders -----------------------------------------------------------------

router.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const filter = {};
    if (['pending', 'paid', 'expired'].includes(req.query.status)) filter.status = req.query.status;
    if (req.query.fulfilled === 'true') filter.fulfilled = true;
    if (req.query.fulfilled === 'false') filter.fulfilled = false;

    const orders = await Order.find(filter).sort('-createdAt').limit(200);
    res.json({ orders });
  }),
);

// CSV escape: wrap in quotes and double any inner quotes. Prefix a leading
// =/+/-/@ with an apostrophe so spreadsheet apps don't execute it as a formula
// (CSV injection) — buyer name/phone are user-controlled.
const csvCell = (value) => {
  let s = String(value ?? '');
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

router.get(
  '/orders.csv',
  asyncHandler(async (req, res) => {
    const filter = {};
    if (['pending', 'paid', 'expired'].includes(req.query.status)) filter.status = req.query.status;
    if (req.query.fulfilled === 'true') filter.fulfilled = true;
    if (req.query.fulfilled === 'false') filter.fulfilled = false;

    const orders = await Order.find(filter).sort('-createdAt').limit(5000).lean();
    const header = [
      'reference',
      'status',
      'fulfilled',
      'amount',
      'currency',
      'items',
      'customerName',
      'phone',
      'telegramUsername',
      'createdAt',
      'paidAt',
    ];
    const rows = orders.map((o) =>
      [
        o.reference,
        o.status,
        o.fulfilled ? 'yes' : 'no',
        (o.amount ?? 0).toFixed(2),
        o.currency || 'USD',
        (o.items || []).map((i) => `${i.name} x${i.qty}`).join('; '),
        o.customer?.name || '',
        o.customer?.phone || '',
        o.telegramUsername || '',
        o.createdAt ? new Date(o.createdAt).toISOString() : '',
        o.paidAt ? new Date(o.paidAt).toISOString() : '',
      ]
        .map(csvCell)
        .join(','),
    );

    const csv = [header.join(','), ...rows].join('\r\n');
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="onetapz-orders-${Date.now()}.csv"`);
    res.send(csv);
  }),
);

router.put(
  '/orders/:id/fulfill',
  asyncHandler(async (req, res) => {
    const order = await Order.findByIdAndUpdate(req.params.id, { fulfilled: !!req.body.fulfilled }, { new: true });
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }
    res.json({ order });
  }),
);

// Advance an order's fulfillment stage and notify the buyer over Telegram.
router.put(
  '/orders/:id/stage',
  asyncHandler(async (req, res) => {
    const stage = String(req.body.stage || '');
    if (!ORDER_STAGES.includes(stage)) {
      return res.status(400).json({ message: 'Invalid stage.' });
    }
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    order.stage = stage;
    if (stage === 'dispatched' || stage === 'completed') order.fulfilled = true;

    const label = stageLabel(stage, order.delivery?.method);
    if (order.telegramId) {
      await sendTelegramMessage(
        order.telegramId,
        `📦 <b>Order update</b>\nRef: <code>${htmlEscape(order.reference)}</code>\nStatus: <b>${htmlEscape(label)}</b>`,
      );
      order.messages.push({ from: 'admin', text: `Status → ${label}`, at: new Date() });
    }
    await order.save();
    res.json({ order });
  }),
);

// Send a free-text message to the buyer over Telegram and record it on the order.
router.post(
  '/orders/:id/message',
  asyncHandler(async (req, res) => {
    const text = String(req.body.text || '').trim().slice(0, 2000);
    if (!text) return res.status(400).json({ message: 'Message is empty.' });
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    if (!order.telegramId) return res.status(400).json({ message: 'This buyer has no linked Telegram.' });

    await sendTelegramMessage(order.telegramId, `💬 <b>OneTapZ</b>\n${htmlEscape(text)}`);
    order.messages.push({ from: 'admin', text, at: new Date() });
    await order.save();
    res.json({ order });
  }),
);

// ---- Products (shop catalog) ------------------------------------------------

const PRODUCT_SLUG_RE = /^[a-z0-9-]+$/;
const toMoney = (v) => Math.round((Number(v) || 0) * 100) / 100;

router.get(
  '/products',
  asyncHandler(async (_req, res) => {
    const products = await Product.find().sort('sort');
    res.json({ products });
  }),
);

router.post(
  '/products',
  asyncHandler(async (req, res) => {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name) throw httpError(400, 'Name is required.');

    const slug = (typeof req.body.slug === 'string' && req.body.slug.trim()
      ? req.body.slug.trim()
      : name
    )
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!PRODUCT_SLUG_RE.test(slug)) throw httpError(400, 'Invalid slug.');

    const price = toMoney(req.body.price);
    if (price < 0) throw httpError(400, 'Price must be ≥ 0.');

    try {
      const product = await Product.create({
        slug,
        name,
        description: typeof req.body.description === 'string' ? req.body.description.trim() : '',
        price,
        discountPrice: toMoney(req.body.discountPrice),
        active: req.body.active !== false,
        sort: Number(req.body.sort) || 0,
      });
      res.status(201).json({ product });
    } catch (err) {
      if (err.code === 11000) throw httpError(400, 'That slug is already taken.');
      throw err;
    }
  }),
);

router.put(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const updates = {};
    if (typeof req.body.name === 'string') updates.name = req.body.name.trim();
    if (typeof req.body.description === 'string') updates.description = req.body.description.trim();
    if (req.body.price !== undefined) {
      const v = toMoney(req.body.price);
      if (v < 0) throw httpError(400, 'Price must be ≥ 0.');
      updates.price = v;
    }
    if (req.body.discountPrice !== undefined) {
      const v = toMoney(req.body.discountPrice);
      if (v < 0) throw httpError(400, 'Discount must be ≥ 0.');
      updates.discountPrice = v;
    }
    if (typeof req.body.active === 'boolean') updates.active = req.body.active;
    if (req.body.sort !== undefined) updates.sort = Number(req.body.sort) || 0;

    const product = await Product.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    res.json({ product });
  }),
);

router.delete(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    res.json({ message: 'Product deleted.' });
  }),
);

// ---- NFC cards ----------------------------------------------------------------

router.get(
  '/nfc-cards',
  asyncHandler(async (_req, res) => {
    const cards = await NfcCard.find().populate('userId', 'name username email').sort('-createdAt');
    res.json({ cards });
  }),
);

export default router;
