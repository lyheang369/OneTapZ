import express from 'express';
import User from '../models/User.js';
import Link from '../models/Link.js';
import Analytics from '../models/Analytics.js';
import { protect } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = express.Router();

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  username: user.username,
  bio: user.bio,
  profileImage: user.profileImage,
  theme: user.theme,
  buttonStyle: user.buttonStyle,
  buttonBackground: user.buttonBackground,
  pageBackground: user.pageBackground,
  role: user.role,
  isActive: user.isActive,
});

router.get('/me', protect, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.put(
  '/me',
  protect,
  upload.single('profileImage'),
  asyncHandler(async (req, res) => {
    const allowed = ['name', 'username', 'bio', 'theme', 'profileImage', 'buttonStyle', 'buttonBackground', 'pageBackground'];

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        req.user[field] = req.body[field];
      }
    }

    if (req.file) {
      req.user.profileImage = `/uploads/${req.file.filename}`;
    }

    await req.user.save();
    res.json({ user: publicUser(req.user) });
  }),
);

router.get(
  '/profile/:username',
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
