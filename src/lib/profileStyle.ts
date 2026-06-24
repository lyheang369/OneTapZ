import type { CSSProperties } from 'react';
import type { User } from './types';

// Free-styling overrides on top of the theme: only applied when the user has
// actually set them, so an unset value falls through to the theme's token.
export function profileStyleVars(user: Pick<User, 'buttonBackground' | 'pageBackground'>): CSSProperties {
  const style: Record<string, string> = {};
  if (user.buttonBackground) style['--primary'] = user.buttonBackground;
  if (user.pageBackground) style['--page-bg'] = user.pageBackground;
  return style as CSSProperties;
}
