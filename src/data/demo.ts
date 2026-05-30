import type { Analytics, LinkItem, NfcCard, User } from '../lib/types';

export const demoUser: User = {
  id: 'demo-user',
  name: 'Zara Vann',
  email: 'demo@onetapz.link',
  username: 'zara',
  bio: 'Design student, content creator, and weekend freelancer. Tap in for my work, socials, and contact.',
  profileImage:
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=320&q=80',
  theme: 'gradient',
  role: 'admin',
  isActive: true,
};

export const demoLinks: LinkItem[] = [
  {
    _id: 'link-1',
    title: 'Portfolio',
    url: 'https://onetapz.link',
    icon: 'portfolio',
    order: 0,
    isActive: true,
    clickCount: 42,
  },
  {
    _id: 'link-2',
    title: 'Instagram',
    url: 'https://instagram.com',
    icon: 'instagram',
    order: 1,
    isActive: true,
    clickCount: 31,
  },
  {
    _id: 'link-3',
    title: 'Book a project',
    url: 'mailto:hello@onetapz.link',
    icon: 'mail',
    order: 2,
    isActive: true,
    clickCount: 18,
  },
];

export const demoAnalytics: Analytics = {
  profileViews: 320,
  linkClicks: 91,
  tapCount: 144,
};

export const demoCard: NfcCard = {
  _id: 'demo-card',
  cardId: 'OTZ-DEMO-001',
  profileUrl: 'https://onetapz.link/zara',
  isActive: true,
};
