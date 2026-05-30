import express from 'express';
import Analytics from '../models/Analytics.js';
import Link from '../models/Link.js';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = express.Router();

router.get(
  '/me',
  protect,
  asyncHandler(async (req, res) => {
    const analytics = await Analytics.findOneAndUpdate(
      { userId: req.user._id },
      {},
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    const mostClickedLink = await Link.findOne({ userId: req.user._id }).sort('-clickCount');

    res.json({ analytics, mostClickedLink });
  }),
);

router.post(
  '/view',
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ username: req.body.username?.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: 'Profile not found.' });
    }

    const analytics = await Analytics.findOneAndUpdate(
      { userId: user._id },
      { $inc: { profileViews: 1, tapCount: 1 } },
      { new: true, upsert: true },
    );

    res.json({ analytics });
  }),
);

export default router;
