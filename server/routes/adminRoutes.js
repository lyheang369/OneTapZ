import express from 'express';
import User from '../models/User.js';
import Link from '../models/Link.js';
import Analytics from '../models/Analytics.js';
import NfcCard from '../models/NfcCard.js';
import Order from '../models/Order.js';
import { adminOnly, protect } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

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

// ---- NFC cards ----------------------------------------------------------------

router.get(
  '/nfc-cards',
  asyncHandler(async (_req, res) => {
    const cards = await NfcCard.find().populate('userId', 'name username email').sort('-createdAt');
    res.json({ cards });
  }),
);

export default router;
