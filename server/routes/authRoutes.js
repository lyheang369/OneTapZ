import express from 'express';
import crypto from 'crypto';
import User from '../models/User.js';
import Analytics from '../models/Analytics.js';
import { protect } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { signToken } from '../utils/token.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = express.Router();

// Throttle credential + identity endpoints against brute force / spam.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });

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
  authLimiter,
  asyncHandler(async (req, res) => {
    // Coerce to strings: req.body fields are attacker-controlled and a JSON
    // object like {"$gt":""} would otherwise reach Mongo as a query operator.
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const username = typeof req.body.username === 'string' ? req.body.username.trim().toLowerCase() : '';

    if (!name || !email || !password || !username) {
      return res.status(400).json({ message: 'Name, email, username, and password are required.' });
    }

    if (!/^[a-z0-9_-]{3,22}$/.test(username)) {
      return res.status(400).json({
        message: 'Username must be 3–22 characters: letters, numbers, hyphens or underscores.',
      });
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
  authLimiter,
  asyncHandler(async (req, res) => {
    // Coerce to strings so a crafted object body can't smuggle a Mongo operator
    // (e.g. {"email":{"$gt":""}}) into the lookup.
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
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

// Verify Telegram Mini App initData (signed query string from WebApp.initData).
// Uses the WebApp HMAC scheme: secret = HMAC_SHA256(key="WebAppData", botToken),
// then hash = HMAC_SHA256(secret, data_check_string). Returns the parsed user.
function verifyWebAppInitData(initData) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    const error = new Error('Telegram login is not configured.');
    error.status = 501;
    throw error;
  }
  if (!initData || typeof initData !== 'string') {
    const error = new Error('Missing Telegram initData.');
    error.status = 400;
    throw error;
  }

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) {
    const error = new Error('Telegram initData is missing a hash.');
    error.status = 400;
    throw error;
  }

  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hashMatches = (h) => h.length === hash.length && crypto.timingSafeEqual(Buffer.from(h), Buffer.from(hash));

  // data_check_string = fields (except hash), sorted, joined by newlines. Telegram
  // clients differ on whether the newer Ed25519 `signature` field is part of the
  // HMAC input, so accept whichever variant validates against the bot secret —
  // forging either still requires the bot token, so this stays secure.
  const computeHash = (excludeSignature) => {
    const pairs = [];
    for (const [key, value] of params.entries()) {
      if (key === 'hash') continue;
      if (excludeSignature && key === 'signature') continue;
      pairs.push(`${key}=${value}`);
    }
    pairs.sort();
    return crypto.createHmac('sha256', secret).update(pairs.join('\n')).digest('hex');
  };

  if (!hashMatches(computeHash(false)) && !hashMatches(computeHash(true))) {
    const error = new Error('Telegram verification failed.');
    error.status = 401;
    throw error;
  }

  const authDate = Number(params.get('auth_date') || 0) * 1000;
  if (!authDate || Date.now() - authDate > 24 * 60 * 60 * 1000) {
    const error = new Error('Telegram session expired.');
    error.status = 401;
    throw error;
  }

  const userRaw = params.get('user');
  if (!userRaw) {
    const error = new Error('Telegram initData is missing user.');
    error.status = 400;
    throw error;
  }
  return JSON.parse(userRaw);
}

// Telegram usernames (without @, case-insensitive) granted the admin role.
const ADMIN_TELEGRAM_USERNAMES = (process.env.ADMIN_TELEGRAM_USERNAMES || 'lyheangleng')
  .split(',')
  .map((name) => name.trim().toLowerCase())
  .filter(Boolean);

function isAdminTelegram(username) {
  return !!username && ADMIN_TELEGRAM_USERNAMES.includes(username.toLowerCase());
}

// Find-or-create a user from Telegram identity (shared by login widget + Mini App).
async function provisionTelegramUser({ telegramId, firstName = '', lastName = '', username = '', photoUrl = '' }) {
  const id = String(telegramId);
  const name = `${firstName} ${lastName}`.trim() || username || `Telegram ${id}`;
  const admin = isAdminTelegram(username);

  let user = await User.findOne({ telegramId: id });
  if (user) {
    user.name = name;
    if (photoUrl) user.profileImage = photoUrl;
    // Promote (or demote) based on the configured admin list.
    if (admin && user.role !== 'admin') user.role = 'admin';
    await user.save();
    return { user, isNew: false };
  }

  user = await User.create({
    telegramId: id,
    name,
    email: `telegram-${id}@onetapz.local`,
    password: crypto.randomBytes(24).toString('hex'),
    username: await uniqueUsername(username || `tg${id}`),
    profileImage: photoUrl || '',
    bio: '',
    theme: 'dark',
    role: admin ? 'admin' : 'user',
  });
  await Analytics.create({ userId: user._id });
  return { user, isNew: true };
}

router.post(
  '/telegram',
  authLimiter,
  asyncHandler(async (req, res) => {
    verifyTelegramPayload(req.body);
    const { user, isNew } = await provisionTelegramUser({
      telegramId: req.body.id,
      firstName: req.body.first_name,
      lastName: req.body.last_name,
      username: req.body.username,
      photoUrl: req.body.photo_url,
    });
    res.json({ user: publicUser(user), token: signToken(user), isNew });
  }),
);

router.post(
  '/telegram/webapp',
  authLimiter,
  asyncHandler(async (req, res) => {
    const tgUser = verifyWebAppInitData(req.body.initData);
    const { user, isNew } = await provisionTelegramUser({
      telegramId: tgUser.id,
      firstName: tgUser.first_name,
      lastName: tgUser.last_name,
      username: tgUser.username,
      photoUrl: tgUser.photo_url,
    });
    res.json({ user: publicUser(user), token: signToken(user), isNew });
  }),
);

router.get('/me', protect, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export default router;
