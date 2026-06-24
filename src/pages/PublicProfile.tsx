import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Copy, Download, QrCode, Share2, X } from 'lucide-react';
import { ProfileCard } from '../components/ProfileCard';
import { useAuth } from '../context/AuthContext';
import { publicApi } from '../lib/api';
import { readLastLocalProfile, readLocalLinks } from '../lib/localStore';
import { profileStyleVars } from '../lib/profileStyle';
import { downloadVCard } from '../lib/vcard';
import type { LinkItem, User } from '../lib/types';

export function PublicProfile() {
  const { username = '' } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'notfound'>('loading');
  const [qr, setQr] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const qrLink = `${window.location.origin}/${username}`;
  const loaded = useRef(false);

  function copyLink() {
    navigator.clipboard.writeText(qrLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  useEffect(() => {
    // Wait until auth resolves so we know whether the viewer is the owner.
    if (authLoading || loaded.current) return;
    loaded.current = true;

    // The owner just edited and wants to see changes immediately, so bypass the
    // edge cache for them with a unique query key. Everyone else gets the fast
    // cached response (staleness ≤ the cache TTL is fine for visitors).
    const isOwner = !!user && user.username === username;
    const buster = isOwner ? `?t=${Date.now()}` : '';

    async function loadProfile() {
      try {
        // publicApi sends no auth header so the response is edge-cacheable.
        const { data } = await publicApi.get(`/profile/${username}${buster}`);
        setProfile(data.user);
        setLinks(data.links ?? []);
        setStatus('ready');
        // Count the view separately (fire-and-forget) so it still records on
        // edge-cache hits, where the GET handler never runs.
        publicApi.post('/analytics/view', { username }).catch(() => {});
      } catch {
        // No server profile — fall back to a locally-saved profile (offline
        // mode) only when it matches this username; otherwise it's a 404.
        const localProfile = readLastLocalProfile();
        if (localProfile?.username === username) {
          setProfile(localProfile);
          setLinks(readLocalLinks(localProfile.id));
          setStatus('ready');
        } else {
          setStatus('notfound');
        }
      }
    }

    loadProfile();
  }, [authLoading, user, username]);

  // Generate the QR only after the profile is shown, loading the qrcode library
  // lazily so it stays out of the public profile's initial JS chunk.
  useEffect(() => {
    if (status !== 'ready') return;
    let cancelled = false;
    import('qrcode').then((QR) => {
      QR.default.toDataURL(qrLink, { width: 280, margin: 1 }).then((url) => {
        if (!cancelled) setQr(url);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [status, qrLink]);

  // Close the QR popup on Escape.
  useEffect(() => {
    if (!showQr) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowQr(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showQr]);

  function trackAndOpen(link: LinkItem) {
    // Never await before window.open(): a popup blocker rejects window.open()
    // that runs after an await (it's outside the click's user-activation stack).
    // On cold-start/first-visit the click-tracking POST is slow, so awaiting it
    // silently swallowed the activation and the link did nothing. Open first,
    // then fire the analytics write in parallel as fire-and-forget.
    window.open(link.url, '_blank', 'noopener,noreferrer');
    void publicApi.post(`/links/${link._id}/click`).catch(() => {});
  }

  if (status === 'loading') {
    return (
      <main className="public-page theme-dark">
        <section className="mx-auto min-h-svh w-full max-w-md px-5 py-8">
          <div className="public-card" aria-busy="true" aria-label="Loading profile">
            <div className="skeleton skeleton-avatar" />
            <div className="skeleton skeleton-name" />
            <div className="skeleton skeleton-handle" />
            <div className="skeleton skeleton-bio" />
            <div className="skeleton skeleton-bio short" />
            <div className="mt-5">
              <div className="skeleton skeleton-contact" />
            </div>
            <div className="mt-6 space-y-3">
              <div className="skeleton skeleton-link" />
              <div className="skeleton skeleton-link" />
              <div className="skeleton skeleton-link" />
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (status === 'notfound' || !profile) {
    return (
      <main className="public-page theme-dark">
        <section className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center px-5 py-8 text-center">
          <h1 className="text-3xl font-black text-white">Profile not found</h1>
          <p className="mt-3 text-slate-400">No OneTapZ profile exists at @{username}.</p>
          <a className="btn-primary mt-6" href="/">
            Go to OneTapZ
          </a>
        </section>
      </main>
    );
  }

  return (
    <main
      className={`public-page theme-${profile.theme} button-${profile.buttonStyle || 'pill'}`}
      style={profileStyleVars(profile)}
    >
      <section className="mx-auto min-h-svh w-full max-w-md px-5 py-8">
        <ProfileCard
          user={profile}
          links={links}
          onLinkClick={trackAndOpen}
          onSaveContact={() => downloadVCard(profile, qrLink)}
        />
        <p className="profile-foot">
          Powered by <strong>OneTapZ</strong> · one tap, all your links
        </p>
      </section>

      <button className="qr-fab" type="button" onClick={() => setShowQr(true)} aria-label="Share &amp; QR code">
        <QrCode size={22} />
      </button>

      {showQr && (
        <div className="qr-modal" role="dialog" aria-modal="true" aria-label="Share profile" onClick={() => setShowQr(false)}>
          <div className="qr-modal-card" onClick={(event) => event.stopPropagation()}>
            <button className="qr-modal-close" type="button" aria-label="Close" onClick={() => setShowQr(false)}>
              <X size={18} />
            </button>
            <p className="qr-modal-handle">@{profile.username}</p>
            {qr ? (
              <img className="qr-modal-img" src={qr} alt="Profile QR code" />
            ) : (
              <div className="qr-modal-img skeleton" />
            )}
            <p className="qr-modal-url">{window.location.host}/{profile.username}</p>
            <div className="qr-modal-actions">
              {qr && (
                <a className="btn-ghost justify-center" href={qr} download={`onetapz-${profile.username}.png`}>
                  <Download size={16} />
                  Download
                </a>
              )}
              <button className="btn-ghost justify-center" type="button" onClick={copyLink}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied' : 'Copy link'}
              </button>
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button className="btn-ghost justify-center" type="button" onClick={() => navigator.share?.({ url: qrLink })}>
                  <Share2 size={16} />
                  Share
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
