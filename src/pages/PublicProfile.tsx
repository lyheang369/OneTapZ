import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { Download, Mail, Phone, QrCode, Share2 } from 'lucide-react';
import { IconBadge } from '../components/IconBadge';
import { api } from '../lib/api';
import { demoLinks, demoUser } from '../data/demo';
import { readLastLocalProfile, readLocalLinks } from '../lib/localStore';
import type { LinkItem, User } from '../lib/types';

type ProfileStyle = CSSProperties & {
  '--button-bg': string;
  '--page-bg': string;
};

export function PublicProfile() {
  const { username = 'zara' } = useParams();
  const [profile, setProfile] = useState<User>(demoUser);
  const [links, setLinks] = useState<LinkItem[]>(demoLinks);
  const [qr, setQr] = useState('');
  const qrLink = `${window.location.origin}/${username}`;
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;

    async function loadProfile() {
      try {
        const { data } = await api.get(`/profile/${username}`);
        setProfile(data.user);
        setLinks(data.links);
      } catch {
        const localProfile = readLastLocalProfile();
        if (localProfile?.username === username) {
          setProfile(localProfile);
          setLinks(readLocalLinks(localProfile.id));
        } else {
          setProfile({ ...demoUser, username });
        }
      }
    }

    loadProfile();
    QRCode.toDataURL(qrLink, { width: 280, margin: 1 }).then(setQr);
  }, [qrLink, username]);

  async function trackAndOpen(link: LinkItem) {
    try {
      if (!link._id.startsWith('link-')) await api.post(`/links/${link._id}/click`);
    } finally {
      window.open(link.url, '_blank', 'noopener,noreferrer');
    }
  }

  return (
    <main
      className={`public-page theme-${profile.theme} button-${profile.buttonStyle || 'pill'}`}
      style={{ '--button-bg': profile.buttonBackground || '#2563eb', '--page-bg': profile.pageBackground || '#0f172a' } as ProfileStyle}
    >
      <section className="mx-auto min-h-svh w-full max-w-md px-5 py-8">
        <div className="public-card">
          {profile.profileImage ? <img className="profile-photo" src={profile.profileImage} alt={profile.name} /> : <div className="profile-photo" />}
          <h1 className="mt-4 text-center text-3xl font-black">{profile.name}</h1>
          <p className="text-center text-sm opacity-75">@{profile.username}</p>
          <p className="mt-4 text-center leading-7 opacity-90">{profile.bio}</p>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <a className="contact-button" href="mailto:hello@onetapz.link">
              <Mail size={17} />
              Email
            </a>
            <a className="contact-button" href="tel:+85510000000">
              <Phone size={17} />
              Call
            </a>
            <button className="contact-button" type="button" onClick={() => navigator.share?.({ url: qrLink })}>
              <Share2 size={17} />
              Share
            </button>
          </div>

          <div className="mt-6 space-y-3">
            {links
              .filter((link) => link.isActive)
              .map((link) => (
                <button key={link._id} className="profile-link w-full" type="button" onClick={() => trackAndOpen(link)}>
                  <IconBadge name={link.icon} />
                  <span>{link.title}</span>
                </button>
              ))}
          </div>

          {qr && (
            <div className="qr-box">
              <img src={qr} alt="Profile QR code" />
              <a className="btn-ghost justify-center" href={qr} download="onetapz-qr.png">
                <Download size={16} />
                Download QR
              </a>
            </div>
          )}
          <div className="mt-5 flex items-center justify-center gap-2 text-xs opacity-70">
            <QrCode size={14} />
            {window.location.host}/{profile.username}
          </div>
        </div>
      </section>
    </main>
  );
}
