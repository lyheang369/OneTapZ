import { UserPlus, User as UserIcon } from 'lucide-react';
import { IconBadge } from './IconBadge';
import type { LinkItem, User } from '../lib/types';

// Shared public-profile card used by both the live page (PublicProfile) and the
// edit-page live preview (PhonePreview), so the editor is true WYSIWYG. The
// surrounding `.public-page theme-* button-*` wrapper supplies the theme tokens.
export function ProfileCard({
  user,
  links,
  onLinkClick,
  onSaveContact,
}: {
  user: User;
  links: LinkItem[];
  onLinkClick?: (link: LinkItem) => void;
  onSaveContact?: () => void;
}) {
  const active = links.filter((link) => link.isActive);
  const socials = active.filter((link) => link.display === 'icon');
  const buttons = active.filter((link) => link.display !== 'icon');

  const saveContactOn = user.saveContactEnabled !== false;
  const saveContactAsIcon = saveContactOn && user.saveContactDisplay === 'icon';
  const saveContactAsButton = saveContactOn && user.saveContactDisplay !== 'icon';

  return (
    <div className="public-card">
      {user.profileImage ? (
        <img
          className="profile-photo"
          src={user.profileImage}
          alt={user.name}
          width={112}
          height={112}
          fetchPriority="high"
          decoding="async"
        />
      ) : (
        <div className="profile-photo is-empty">
          <UserIcon aria-hidden="true" />
        </div>
      )}
      <h1 className="profile-name">{user.name || 'Your name'}</h1>
      <p className="profile-handle">@{user.username || 'username'}</p>
      {(user.jobTitle || user.company) && (
        <p className="profile-role">{[user.jobTitle, user.company].filter(Boolean).join(' · ')}</p>
      )}

      {(socials.length > 0 || saveContactAsIcon) && (
        <div className="social-row">
          {socials.map((link) => (
            <button
              key={link._id}
              className="social-icon"
              type="button"
              onClick={() => onLinkClick?.(link)}
              aria-label={link.title}
              title={link.title}
            >
              <IconBadge name={link.icon} plain />
            </button>
          ))}
          {saveContactAsIcon && (
            <button className="social-icon" type="button" onClick={() => onSaveContact?.()} aria-label="Save contact" title="Save contact">
              <span className="icon-glyph">
                <UserPlus size={26} />
              </span>
            </button>
          )}
        </div>
      )}

      {user.bio && <p className="profile-bio">{user.bio}</p>}

      {saveContactAsButton && (
        <button className="save-contact-btn" type="button" onClick={() => onSaveContact?.()}>
          <UserPlus size={18} />
          Save contact
        </button>
      )}

      <div className="mt-6 space-y-3">
        {buttons.map((link) => (
          <button
            key={link._id}
            className="profile-link w-full"
            type="button"
            onClick={() => onLinkClick?.(link)}
          >
            <IconBadge name={link.icon} />
            <span>{link.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
