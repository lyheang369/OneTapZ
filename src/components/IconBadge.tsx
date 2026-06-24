import { Link as LinkIcon } from 'lucide-react';
import { brandIcons, lucideIcons } from '../lib/icons';

export function IconBadge({ name, plain = false }: { name: string; plain?: boolean }) {
  const cls = plain ? 'icon-glyph' : 'icon-badge';
  const brandPath = brandIcons[name];

  if (brandPath) {
    return (
      <span className={cls}>
        <svg className="brand-svg" viewBox="0 0 24 24" aria-hidden="true">
          <path d={brandPath} />
        </svg>
      </span>
    );
  }

  const Icon = lucideIcons[name] || LinkIcon;
  return (
    <span className={cls}>
      <Icon size={plain ? 24 : 18} />
    </span>
  );
}
