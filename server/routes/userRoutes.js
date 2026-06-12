import express from 'express';
import User from '../models/User.js';
import Link from '../models/Link.js';
import Analytics from '../models/Analytics.js';
import { protect } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { storeImage } from '../utils/storeImage.js';

const router = express.Router();

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  username: user.username,
  bio: user.bio,
  profileImage: user.profileImage,
  phone: user.phone,
  contactEmail: user.contactEmail,
  company: user.company,
  jobTitle: user.jobTitle,
  location: user.location,
  saveContactEnabled: user.saveContactEnabled,
  saveContactDisplay: user.saveContactDisplay,
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
    const allowed = [
      'name',
      'username',
      'bio',
      'theme',
      'profileImage',
      'buttonStyle',
      'buttonBackground',
      'pageBackground',
      'phone',
      'contactEmail',
      'company',
      'jobTitle',
      'location',
      'saveContactEnabled',
      'saveContactDisplay',
    ];

    // Validate a username change before applying it: enforce the same format as
    // registration and check uniqueness, so we return a clean 400/409 instead of
    // a 500 from the unique-index violation (and never persist a malformed handle
    // that would break public-profile URL routing).
    if (typeof req.body.username === 'string') {
      const username = req.body.username.trim().toLowerCase();
      if (!/^[a-z0-9_-]{3,22}$/.test(username)) {
        return res.status(400).json({
          message: 'Username must be 3–22 characters: letters, numbers, hyphens or underscores.',
        });
      }
      if (username !== req.user.username) {
        const taken = await User.exists({ username, _id: { $ne: req.user._id } });
        if (taken) {
          return res.status(409).json({ message: 'That username is already taken.' });
        }
      }
      req.body.username = username;
    }

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        req.user[field] = req.body[field];
      }
    }

    if (req.file) {
      req.user.profileImage = await storeImage(req.file);
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
