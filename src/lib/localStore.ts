import { demoLinks } from '../data/demo';
import type { LinkItem, User } from './types';

const userKey = (id: string) => `onetapz_user_${id}`;
const linksKey = (id: string) => `onetapz_links_${id}`;

export function readLocalUser(id: string): Partial<User> | null {
  const raw = localStorage.getItem(userKey(id));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as Partial<User>;
  } catch {
    return null;
  }
}

export function saveLocalUser(user: User) {
  localStorage.setItem(userKey(user.id), JSON.stringify(user));
  localStorage.setItem('onetapz_last_profile', JSON.stringify(user));
}

export function readLocalLinks(id: string): LinkItem[] {
  const raw = localStorage.getItem(linksKey(id));
  if (!raw) return demoLinks;

  try {
    return JSON.parse(raw) as LinkItem[];
  } catch {
    return demoLinks;
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
