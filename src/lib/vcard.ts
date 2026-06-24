import type { User } from './types';

// Escape vCard text values per RFC 6350 (backslash, comma, semicolon, newline).
function esc(value: string): string {
  return value.replace(/([\\,;])/g, '\\$1').replace(/\n/g, '\\n');
}

// Build a vCard 3.0 string from a profile. Only includes lines for fields the
// user has filled in; FN (formatted name) is always present.
export function buildVCard(user: User, profileUrl: string): string {
  const name = (user.name || user.username || '').trim();
  // vCard 3.0 *requires* the structured N property; iOS/Android Contacts show a
  // blank, unnamed contact when only FN is present. Split on the first space:
  // first token = given name, the remainder = family name.
  const [given = '', ...rest] = name.split(/\s+/);
  const family = rest.join(' ');

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${esc(family)};${esc(given)};;;`,
    `FN:${esc(name)}`,
  ];

  if (user.company) lines.push(`ORG:${esc(user.company)}`);
  if (user.jobTitle) lines.push(`TITLE:${esc(user.jobTitle)}`);
  if (user.phone) lines.push(`TEL;TYPE=CELL:${esc(user.phone)}`);
  if (user.contactEmail) lines.push(`EMAIL;TYPE=INTERNET:${esc(user.contactEmail)}`);
  if (user.location) lines.push(`ADR;TYPE=HOME:;;${esc(user.location)};;;;`);
  if (profileUrl) lines.push(`URL:${esc(profileUrl)}`);
  if (user.bio) lines.push(`NOTE:${esc(user.bio)}`);
  if (user.profileImage) lines.push(`PHOTO;VALUE=URI:${esc(user.profileImage)}`);

  lines.push('END:VCARD');
  return lines.join('\r\n');
}

// Generate and trigger download of the contact as a .vcf file. On mobile,
// opening the file prompts the OS to add it to the address book.
export function downloadVCard(user: User, profileUrl: string): void {
  const blob = new Blob([buildVCard(user, profileUrl)], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${user.username || 'contact'}.vcf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
