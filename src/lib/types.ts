export type ThemeName = 'dark' | 'light' | 'blue' | 'purple' | 'minimal' | 'gradient';
export type ButtonStyle = 'rounded' | 'pill' | 'square' | 'glass';

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
};

export type LinkItem = {
  _id: string;
  title: string;
  url: string;
  icon: string;
  order: number;
  isActive: boolean;
  clickCount: number;
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
