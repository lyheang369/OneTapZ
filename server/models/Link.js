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
  },
  { timestamps: true },
);

export default mongoose.model('Link', linkSchema);
