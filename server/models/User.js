import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    telegramId: { type: String, unique: true, sparse: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    bio: { type: String, default: '' },
    profileImage: { type: String, default: '' },
    // Contact details for the "Save contact" vCard.
    phone: { type: String, default: '' },
    contactEmail: { type: String, default: '' },
    company: { type: String, default: '' },
    jobTitle: { type: String, default: '' },
    location: { type: String, default: '' },
    saveContactEnabled: { type: Boolean, default: true },
    saveContactDisplay: { type: String, enum: ['button', 'icon'], default: 'button' },
    theme: {
      type: String,
      enum: ['acid', 'dark', 'light', 'blue', 'purple', 'minimal', 'gradient', 'sunset', 'forest', 'ocean', 'rose', 'mono', 'aurora'],
      default: 'gradient',
    },
    buttonStyle: {
      type: String,
      enum: ['rounded', 'pill', 'square', 'glass', 'outline', 'soft'],
      default: 'pill',
    },
    buttonBackground: { type: String, default: '' },
    pageBackground: { type: String, default: '' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.matchPassword = function matchPassword(password) {
  return bcrypt.compare(password, this.password);
};

export default mongoose.model('User', userSchema);
