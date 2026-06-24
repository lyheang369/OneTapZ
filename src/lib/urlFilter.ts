// Client-side mirror of server/utils/urlFilter.js — instant feedback when a
// user adds/edits a link. The server performs the authoritative check.

const ALLOWED_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:'];

const BLOCKED_KEYWORDS = [
  'porn', 'xxx', 'xvideos', 'xnxx', 'xhamster', 'hentai', 'rule34', 'nhentai',
  'onlyfans', 'fansly', 'redtube', 'youporn', 'brazzers', 'chaturbate', 'camsoda',
  'livejasmin', 'stripchat', 'bongacams', 'spankbang', 'eporner', 'fapello', 'erome',
  'nsfw', 'escort',
];

const BLOCKED_DOMAINS = [
  'pornhub.com', 'xvideos.com', 'xnxx.com', 'xhamster.com', 'redtube.com', 'youporn.com',
  'onlyfans.com', 'fansly.com', 'chaturbate.com', 'stripchat.com', 'bongacams.com',
  'livejasmin.com', 'cam4.com', 'camsoda.com', 'spankbang.com', 'eporner.com', 'nhentai.net',
  'rule34.xxx', 'e621.net', 'adultfriendfinder.com', 'ashleymadison.com', 'manyvids.com',
  'clips4sale.com',
];

const ADULT_REASON = 'Links to adult or prohibited sites are not allowed.';

export function checkUrl(raw: string): { ok: boolean; reason?: string } {
  if (!raw || !raw.trim()) return { ok: false, reason: 'A URL is required.' };

  const value = raw.trim();
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(value);

  let url: URL;
  try {
    url = new URL(hasScheme ? value : `https://${value}`);
  } catch {
    return { ok: false, reason: 'That does not look like a valid URL.' };
  }

  if (!ALLOWED_SCHEMES.includes(url.protocol.toLowerCase())) {
    return { ok: false, reason: 'Only http, https, mailto and tel links are allowed.' };
  }

  const host = url.hostname.toLowerCase();
  if (BLOCKED_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
    return { ok: false, reason: ADULT_REASON };
  }
  if (BLOCKED_KEYWORDS.some((keyword) => host.includes(keyword))) {
    return { ok: false, reason: ADULT_REASON };
  }

  return { ok: true };
}
