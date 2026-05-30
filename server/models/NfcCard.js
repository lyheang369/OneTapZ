import mongoose from 'mongoose';

const nfcCardSchema = new mongoose.Schema(
  {
    cardId: { type: String, required: true, unique: true, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    profileUrl: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model('NfcCard', nfcCardSchema);
