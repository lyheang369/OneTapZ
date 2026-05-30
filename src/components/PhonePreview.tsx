import { QrCode } from 'lucide-react';
import { IconBadge } from './IconBadge';
import type { LinkItem, User } from '../lib/types';

export function PhonePreview({ user, links }: { user: User; links: LinkItem[] }) {
  return (
    <div className={`phone-preview theme-${user.theme}`}>
      <div className="mx-auto h-1.5 w-16 rounded-full bg-white/30" />
      <img className="profile-photo mt-7" src={user.profileImage} alt={user.name} />
      <h2 className="mt-4 text-center text-2xl font-black">{user.name}</h2>
      <p className="text-center text-sm opacity-80">@{user.username}</p>
      <p className="mt-3 text-center text-sm leading-6 opacity-90">{user.bio}</p>
      <div className="mt-6 space-y-3">
        {links
          .filter((link) => link.isActive)
          .map((link) => (
            <a key={link._id} className="profile-link" href={link.url} target="_blank" rel="noreferrer">
              <IconBadge name={link.icon} />
              <span>{link.title}</span>
            </a>
          ))}
      </div>
      <div className="mt-5 flex items-center justify-center gap-2 text-xs opacity-75">
        <QrCode size={15} />
        Tap, scan, or share with NFC
      </div>
    </div>
  );
}
