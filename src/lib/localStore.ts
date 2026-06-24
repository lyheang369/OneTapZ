import type { LinkItem, User } from './types';

const userKey = (id: string) => `onetapz_user_${id}`;
const linksKey = (id: string) => `onetapz_links_${id}`;
const accountsKey = 'onetapz_local_accounts';

type LocalAccount = {
  user: User;
  password: string;
};

function readAccounts(): LocalAccount[] {
  const raw = localStorage.getItem(accountsKey);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as LocalAccount[];
  } catch {
    return [];
  }
}

function saveAccounts(accounts: LocalAccount[]) {
  localStorage.setItem(accountsKey, JSON.stringify(accounts));
}

export function readLocalUser(id: string): Partial<User> | null {
  const raw = localStorage.getItem(userKey(id));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as Partial<User>;
  } catch {
    return null;
  }
}

export function readLocalAccountUser(id: string): User | null {
  const account = readAccounts().find((item) => item.user.id === id);
  if (!account) return null;
  return { ...account.user, ...readLocalUser(id) };
}

export function saveLocalUser(user: User) {
  localStorage.setItem(userKey(user.id), JSON.stringify(user));
  localStorage.setItem('onetapz_last_profile', JSON.stringify(user));

  const accounts = readAccounts();
  const index = accounts.findIndex((account) => account.user.id === user.id);
  if (index >= 0) {
    accounts[index] = { ...accounts[index], user };
    saveAccounts(accounts);
  }
}

export function readLocalLinks(id: string): LinkItem[] {
  const raw = localStorage.getItem(linksKey(id));
  if (!raw) return [];

  try {
    return JSON.parse(raw) as LinkItem[];
  } catch {
    return [];
  }
}

export function saveLocalLinks(id: string, links: LinkItem[]) {
  localStorage.setItem(linksKey(id), JSON.stringify(links));
}

export function readLastLocalProfile(): User | null {
  const raw = localStorage.getItem('onetapz_last_profile');
  if (!raw) return null;

  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function createLocalAccount(payload: { name: string; email: string; username: string; password: string }): User {
  const accounts = readAccounts();
  const email = payload.email.toLowerCase().trim();
  const username = payload.username.toLowerCase().trim();

  if (accounts.some((account) => account.user.email === email || account.user.username === username)) {
    throw new Error('Email or username is already taken.');
  }

  const user: User = {
    id: `local-${crypto.randomUUID()}`,
    name: payload.name.trim(),
    email,
    username,
    bio: '',
    profileImage: '',
    theme: 'dark',
    buttonStyle: 'pill',
    buttonBackground: '',
    pageBackground: '',
    role: 'user',
    isActive: true,
  };

  saveAccounts([...accounts, { user, password: payload.password }]);
  saveLocalUser(user);
  return user;
}

export function loginLocalAccount(email: string, password: string): User {
  const account = readAccounts().find((item) => item.user.email === email.toLowerCase().trim() && item.password === password);
  if (!account) throw new Error('Invalid email or password.');
  return { ...account.user, ...readLocalUser(account.user.id) };
}
