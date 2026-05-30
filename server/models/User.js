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
    theme: {
      type: String,
      enum: ['dark', 'light', 'blue', 'purple', 'minimal', 'gradient'],
      default: 'gradient',
    },
    buttonStyle: {
      type: String,
      enum: ['rounded', 'pill', 'square', 'glass'],
      default: 'pill',
    },
    buttonBackground: { type: String, default: '#2563eb' },
    pageBackground: { type: String, default: '#0f172a' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.matchPassword = function matchPassword(password) {
  return bcrypt.compare(password, this.password);
};

export default mongoose.model('User', userSchema);
