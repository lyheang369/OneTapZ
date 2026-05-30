import express from 'express';
import crypto from 'crypto';
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
  buttonStyle: user.buttonStyle,
  buttonBackground: user.buttonBackground,
  pageBackground: user.pageBackground,
  role: user.role,
  isActive: user.isActive,
});

function verifyTelegramPayload(payload) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    const error = new Error('Telegram login is not configured.');
    error.status = 501;
    throw error;
  }

  const { hash, ...data } = payload;
  if (!hash) {
    const error = new Error('Telegram login payload is missing a hash.');
    error.status = 400;
    throw error;
  }

  const checkString = Object.keys(data)
    .sort()
    .map((key) => `${key}=${data[key]}`)
    .join('\n');
  const secret = crypto.createHash('sha256').update(botToken).digest();
  const expected = crypto.createHmac('sha256', secret).update(checkString).digest('hex');

  if (expected.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hash))) {
    const error = new Error('Telegram login verification failed.');
    error.status = 401;
    throw error;
  }

  const authDate = Number(payload.auth_date || 0) * 1000;
  if (!authDate || Date.now() - authDate > 24 * 60 * 60 * 1000) {
    const error = new Error('Telegram login expired.');
    error.status = 401;
    throw error;
  }
}

async function uniqueUsername(base) {
  const clean = (base || 'telegram-user').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 22) || 'telegram-user';
  let candidate = clean;
  let suffix = 1;

  while (await User.exists({ username: candidate })) {
    candidate = `${clean}${suffix}`;
    suffix += 1;
  }

  return candidate;
}

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

router.post(
  '/telegram',
  asyncHandler(async (req, res) => {
    verifyTelegramPayload(req.body);

    const telegramId = String(req.body.id);
    const firstName = req.body.first_name || '';
    const lastName = req.body.last_name || '';
    const name = `${firstName} ${lastName}`.trim() || req.body.username || `Telegram ${telegramId}`;

    let user = await User.findOne({ telegramId });

    if (!user) {
      user = await User.create({
        telegramId,
        name,
        email: `telegram-${telegramId}@onetapz.local`,
        password: crypto.randomBytes(24).toString('hex'),
        username: await uniqueUsername(req.body.username || `tg${telegramId}`),
        profileImage: req.body.photo_url || '',
        bio: '',
        theme: 'gradient',
      });
      await Analytics.create({ userId: user._id });
    } else {
      user.name = name;
      user.profileImage = req.body.photo_url || user.profileImage;
      await user.save();
    }

    res.json({ user: publicUser(user), token: signToken(user) });
  }),
);

router.get('/me', protect, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export default router;
