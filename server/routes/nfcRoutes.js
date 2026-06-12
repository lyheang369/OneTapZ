import express from 'express';
import NfcCard from '../models/NfcCard.js';
import { protect } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = express.Router();

router.get(
  '/me',
  protect,
  asyncHandler(async (req, res) => {
    const card = await NfcCard.findOne({ userId: req.user._id });
    res.json({ card });
  }),
);

router.post(
  '/assign',
  protect,
  asyncHandler(async (req, res) => {
    const cardId = typeof req.body.cardId === 'string' ? req.body.cardId.trim() : '';
    if (!cardId) {
      return res.status(400).json({ message: 'A card ID is required.' });
    }

    // Ownership guard: a blank upsert keyed only on cardId let any user claim a
    // cardId already bound to someone else, hijacking their physical card to
    // point at the attacker's profile. Only allow claiming an unassigned card
    // or re-saving one you already own.
    const existing = await NfcCard.findOne({ cardId });
    if (existing && String(existing.userId) !== String(req.user._id)) {
      return res.status(409).json({ message: 'This card is already linked to another account.' });
    }

    const profileUrl = `${process.env.PUBLIC_BASE_URL || 'http://localhost:5173'}/${req.user.username}`;
    const card = await NfcCard.findOneAndUpdate(
      { cardId },
      { cardId, userId: req.user._id, profileUrl, isActive: true },
      { new: true, upsert: true, runValidators: true },
    );

    res.status(201).json({ card });
  }),
);

router.put(
  '/:id/status',
  protect,
  asyncHandler(async (req, res) => {
    const card = await NfcCard.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { isActive: req.body.isActive },
      { new: true },
    );

    if (!card) {
      return res.status(404).json({ message: 'NFC card not found.' });
    }

    res.json({ card });
  }),
);

export default router;
