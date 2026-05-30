import express from 'express';
import User from '../models/User.js';
import Link from '../models/Link.js';
import Analytics from '../models/Analytics.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = express.Router();

router.get(
  '/:username',
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ username: req.params.username.toLowerCase(), isActive: true }).select(
      '-password -email',
    );

    if (!user) {
      return res.status(404).json({ message: 'Profile not found.' });
    }

    const links = await Link.find({ userId: user._id, isActive: true }).sort('order');
    const analytics = await Analytics.findOneAndUpdate(
      { userId: user._id },
      { $inc: { profileViews: 1, tapCount: 1 } },
      { new: true, upsert: true },
    );

    res.json({ user, links, analytics });
  }),
);

export default router;
