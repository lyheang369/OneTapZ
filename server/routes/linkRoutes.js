import express from 'express';
import Link from '../models/Link.js';
import Analytics from '../models/Analytics.js';
import { protect } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { checkUrl } from '../utils/urlFilter.js';

const router = express.Router();

function assertUrlAllowed(url) {
  const result = checkUrl(url);
  if (!result.ok) {
    const error = new Error(result.reason);
    error.status = 400;
    throw error;
  }
}

router.get(
  '/',
  protect,
  asyncHandler(async (req, res) => {
    const links = await Link.find({ userId: req.user._id }).sort('order');
    res.json({ links });
  }),
);

router.post(
  '/',
  protect,
  asyncHandler(async (req, res) => {
    assertUrlAllowed(req.body.url);
    const count = await Link.countDocuments({ userId: req.user._id });
    const link = await Link.create({
      userId: req.user._id,
      title: req.body.title,
      url: req.body.url,
      icon: req.body.icon || 'link',
      order: req.body.order ?? count,
      isActive: req.body.isActive ?? true,
      display: req.body.display === 'icon' ? 'icon' : 'button',
    });

    res.status(201).json({ link });
  }),
);

router.put(
  '/reorder',
  protect,
  asyncHandler(async (req, res) => {
    const { orderedIds = [] } = req.body;

    await Promise.all(
      orderedIds.map((id, order) =>
        Link.updateOne({ _id: id, userId: req.user._id }, { $set: { order } }),
      ),
    );

    const links = await Link.find({ userId: req.user._id }).sort('order');
    res.json({ links });
  }),
);

router.put(
  '/:id',
  protect,
  asyncHandler(async (req, res) => {
    if (req.body.url !== undefined) assertUrlAllowed(req.body.url);

    // Whitelist editable fields. The client sends the whole link object (incl.
    // clickCount, userId, _id); writing req.body verbatim would let a caller
    // overwrite analytics, reassign ownership, or inject Mongo update operators
    // ($set/$inc/$rename) since findOneAndUpdate treats $-keys as operators.
    const updates = {};
    if (typeof req.body.title === 'string') updates.title = req.body.title;
    if (typeof req.body.url === 'string') updates.url = req.body.url;
    if (typeof req.body.icon === 'string') updates.icon = req.body.icon;
    if (typeof req.body.order === 'number') updates.order = req.body.order;
    if (typeof req.body.isActive === 'boolean') updates.isActive = req.body.isActive;
    if (req.body.display === 'icon' || req.body.display === 'button') updates.display = req.body.display;

    const link = await Link.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: updates },
      { new: true, runValidators: true },
    );

    if (!link) {
      return res.status(404).json({ message: 'Link not found.' });
    }

    res.json({ link });
  }),
);

router.delete(
  '/:id',
  protect,
  asyncHandler(async (req, res) => {
    const link = await Link.findOneAndDelete({ _id: req.params.id, userId: req.user._id });

    if (!link) {
      return res.status(404).json({ message: 'Link not found.' });
    }

    res.json({ message: 'Link deleted.' });
  }),
);

router.post(
  '/:id/click',
  asyncHandler(async (req, res) => {
    const link = await Link.findByIdAndUpdate(req.params.id, { $inc: { clickCount: 1 } }, { new: true });

    if (!link) {
      return res.status(404).json({ message: 'Link not found.' });
    }

    await Analytics.findOneAndUpdate(
      { userId: link.userId },
      { $inc: { linkClicks: 1 } },
      { upsert: true },
    );

    res.json({ link });
  }),
);

export default router;
