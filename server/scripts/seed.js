import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Link from '../models/Link.js';
import NfcCard from '../models/NfcCard.js';
import Analytics from '../models/Analytics.js';

await connectDB();

const demoUser = await User.findOneAndUpdate(
  { email: 'demo@onetapz.link' },
  {
    name: 'Zara Vann',
    email: 'demo@onetapz.link',
    username: 'zara',
    bio: 'Design student, content creator, and weekend freelancer. Tap in for my work, socials, and contact.',
    profileImage:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=320&q=80',
    theme: 'gradient',
    role: 'user',
    isActive: true,
  },
  { new: true, upsert: true, setDefaultsOnInsert: true },
);

if (!demoUser.password) {
  demoUser.password = 'Demo1234!';
  await demoUser.save();
}

await Link.deleteMany({ userId: demoUser._id });
await Link.insertMany([
  {
    userId: demoUser._id,
    title: 'Portfolio',
    url: 'https://onetapz.link',
    icon: 'portfolio',
    order: 0,
    clickCount: 42,
  },
  {
    userId: demoUser._id,
    title: 'Instagram',
    url: 'https://instagram.com',
    icon: 'instagram',
    order: 1,
    clickCount: 31,
  },
  {
    userId: demoUser._id,
    title: 'Book a project',
    url: 'mailto:hello@onetapz.link',
    icon: 'mail',
    order: 2,
    clickCount: 18,
  },
]);

await Analytics.findOneAndUpdate(
  { userId: demoUser._id },
  { profileViews: 320, linkClicks: 91, tapCount: 144 },
  { upsert: true },
);

await NfcCard.findOneAndUpdate(
  { cardId: 'OTZ-DEMO-001' },
  {
    cardId: 'OTZ-DEMO-001',
    userId: demoUser._id,
    profileUrl: `${process.env.PUBLIC_BASE_URL || 'http://localhost:5173'}/zara`,
    isActive: true,
  },
  { upsert: true },
);

console.log('Demo user ready: demo@onetapz.link / Demo1234!');
await mongoose.disconnect();
