import express from 'express';
import User from '../models/User.js';
import Link from '../models/Link.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = express.Router();

router.get(
  '/:username',
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ username: req.params.username.toLowerCase(), isActive: true })
      .select('-password -email')
      .lean();

    if (!user) {
      return res.status(404).json({ message: 'Profile not found.' });
    }

    const links = await Link.find({ userId: user._id, isActive: true }).sort('order').lean();

    // Public, read-only page hit repeatedly via NFC/QR — cache it at Vercel's
    // edge so repeat opens skip the function + DB entirely. View counting is
    // done by the client (POST /api/analytics/view) so it still records on
    // cached hits. Short TTL keeps profile edits near-fresh.
    res.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    res.json({ user, links });
  }),
);

export default router;
