import { Briefcase, Link, Mail, Music } from 'lucide-react';
import { siGithub, siInstagram, siTiktok, siX } from 'simple-icons';

const lucideIcons = {
  mail: Mail,
  portfolio: Briefcase,
  music: Music,
  link: Link,
};

const brandIcons = {
  instagram: siInstagram.path,
  github: siGithub.path,
  twitter: siX.path,
  tiktok: siTiktok.path,
};

export function IconBadge({ name }: { name: string }) {
  const brandPath = brandIcons[name as keyof typeof brandIcons];

  if (brandPath) {
    return (
      <span className="icon-badge">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d={brandPath} />
        </svg>
      </span>
    );
  }

  const Icon = lucideIcons[name as keyof typeof lucideIcons] || Link;
  return (
    <span className="icon-badge">
      <Icon size={18} />
    </span>
  );
}
