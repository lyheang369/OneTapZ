export type ThemeName =
  | 'acid'
  | 'dark'
  | 'light'
  | 'blue'
  | 'purple'
  | 'minimal'
  | 'gradient'
  | 'sunset'
  | 'forest'
  | 'ocean'
  | 'rose'
  | 'mono'
  | 'aurora';
export type ButtonStyle = 'rounded' | 'pill' | 'square' | 'glass' | 'outline' | 'soft';

export type User = {
  id: string;
  _id?: string;
  name: string;
  email?: string;
  username: string;
  bio: string;
  profileImage: string;
  theme: ThemeName;
  buttonStyle: ButtonStyle;
  buttonBackground: string;
  pageBackground: string;
  role: 'user' | 'admin';
  isActive?: boolean;
  // Contact details for the "Save contact" vCard.
  phone?: string;
  contactEmail?: string;
  company?: string;
  jobTitle?: string;
  location?: string;
  // Whether/how the "Save contact" action shows on the public profile.
  saveContactEnabled?: boolean;
  saveContactDisplay?: LinkDisplay;
  createdAt?: string;
};

export type LinkDisplay = 'button' | 'icon';

export type LinkItem = {
  _id: string;
  title: string;
  url: string;
  icon: string;
  order: number;
  isActive: boolean;
  clickCount: number;
  // 'button' = full-width link button; 'icon' = compact icon in the social row.
  display?: LinkDisplay;
};

export type NfcCard = {
  _id: string;
  cardId: string;
  profileUrl: string;
  isActive: boolean;
  createdAt?: string;
};

export type Analytics = {
  profileViews: number;
  linkClicks: number;
  tapCount: number;
};

export type Order = {
  _id: string;
  reference: string;
  items: { productId: string; name: string; price: number; qty: number }[];
  amount: number;
  currency: string;
  customer: { name: string; phone: string; address: string };
  status: 'pending' | 'paid' | 'expired';
  fulfilled: boolean;
  telegramUsername?: string;
  createdAt?: string;
};

export type AdminStats = {
  totalUsers: number;
  newUsers7d: number;
  totalLinks: number;
  profileViews: number;
  linkClicks: number;
  tapCount: number;
  orders: { pending: number; paid: number; expired: number };
  revenue: number;
};
