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
  | 'aurora'
  | 'midnight'
  | 'ember'
  | 'candy'
  | 'mocha';
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

export type RedirectLink = {
  _id: string;
  slug: string;
  url: string;
  title: string;
  isActive: boolean;
  clickCount: number;
  createdAt?: string;
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

// User's customization for a printed NFC name card. Travels with the Order so
// whoever fulfills/prints it has the data (prefilled from the buyer's profile).
export type CardDesign = {
  template: string;
  name: string;
  tagline: string;
  handle: string;
  phone: string;
  email: string;
  profileUrl: string;
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
  stage?: 'preparing' | 'printing' | 'dispatched' | 'completed';
  messages?: { from: 'admin' | 'buyer'; text: string; at: string }[];
  delivery?: { method: 'pickup' | 'delivery'; area?: string; courier?: string; address?: string; fee?: number };
  telegramUsername?: string;
  telegramId?: string;
  cardDesign?: CardDesign;
  createdAt?: string;
};

export const ORDER_STAGES = ['preparing', 'printing', 'dispatched', 'completed'] as const;
export type OrderStage = (typeof ORDER_STAGES)[number];
export function stageLabel(stage: OrderStage | undefined, method?: 'pickup' | 'delivery'): string {
  switch (stage) {
    case 'printing':
      return 'Printing';
    case 'dispatched':
      return method === 'delivery' ? 'Shipped' : 'Ready for pickup';
    case 'completed':
      return 'Completed';
    default:
      return 'Preparing';
  }
}

export type AdminProduct = {
  _id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  discountPrice: number;
  active: boolean;
  sort?: number;
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
