import { Briefcase, Link, Mail, Music } from 'lucide-react';
import { siGithub, siInstagram, siTiktok, siX, siYoutube } from 'simple-icons';

const lucideIcons = {
  mail: Mail,
  portfolio: Briefcase,
  music: Music,
  link: Link,
};

// LinkedIn was removed from simple-icons (brand policy), so its path is inlined.
const linkedinPath =
  'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z';

const brandIcons = {
  instagram: siInstagram.path,
  github: siGithub.path,
  twitter: siX.path,
  x: siX.path,
  tiktok: siTiktok.path,
  youtube: siYoutube.path,
  linkedin: linkedinPath,
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
