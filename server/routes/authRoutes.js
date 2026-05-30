import express from 'express';
import User from '../models/User.js';
import Analytics from '../models/Analytics.js';
import { protect } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { signToken } from '../utils/token.js';

const router = express.Router();

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  username: user.username,
  bio: user.bio,
  profileImage: user.profileImage,
  theme: user.theme,
  role: user.role,
  isActive: user.isActive,
});

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { name, email, password, username } = req.body;

    if (!name || !email || !password || !username) {
      return res.status(400).json({ message: 'Name, email, username, and password are required.' });
    }

    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists) {
      return res.status(409).json({ message: 'Email or username is already taken.' });
    }

    const user = await User.create({ name, email, password, username });
    await Analytics.create({ userId: user._id });

    res.status(201).json({ user: publicUser(user), token: signToken(user) });
  }),
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'This account is inactive.' });
    }

    res.json({ user: publicUser(user), token: signToken(user) });
  }),
);

router.get('/me', protect, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export default router;
