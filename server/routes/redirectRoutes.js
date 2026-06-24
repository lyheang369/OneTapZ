import express from 'express';
import Redirect from '../models/Redirect.js';
import { protect } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { checkUrl } from '../utils/urlFilter.js';

const router = express.Router();

const SLUG_RE = /^[a-z0-9_-]+$/;

function normalizeSlug(raw) {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

function assertUrlAllowed(url) {
  const result = checkUrl(url);
  if (!result.ok) {
    const error = new Error(result.reason);
    error.status = 400;
    throw error;
  }
}

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

router.use(protect);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const redirects = await Redirect.find({ userId: req.user._id }).sort('-createdAt');
    res.json({ redirects });
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const slug = normalizeSlug(req.body.slug);
    if (!SLUG_RE.test(slug)) {
      throw badRequest('Slug may only contain lowercase letters, numbers, hyphens and underscores.');
    }
    assertUrlAllowed(req.body.url);

    try {
      const redirect = await Redirect.create({
        userId: req.user._id,
        slug,
        url: req.body.url,
        title: typeof req.body.title === 'string' ? req.body.title : '',
        isActive: req.body.isActive ?? true,
      });
      res.status(201).json({ redirect });
    } catch (err) {
      if (err.code === 11000) throw badRequest('That short link is already taken.');
      throw err;
    }
  }),
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    // Whitelist editable fields (same hygiene as linkRoutes: never write req.body
    // straight to findOneAndUpdate — it carries clickCount/userId and $-operators).
    const updates = {};
    if (req.body.slug !== undefined) {
      const slug = normalizeSlug(req.body.slug);
      if (!SLUG_RE.test(slug)) {
        throw badRequest('Slug may only contain lowercase letters, numbers, hyphens and underscores.');
      }
      updates.slug = slug;
    }
    if (req.body.url !== undefined) {
      assertUrlAllowed(req.body.url);
      updates.url = req.body.url;
    }
    if (typeof req.body.title === 'string') updates.title = req.body.title;
    if (typeof req.body.isActive === 'boolean') updates.isActive = req.body.isActive;

    try {
      const redirect = await Redirect.findOneAndUpdate(
        { _id: req.params.id, userId: req.user._id },
        { $set: updates },
        { new: true, runValidators: true },
      );
      if (!redirect) return res.status(404).json({ message: 'Redirect not found.' });
      res.json({ redirect });
    } catch (err) {
      if (err.code === 11000) throw badRequest('That short link is already taken.');
      throw err;
    }
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const redirect = await Redirect.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!redirect) return res.status(404).json({ message: 'Redirect not found.' });
    res.json({ message: 'Redirect deleted.' });
  }),
);

export default router;
