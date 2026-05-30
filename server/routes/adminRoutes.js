import express from 'express';
import User from '../models/User.js';
import NfcCard from '../models/NfcCard.js';
import { adminOnly, protect } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = express.Router();

router.use(protect, adminOnly);

router.get(
  '/users',
  asyncHandler(async (_req, res) => {
    const users = await User.find().select('-password').sort('-createdAt');
    res.json({ users });
  }),
);

router.get(
  '/nfc-cards',
  asyncHandler(async (_req, res) => {
    const cards = await NfcCard.find().populate('userId', 'name username email').sort('-createdAt');
    res.json({ cards });
  }),
);

router.put(
  '/users/:id/status',
  asyncHandler(async (req, res) => {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: req.body.isActive },
      { new: true },
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({ user });
  }),
);

router.delete(
  '/users/:id',
  asyncHandler(async (req, res) => {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted.' });
  }),
);

export default router;
