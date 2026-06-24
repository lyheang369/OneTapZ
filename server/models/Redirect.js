import mongoose from 'mongoose';

// A user-owned short link: onetapz.me/link/<slug> 302s to `url`. The slug lives
// in a single global namespace (the URL has no owner segment), so it's unique
// across all users, not just per-user.
const redirectSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9_-]+$/,
    },
    url: { type: String, required: true, trim: true },
    title: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
    clickCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// The dashboard lists a user's redirects; the public hop looks up by slug
// (already indexed via `unique`).
redirectSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('Redirect', redirectSchema);
