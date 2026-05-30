import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Not authorized. Missing token.' });
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-only-change-me');
  const user = await User.findById(decoded.id).select('-password');

  if (!user || !user.isActive) {
    return res.status(401).json({ message: 'Not authorized.' });
  }

  req.user = user;
  next();
});

export function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required.' });
  }
  next();
}
