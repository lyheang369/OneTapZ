import mongoose from 'mongoose';

const analyticsSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    profileViews: { type: Number, default: 0 },
    linkClicks: { type: Number, default: 0 },
    tapCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export default mongoose.model('Analytics', analyticsSchema);
