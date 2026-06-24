import { QrCode } from 'lucide-react';
import { ProfileCard } from './ProfileCard';
import { profileStyleVars } from '../lib/profileStyle';
import type { LinkItem, User } from '../lib/types';

// Renders the exact public-page markup + theme tokens inside a phone frame, so
// the edit-page preview matches the live profile (WYSIWYG).
export function PhonePreview({ user, links }: { user: User; links: LinkItem[] }) {
  return (
    <div
      className={`phone-frame public-page theme-${user.theme} button-${user.buttonStyle || 'pill'}`}
      style={profileStyleVars(user)}
    >
      <ProfileCard user={user} links={links} />
      <div className="phone-foot">
        <QrCode size={15} />
        Tap, scan, or share with NFC
      </div>
    </div>
  );
}
