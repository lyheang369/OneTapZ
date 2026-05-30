import express from 'express';
import Link from '../models/Link.js';
import Analytics from '../models/Analytics.js';
import { protect } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = express.Router();

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
    const count = await Link.countDocuments({ userId: req.user._id });
    const link = await Link.create({
      userId: req.user._id,
      title: req.body.title,
      url: req.body.url,
      icon: req.body.icon || 'link',
      order: req.body.order ?? count,
      isActive: req.body.isActive ?? true,
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
    const link = await Link.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
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
