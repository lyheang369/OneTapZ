import mongoose from 'mongoose';

const linkSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    icon: { type: String, default: 'link' },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    clickCount: { type: Number, default: 0 },
    display: { type: String, enum: ['button', 'icon'], default: 'button' },
  },
  { timestamps: true },
);

// Public profiles query links by owner, sorted by order — index both so the
// lookup is an index scan instead of a full collection scan.
linkSchema.index({ userId: 1, order: 1 });

export default mongoose.model('Link', linkSchema);
